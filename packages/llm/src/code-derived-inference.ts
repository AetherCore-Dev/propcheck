/**
 * Code-Derived Property Inference (CDPI) — extracts provable properties
 * directly from function source code.
 *
 * Unlike the adaptive generator which guesses algebraic properties from
 * type signatures, CDPI only generates properties that have concrete
 * evidence in the source code. This eliminates false positives at the
 * cost of fewer (but more reliable) properties per function.
 *
 * Used as the primary engine in mock mode. The adaptive generator serves
 * as a fallback when CDPI produces fewer than 2 properties.
 */

import type {
  FunctionSignature,
  ParameterInfo,
  GeneratorSpec,
  SeedInput,
  PropertyCategory,
} from "@propcheck/common";
import type { RawMockProperty } from "./adaptive-generator";
import { mapParamGenerators, buildSeedInputs } from "./adaptive-generator";
import { extractFunctionBody } from "./source-analyzer";

// ---------------------------------------------------------------------------
// 1. Guard Extraction — find if/throw and if/return patterns
// ---------------------------------------------------------------------------

interface Guard {
  /** The full condition text, e.g. "prices.length === 0" */
  readonly condition: string;
  /** What happens when condition is true */
  readonly consequence: "return" | "throw";
  /** The return value expression (if consequence is "return") */
  readonly returnValue: string | null;
  /** Parameter names referenced in the condition */
  readonly parameterRefs: readonly string[];
}

/**
 * Extract guard clauses from a function body.
 * Looks for patterns like:
 *   if (x === 0) return 0;
 *   if (!arr.length) throw new Error(...);
 *   if (x < 0) return x;
 */
function extractGuards(
  body: string,
  paramNames: readonly string[],
): readonly Guard[] {
  const guards: Guard[] = [];

  // Use depth-aware scanning to handle nested parentheses in conditions
  // e.g. if (x > 0 && fn(y)) return z;
  const ifPattern = /if\s*\(/g;
  let ifMatch: RegExpExecArray | null;

  while ((ifMatch = ifPattern.exec(body)) !== null) {
    // Find matching closing paren by counting depth
    const condStart = ifMatch.index + ifMatch[0].length;
    let depth = 1;
    let ci = condStart;
    while (ci < body.length && depth > 0) {
      if (body[ci] === "(") depth++;
      else if (body[ci] === ")") depth--;
      if (depth > 0) ci++;
    }
    if (depth !== 0) continue;

    const condition = body.slice(condStart, ci).trim();
    const afterParen = body.slice(ci + 1).trimStart();

    // Check for return pattern
    const returnMatch = afterParen.match(/^(?:\{?\s*return\s+([^;}]+)[;}]?\s*\}?)/);
    if (returnMatch) {
      const returnValue = returnMatch[1].trim();
      const parameterRefs = paramNames.filter(
        (name) => new RegExp(`\\b${escapeRegex(name)}\\b`).test(condition),
      );
      guards.push({ condition, consequence: "return", returnValue, parameterRefs });
      continue;
    }

    // Check for throw pattern
    const throwMatch = afterParen.match(/^(?:\{?\s*throw\b)/);
    if (throwMatch) {
      const parameterRefs = paramNames.filter(
        (name) => new RegExp(`\\b${escapeRegex(name)}\\b`).test(condition),
      );
      guards.push({ condition, consequence: "throw", returnValue: null, parameterRefs });
    }
  }

  return guards;
}

// ---------------------------------------------------------------------------
// 2. Return Expression Analysis
// ---------------------------------------------------------------------------

interface ReturnAnalysis {
  /** Does the function always return the same type? */
  readonly returnType: "number" | "string" | "boolean" | "array" | "object" | "unknown";
  /** Does it use .sort() on the return value? */
  readonly sortedOutput: boolean;
  /** Does it preserve input array length? (e.g. .map, .sort, spread+sort) */
  readonly preservesLength: boolean;
  /** Does it reduce array to scalar? (e.g. .reduce) */
  readonly reducesToScalar: boolean;
  /** Does it use .filter() (reduces length)? */
  readonly filters: boolean;
  /** Does it use .toFixed() or template literals? (formatting) */
  readonly formats: boolean;
  /** Simple return expressions found (e.g. "price * (1 - discount / 100)") */
  readonly returnExpressions: readonly string[];
}

function analyzeReturns(
  body: string,
  declaredReturnType: string | null,
): ReturnAnalysis {
  // Collect all return expressions
  const returnExprs: string[] = [];
  const returnPattern = /return\s+([^;}\n]+)/g;
  let match: RegExpExecArray | null;
  while ((match = returnPattern.exec(body)) !== null) {
    returnExprs.push(match[1].trim());
  }

  // Determine effective return type
  let returnType: ReturnAnalysis["returnType"] = "unknown";
  if (declaredReturnType) {
    const t = declaredReturnType.trim();
    if (t === "number") returnType = "number";
    else if (t === "string") returnType = "string";
    else if (t === "boolean") returnType = "boolean";
    else if (/\[\]$/.test(t) || /^Array</.test(t) || /^ReadonlyArray</.test(t) || /^readonly\s+\w+\[\]$/.test(t)) returnType = "array";
    else if (t !== "void" && t !== "undefined") returnType = "object";
  }

  const allReturns = returnExprs.join(" ");
  const sortedOutput = /\.sort\s*\(/.test(allReturns) || /\.toSorted\s*\(/.test(allReturns);
  const preservesLength = sortedOutput ||
    (/\.\s*map\s*\(/.test(allReturns) && returnType === "array") ||
    (/\[\s*\.\.\./.test(allReturns) && /\.sort\s*\(/.test(allReturns));
  const reducesToScalar = /\.reduce\s*\(/.test(allReturns);
  const filters = /\.filter\s*\(/.test(allReturns);
  const formats = /\.toFixed\s*\(/.test(allReturns) || /\.padStart\s*\(/.test(allReturns) || /`[^`]*\$\{/.test(allReturns);

  return {
    returnType,
    sortedOutput,
    preservesLength,
    reducesToScalar,
    filters,
    formats,
    returnExpressions: returnExprs,
  };
}

// ---------------------------------------------------------------------------
// 3. Purity Detection
// ---------------------------------------------------------------------------

function isPure(body: string, isAsync: boolean): boolean {
  if (isAsync) return false;
  // Check for side effects
  if (/\bthis\s*\./.test(body)) return false;  // method with state
  if (/\bfs\b\s*\./.test(body)) return false;   // file I/O
  if (/\bfetch\s*\(/.test(body)) return false;   // network
  if (/\bconsole\s*\./.test(body)) return false;  // logging (side effect)
  if (/\bprocess\s*\./.test(body)) return false;  // process access
  if (/\bawait\b/.test(body)) return false;       // async operations
  if (/\bglobal\b/.test(body)) return false;      // global access
  return true;
}

// ---------------------------------------------------------------------------
// 4. Property Synthesis — build properties from analysis results
// ---------------------------------------------------------------------------

function buildCallExpr(funcName: string, params: readonly ParameterInfo[]): string {
  if (params.length === 0) return `${funcName}()`;
  return `${funcName}(${params.map((p) => p.name).join(", ")})`;
}

function makeProp(
  sig: FunctionSignature,
  category: PropertyCategory,
  generators: Readonly<Record<string, GeneratorSpec>>,
  assertion: string,
  description: string,
  evidence: string,
  confidence: number = 0.90,
): RawMockProperty {
  return {
    targetFunction: sig.qualifiedName,
    description,
    category,
    assertion,
    generators,
    seedInputs: buildSeedInputs(generators),
    evidence,
    confidence,
  };
}

/**
 * Synthesize properties from code analysis results.
 */
function synthesizeProperties(
  sig: FunctionSignature,
  body: string,
  guards: readonly Guard[],
  returns: ReturnAnalysis,
  pure: boolean,
): readonly RawMockProperty[] {
  const generators = mapParamGenerators(sig.parameters);
  const call = buildCallExpr(sig.name, sig.parameters);
  const properties: RawMockProperty[] = [];
  const usedAssertions = new Set<string>();

  const addProp = (prop: RawMockProperty): void => {
    if (!usedAssertions.has(prop.assertion)) {
      usedAssertions.add(prop.assertion);
      properties.push(prop);
    }
  };

  // --- Guard-derived boundary properties ---
  for (const guard of guards) {
    if (guard.consequence === "return" && guard.returnValue !== null) {
      // if (condition) return value; → test the boundary
      // e.g., if (prices.length === 0) return 0 → calculateTotal([]) === 0
      const assertion = buildGuardAssertion(sig, guard);
      if (assertion) {
        addProp(makeProp(
          sig, "boundary", generators,
          assertion.code,
          assertion.description,
          `Guard clause in source: if (${guard.condition}) return ${guard.returnValue}`,
          0.95,
        ));
      }
    }
    if (guard.consequence === "throw") {
      // if (condition) throw → test that invalid input is rejected
      // Skipped for now — generating "should throw" properties requires
      // different fast-check setup (fc.assert with expect-throw wrapper)
    }
  }

  // --- Return-type-derived properties ---
  if (returns.returnType === "number") {
    addProp(makeProp(
      sig, "boundary", generators,
      `Number.isFinite(${call})`,
      `${sig.name} should return a finite number`,
      `Return type is number — verifies no NaN or Infinity`,
    ));
  }
  if (returns.returnType === "string") {
    addProp(makeProp(
      sig, "boundary", generators,
      `typeof ${call} === "string"`,
      `${sig.name} should return a string`,
      `Return type is string`,
    ));
  }
  if (returns.returnType === "boolean") {
    // For boolean functions, determinism is more useful than type check
    if (pure) {
      addProp(makeProp(
        sig, "boundary", generators,
        `(() => { const r1 = ${call}; const r2 = ${call}; return r1 === r2; })()`,
        `${sig.name} is deterministic — same inputs give same boolean`,
        `Pure function returning boolean — determinism check`,
      ));
    }
  }
  if (returns.returnType === "array") {
    addProp(makeProp(
      sig, "boundary", generators,
      `Array.isArray(${call})`,
      `${sig.name} should return an array`,
      `Return type is array`,
    ));
  }
  if (returns.returnType === "object") {
    addProp(makeProp(
      sig, "boundary", generators,
      `(() => { const r = ${call}; return r !== null && r !== undefined; })()`,
      `${sig.name} should return a defined value`,
      `Return type is object — non-null check`,
      0.80,
    ));
  }

  // --- Code-pattern-derived properties ---

  // Sort detected → monotonic + conservation + idempotent
  if (returns.sortedOutput && returns.returnType === "array") {
    const arrayParam = sig.parameters.find((p) => p.type && /\[\]$|^Array<|^ReadonlyArray<|^readonly\s/.test(p.type));
    if (arrayParam) {
      addProp(makeProp(
        sig, "monotonic", generators,
        `${call}.every((v, i, a) => i === 0 || a[i-1] <= v)`,
        `${sig.name} output should be sorted (non-decreasing)`,
        `Source code uses .sort() — output is ordered`,
        0.92,
      ));
      addProp(makeProp(
        sig, "conservation", generators,
        `${call}.length === ${arrayParam.name}.length`,
        `${sig.name} should preserve array length`,
        `Source code uses .sort() which preserves length`,
        0.95,
      ));
      // sort is idempotent
      addProp(makeProp(
        sig, "idempotent", generators,
        `JSON.stringify(${sig.name}(${call})) === JSON.stringify(${call})`,
        `Sorting is idempotent — sorting twice equals sorting once`,
        `Source code uses .sort() which is idempotent`,
        0.92,
      ));
    }
  }

  // Filter detected → conservation (length <= input)
  if (returns.filters && returns.returnType === "array") {
    const arrayParam = sig.parameters.find((p) => p.type && /\[\]$|^Array</.test(p.type));
    if (arrayParam) {
      addProp(makeProp(
        sig, "conservation", generators,
        `${call}.length <= ${arrayParam.name}.length`,
        `${sig.name} output length should not exceed input length`,
        `Source code uses .filter() which can only reduce length`,
        0.95,
      ));
    }
  }

  // new Set() detected → deduplication: no duplicates + idempotent
  if (/\bnew\s+Set\b/.test(body) && returns.returnType === "array") {
    addProp(makeProp(
      sig, "boundary", generators,
      `new Set(${call}).size === ${call}.length`,
      `${sig.name} output should have no duplicate elements`,
      `Source code uses new Set() for deduplication`,
      0.95,
    ));
  }

  // .reduce() with initial 0 → boundary: empty array returns 0
  if (returns.reducesToScalar && returns.returnType === "number") {
    const reduceMatch = returns.returnExpressions.join(" ").match(/\.reduce\s*\([^,]+,\s*(\d+)\s*\)/);
    if (reduceMatch) {
      const arrayParam = sig.parameters.find((p) => p.type && /\[\]$|^Array</.test(p.type));
      if (arrayParam) {
        addProp(makeProp(
          sig, "boundary", generators,
          `${sig.name}([]) === ${reduceMatch[1]}`,
          `${sig.name} of empty array should be ${reduceMatch[1]}`,
          `Source: .reduce(..., ${reduceMatch[1]}) — initial accumulator value`,
          0.95,
        ));
      }
    }
  }

  // Math.min(Math.max(...)) pattern → clamp: result within bounds
  if (/Math\.min\s*\(\s*Math\.max\b/.test(body) || /Math\.max\s*\(\s*Math\.min\b/.test(body)) {
    if (sig.parameters.length >= 3) {
      const [val, lo, hi] = sig.parameters;
      addProp(makeProp(
        sig, "boundary", generators,
        `(() => { const r = ${call}; return r >= ${lo.name} && r <= ${hi.name}; })()`,
        `${sig.name} result should be within [${lo.name}, ${hi.name}]`,
        `Source uses Math.min(Math.max(...)) — clamping pattern`,
        0.95,
      ));
      // Clamp IS idempotent
      addProp(makeProp(
        sig, "idempotent", generators,
        `${sig.name}(${call}, ${lo.name}, ${hi.name}) === ${call}`,
        `${sig.name} is idempotent — clamping already-clamped value gives same result`,
        `Clamping is idempotent by definition`,
        0.92,
      ));
    }
  }

  // .replace() with regex → string transform: length <= input (for removing patterns)
  if (/\.replace\s*\(/.test(body) && returns.returnType === "string") {
    const stringParam = sig.parameters.find((p) => p.type === "string");
    if (stringParam) {
      // replace can only shorten or maintain — never lengthen (for simple replaces)
      // Actually not always true (replacement can be longer), skip this
    }
  }

  // .toFixed() → formatting: output has fixed decimal places
  if (returns.formats && /\.toFixed\s*\((\d+)\)/.test(body)) {
    const fixedMatch = body.match(/\.toFixed\s*\((\d+)\)/);
    if (fixedMatch) {
      const decimals = fixedMatch[1];
      addProp(makeProp(
        sig, "type-preservation", generators,
        `/^-?\\d+\\.\\d{${decimals}}$/.test(${call})`,
        `${sig.name} output should have exactly ${decimals} decimal places`,
        `Source uses .toFixed(${decimals})`,
        0.90,
      ));
    }
  }

  // --- Determinism for pure functions ---
  if (pure && properties.length < 5 && sig.parameters.length > 0) {
    addProp(makeProp(
      sig, "metamorphic", generators,
      `(() => { const r1 = ${call}; const r2 = ${call}; return JSON.stringify(r1) === JSON.stringify(r2); })()`,
      `${sig.name} is deterministic — same inputs give same output`,
      `Function is pure (no side effects detected)`,
      0.88,
    ));
  }

  return properties;
}

// ---------------------------------------------------------------------------
// 5. Guard → Assertion Conversion
// ---------------------------------------------------------------------------

interface GuardAssertion {
  readonly code: string;
  readonly description: string;
}

/**
 * Convert a guard clause into a testable assertion.
 * Only handles simple, well-understood patterns.
 */
function buildGuardAssertion(
  sig: FunctionSignature,
  guard: Guard,
): GuardAssertion | null {
  const { condition, returnValue } = guard;
  if (!returnValue) return null;

  // Pattern: param.length === 0 → fn([]) === returnValue
  const lengthZeroMatch = condition.match(/^(\w+)\.length\s*===?\s*0$/);
  if (lengthZeroMatch) {
    const paramName = lengthZeroMatch[1];
    const param = sig.parameters.find((p) => p.name === paramName);
    if (param) {
      return {
        code: `${sig.name}([]) === ${returnValue}`,
        description: `${sig.name} of empty input should return ${returnValue}`,
      };
    }
  }

  // Pattern: !param.length → fn([]) === returnValue
  const notLengthMatch = condition.match(/^!(\w+)\.length$/);
  if (notLengthMatch) {
    const paramName = notLengthMatch[1];
    const param = sig.parameters.find((p) => p.name === paramName);
    if (param) {
      return {
        code: `${sig.name}([]) === ${returnValue}`,
        description: `${sig.name} of empty input should return ${returnValue}`,
      };
    }
  }

  // Pattern: param === "" → fn("") === returnValue
  const emptyStringMatch = condition.match(/^(\w+)\s*===?\s*["'](?:["'])$/);
  if (emptyStringMatch) {
    const paramName = emptyStringMatch[1];
    const param = sig.parameters.find((p) => p.name === paramName);
    if (param) {
      return {
        code: `${sig.name}("") === ${returnValue}`,
        description: `${sig.name} of empty string should return ${returnValue}`,
      };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// 6. Public API
// ---------------------------------------------------------------------------

/**
 * Derive properties from source code analysis.
 * Returns only properties that have concrete evidence in the source.
 *
 * @param sig - The function signature to analyze
 * @param sourceCode - The full source code of the module
 * @returns Array of code-derived properties (may be empty)
 */
export function derivePropertiesFromSource(
  sig: FunctionSignature,
  sourceCode: string,
): readonly RawMockProperty[] {
  const body = extractFunctionBody(sig.name, sourceCode);
  if (!body) return [];

  const paramNames = sig.parameters.map((p) => p.name);
  const guards = extractGuards(body, paramNames);
  const returns = analyzeReturns(body, sig.returnType);
  const pure = isPure(body, sig.isAsync);

  return synthesizeProperties(sig, body, guards, returns, pure);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
