/**
 * propcheck infer — parse code and infer properties using LLM.
 *
 * Pipeline:
 * 1. Load config (API key check)
 * 2. Parse target file(s) → AnalysisContext
 * 3. LLM.inferProperties(context)
 * 4. Trial-run validation — quick run 100x to filter false positives
 * 5. Store.setProperties(module, propertySet)
 * 6. Reporter.reportInferResult(result)
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { loadConfig, validateConfig } from "@propcheck/config";
import { analyzeFile, detectLanguage, analyzePythonFile } from "@propcheck/parser";
import {
  inferProperties,
  createClient,
  repairProperty,
  mockRepairProperty,
  classifyProperties,
  buildFeedbackSummary,
  mockRefineProperties,
  refineProperties,
  computeRiskScore,
  detectRiskTags,
} from "@propcheck/llm";
import type { LlmClient } from "@propcheck/llm";
import { setProperties, initStore } from "@propcheck/store";
import {
  generateFastCheckTest,
  runFastCheckTest,
  generateHypothesisTest,
  runHypothesisTest,
} from "@propcheck/engines";
import { reportInferResult } from "@propcheck/reporter";
import { hashContent, toForwardSlash } from "@propcheck/common";
import type {
  PropertyDefinition,
  PropertySet,
  AnalysisContext,
  FunctionSignature,
  TypeDefinition,
  RunConfig,
  ExecutionResult,
  GeneratorSpec,
  PropertyRiskTag,
  ValidationEvidence,
} from "@propcheck/common";

interface InferOptions {
  mock?: boolean;
  model?: string;
  provider?: string;
  baseUrl?: string;
  maxProperties?: string;
  minScore?: string;
  skipValidation?: boolean;
  refine?: boolean;
  function?: string;
}

type TrialRunLanguage = "typescript" | "javascript" | "python";

// ---------------------------------------------------------------------------
// --function helpers: filter AnalysisContext to specific functions
// ---------------------------------------------------------------------------

/**
 * Detect which type names are referenced by the given functions
 * (in parameter types, return type, or docstrings).
 */
function findReferencedTypeNames(
  functions: readonly FunctionSignature[],
  allTypes: readonly TypeDefinition[],
): Set<string> {
  const typeNames = new Set(allTypes.map((t) => t.name));
  const referenced = new Set<string>();

  for (const fn of functions) {
    for (const typeName of typeNames) {
      if (fn.returnType?.includes(typeName)) {
        referenced.add(typeName);
      }
      for (const param of fn.parameters) {
        if (param.type?.includes(typeName)) {
          referenced.add(typeName);
        }
      }
      if (fn.docstring?.includes(typeName)) {
        referenced.add(typeName);
      }
    }
  }

  return referenced;
}

/**
 * Trim source code to only include import lines, matched function bodies,
 * and referenced type definitions. Non-contiguous blocks are separated
 * by `// ... (trimmed)` markers.
 */
function trimSourceCode(
  fullSource: string,
  matchedFunctions: readonly FunctionSignature[],
  referencedTypes: readonly TypeDefinition[],
): string {
  const lines = fullSource.split("\n");

  // Collect all line ranges to include (1-indexed)
  const ranges: Array<[number, number]> = [];

  // Import block: lines from 1 up to the first function/type startLine
  const allStarts = [
    ...matchedFunctions.map((f) => f.loc.startLine),
    ...referencedTypes.map((t) => t.loc.startLine),
  ];
  if (allStarts.length > 0) {
    const firstDeclLine = Math.min(...allStarts);
    if (firstDeclLine > 1) {
      ranges.push([1, firstDeclLine - 1]);
    }
  }

  // Function bodies
  for (const fn of matchedFunctions) {
    ranges.push([fn.loc.startLine, fn.loc.endLine]);
  }

  // Referenced type definitions
  for (const t of referencedTypes) {
    ranges.push([t.loc.startLine, t.loc.endLine]);
  }

  if (ranges.length === 0) return fullSource;

  // Sort by startLine, merge overlapping/adjacent ranges
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [ranges[0]];
  for (let i = 1; i < ranges.length; i++) {
    const prev = merged[merged.length - 1];
    const curr = ranges[i];
    if (curr[0] <= prev[1] + 1) {
      prev[1] = Math.max(prev[1], curr[1]);
    } else {
      merged.push(curr);
    }
  }

  // Extract lines and join with separator
  const parts: string[] = [];
  for (const [start, end] of merged) {
    const s = Math.max(0, start - 1); // convert to 0-indexed
    const e = Math.min(lines.length, end); // exclusive upper bound
    parts.push(lines.slice(s, e).join("\n"));
  }

  return parts.join("\n\n// ... (trimmed)\n\n");
}

/** Match a user-provided function name against a FunctionSignature. */
function matchesFunctionName(fn: FunctionSignature, name: string): boolean {
  return (
    fn.name === name ||
    fn.qualifiedName === name ||
    fn.qualifiedName.endsWith("." + name)
  );
}

/**
 * Filter an AnalysisContext to only include the specified functions,
 * their referenced types, and trimmed source code.
 */
function filterContextByFunctions(
  context: AnalysisContext,
  functionNames: string[],
): AnalysisContext {
  // 1. Match functions
  const matchedFunctions = context.functions.filter((fn) =>
    functionNames.some((name) => matchesFunctionName(fn, name)),
  );

  // 2. Find referenced types
  const refTypeNames = findReferencedTypeNames(matchedFunctions, context.types);
  const matchedTypes = context.types.filter((t) => refTypeNames.has(t.name));

  // 3. Trim source code
  const trimmedSource = trimSourceCode(
    context.sourceCode,
    matchedFunctions,
    matchedTypes,
  );

  // 4. Filter signals
  const matchedQualNames = new Set(matchedFunctions.map((f) => f.qualifiedName));
  const matchedNames = new Set(matchedFunctions.map((f) => f.name));

  const filteredDoc = context.signals.doc.filter(
    (d) => matchedQualNames.has(d.functionName) || matchedNames.has(d.functionName),
  );
  const filteredType = context.signals.type.filter(
    (t) => matchedQualNames.has(t.functionName) || matchedNames.has(t.functionName),
  );

  return {
    filePath: context.filePath,
    language: context.language,
    sourceCode: trimmedSource,
    functions: matchedFunctions,
    types: matchedTypes,
    imports: context.imports,
    signals: {
      ast: context.signals.ast,
      type: filteredType,
      doc: filteredDoc,
    },
  };
}

/**
 * Trial-run validation with self-repair: quick-execute inferred properties,
 * and attempt to fix compile/runtime errors up to 3 times.
 *
 * Flow per property:
 *   100/100 PASS → KEEP
 *   FAIL (counterexample found) → KEEP (found a bug!)
 *   ERROR (compile/runtime) → REPAIR up to 3 rounds → KEEP if fixed, DROP if not
 */
const MAX_REPAIR_ROUNDS = 3;
const MAX_CANARY_CASES = 8;

function isNumericSpec(spec: GeneratorSpec): boolean {
  return spec.type === "float" || spec.type === "number" || spec.type === "integer" || spec.type === "int";
}

function getNumericBounds(spec: GeneratorSpec): { readonly min?: number; readonly max?: number } {
  const c = spec.constraints ?? {};
  const min = typeof c.min === "number" ? c.min : undefined;
  const max = typeof c.max === "number" ? c.max : undefined;
  return { ...(min !== undefined ? { min } : {}), ...(max !== undefined ? { max } : {}) };
}

function buildValidationEvidence(smokePasses: number, canaryPasses: number): ValidationEvidence {
  return {
    smokePasses,
    canaryPasses,
    seedsTested: [],
    lastValidatedAt: new Date().toISOString(),
  };
}

function buildCandidateValues(spec: GeneratorSpec): readonly unknown[] {
  const c = spec.constraints ?? {};

  if (spec.type === "boolean") {
    return [false, true];
  }

  if (spec.type === "string") {
    const maxSize = typeof c.maxLength === "number" ? Math.max(1, c.maxLength) : 1;
    return ["", "x", "0".slice(0, maxSize)];
  }

  if (isNumericSpec(spec)) {
    const defaults = spec.type === "integer" || spec.type === "int"
      ? [0, 1, -1, 42, -42, Number.MAX_SAFE_INTEGER - 1]
      : [0, Number.EPSILON, 0.1, 0.2, 0.3, 1e-12, 1e6];
    const { min, max } = getNumericBounds(spec);
    const filtered = defaults.filter((value) => {
      if (!Number.isFinite(value)) return false;
      if (min !== undefined && value < min) return false;
      if (max !== undefined && value > max) return false;
      return true;
    });
    if (filtered.length > 0) {
      return [...new Set(filtered.map((value) => (spec.type === "integer" || spec.type === "int") ? Math.trunc(value) : value))];
    }
    const fallback: number[] = [];
    if (min !== undefined) fallback.push(spec.type === "integer" || spec.type === "int" ? Math.trunc(min) : min);
    if (max !== undefined) fallback.push(spec.type === "integer" || spec.type === "int" ? Math.trunc(max) : max);
    return fallback.length > 0 ? [...new Set(fallback)] : [spec.type === "integer" || spec.type === "int" ? 0 : 0.0];
  }

  if (spec.type === "array") {
    const elementType = c.element ?? c.elementType;
    const nestedSpec: GeneratorSpec = {
      type: typeof elementType === "string" ? elementType : "integer",
      constraints: {
        ...((c.elementMin ?? c.min) !== undefined ? { min: c.elementMin ?? c.min } : {}),
        ...((c.elementMax ?? c.max) !== undefined ? { max: c.elementMax ?? c.max } : {}),
        ...(c.elementMaxLength !== undefined ? { maxLength: c.elementMaxLength } : {}),
      },
    };
    const elementValues = buildCandidateValues(nestedSpec);
    const singleton = elementValues[0] ?? 0;
    const second = elementValues[1] ?? singleton;
    const maxLength = typeof c.maxLength === "number" ? c.maxLength : undefined;
    const arrays: unknown[] = [];
    if (maxLength === undefined || maxLength >= 0) arrays.push([]);
    if (maxLength === undefined || maxLength >= 1) arrays.push([singleton]);
    if (maxLength === undefined || maxLength >= 2) arrays.push([singleton, singleton]);
    if (maxLength === undefined || maxLength >= 2) arrays.push([singleton, second]);
    return arrays;
  }

  if (spec.type === "object") {
    const fields = c.fields;
    if (fields && typeof fields === "object") {
      const entries = Object.entries(fields as Record<string, unknown>);
      const obj: Record<string, unknown> = {};
      for (const [name, fieldSpec] of entries) {
        const fs = fieldSpec as { type: string; constraints?: Record<string, unknown> };
        const vals = buildCandidateValues({ type: fs.type, constraints: fs.constraints });
        obj[name] = vals[0] ?? null;
      }
      return [obj];
    }
    return [{}];
  }

  if (spec.type === "optional") {
    const inner = c.inner as { type: string; constraints?: Record<string, unknown> } | undefined;
    if (inner && typeof inner === "object" && typeof inner.type === "string") {
      const vals = buildCandidateValues({ type: inner.type, constraints: inner.constraints });
      return [undefined, vals[0] ?? null];
    }
    return [undefined, null];
  }

  if (spec.type === "enum") {
    const values = c.values;
    if (Array.isArray(values) && values.length > 0) {
      return values as readonly unknown[];
    }
    return [];
  }

  return [];
}

function buildCanaryCases(property: PropertyDefinition): readonly Record<string, unknown>[] {
  const entries = Object.entries(property.generators);
  if (entries.length === 0) {
    return [{}];
  }

  const candidates = entries.map(([name, spec]) => [name, buildCandidateValues(spec)] as const);
  if (candidates.some(([, values]) => values.length === 0)) {
    return [];
  }

  const baseline = Object.fromEntries(candidates.map(([name, values]) => [name, values[0]]));
  const cases: Record<string, unknown>[] = [baseline];
  const seen = new Set([JSON.stringify(baseline)]);

  for (const [name, values] of candidates) {
    for (const value of values.slice(1)) {
      const nextCase = { ...baseline, [name]: value };
      const key = JSON.stringify(nextCase);
      if (!seen.has(key)) {
        seen.add(key);
        cases.push(nextCase);
      }
      if (cases.length >= MAX_CANARY_CASES) {
        return cases;
      }
    }
  }

  return cases;
}

function buildConstantGenerators(input: Readonly<Record<string, unknown>>): Readonly<Record<string, GeneratorSpec>> {
  return Object.freeze(
    Object.fromEntries(
      Object.entries(input).map(([name, value]) => [name, { type: "constant", constraints: { value } }]),
    ),
  );
}

function findTopLevelOperator(expression: string, operators: readonly string[]): { readonly left: string; readonly operator: string; readonly right: string } | null {
  let depth = 0;
  let quote: '"' | "'" | "`" | null = null;
  let escaped = false;

  for (let i = 0; i < expression.length; i++) {
    const ch = expression[i];

    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        continue;
      }
      if (ch === quote) {
        quote = null;
      }
      continue;
    }

    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      continue;
    }
    if (ch === "(" || ch === "[" || ch === "{") {
      depth++;
      continue;
    }
    if (ch === ")" || ch === "]" || ch === "}") {
      depth = Math.max(0, depth - 1);
      continue;
    }

    if (depth === 0) {
      for (const operator of operators) {
        if (expression.startsWith(operator, i)) {
          return {
            left: expression.slice(0, i).trim(),
            operator,
            right: expression.slice(i + operator.length).trim(),
          };
        }
      }
    }
  }

  return null;
}

function weakenExactEquality(assertion: string): string | null {
  const match = findTopLevelOperator(assertion.trim(), ["!==", "==="]);
  if (!match || !match.left || !match.right) {
    return null;
  }
  return match.operator === "!=="
    ? `!approxEqual(${match.left}, ${match.right})`
    : `approxEqual(${match.left}, ${match.right})`;
}

function parseTinyTolerance(assertion: string): { readonly left: string; readonly right: string } | null {
  const trimmed = assertion.trim();
  if (!trimmed.startsWith("Math.abs(")) {
    return null;
  }
  const start = "Math.abs(".length;
  let depth = 0;
  let closeIndex = -1;
  for (let i = start; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (ch === "(") depth++;
    if (ch === ")") {
      if (depth === 0) {
        closeIndex = i;
        break;
      }
      depth--;
    }
  }
  if (closeIndex === -1) {
    return null;
  }

  const body = trimmed.slice(start, closeIndex).trim();
  const remainder = trimmed.slice(closeIndex + 1).trim();
  const toleranceMatch = remainder.match(/^(?:<|<=)\s*1e-(?:9|[1-9]\d+)$/i);
  if (!toleranceMatch) {
    return null;
  }

  const diff = findTopLevelOperator(body, ["-"]);
  if (!diff || !diff.left || !diff.right) {
    return null;
  }

  return {
    left: diff.left,
    right: diff.right,
  };
}

function weakenTinyTolerance(assertion: string): string | null {
  const parsed = parseTinyTolerance(assertion);
  if (!parsed) {
    return null;
  }
  return `approxEqual(${parsed.left}, ${parsed.right}, 1e-6, 1e-6)`;
}

function weakenMissingPrecondition(assertion: string): string | null {
  const trimmed = assertion.trim();
  if (!trimmed) {
    return null;
  }
  if (/\btry\b|\bcatch\b/.test(trimmed)) {
    return null;
  }
  return `(() => { try { return ${trimmed}; } catch { return true; } })()`;
}

function tightenWideNumericGenerators(generators: Readonly<Record<string, GeneratorSpec>>): Readonly<Record<string, GeneratorSpec>> {
  const next = Object.fromEntries(Object.entries(generators).map(([name, spec]) => {
    if (isNumericSpec(spec)) {
      const { min, max } = getNumericBounds(spec);
      if (min === undefined && max === undefined) {
        return [name, { ...spec, constraints: { ...(spec.constraints ?? {}), min: 0, max: 1_000_000 } }];
      }
      if (min !== undefined && max !== undefined && Math.abs(max - min) > 1_000_000) {
        return [name, { ...spec, constraints: { ...(spec.constraints ?? {}), min: Math.max(min, 0), max: Math.min(max, 1_000_000) } }];
      }
    }

    if (spec.type === "array") {
      const c = spec.constraints ?? {};
      const elementType = c.element ?? c.elementType;
      if (elementType === "float" || elementType === "number" || elementType === "integer" || elementType === "int") {
        const min = typeof (c.elementMin ?? c.min) === "number" ? Number(c.elementMin ?? c.min) : undefined;
        const max = typeof (c.elementMax ?? c.max) === "number" ? Number(c.elementMax ?? c.max) : undefined;
        if (min === undefined && max === undefined) {
          return [name, { ...spec, constraints: { ...c, elementMin: 0, elementMax: 1_000_000 } }];
        }
        if (min !== undefined && max !== undefined && Math.abs(max - min) > 1_000_000) {
          return [name, { ...spec, constraints: { ...c, elementMin: Math.max(min, 0), elementMax: Math.min(max, 1_000_000) } }];
        }
      }
    }

    return [name, spec];
  }));
  return Object.freeze(next);
}

function refreshRiskMetadata(property: PropertyDefinition): PropertyDefinition {
  const preservedTags = property.riskTags.filter((tag) => tag === "doc_domain_mismatch" || tag === "missing_precondition");
  const riskTags = [...new Set([...detectRiskTags(property), ...preservedTags])];
  return {
    ...property,
    riskTags,
    riskScore: computeRiskScore(property, property.score, riskTags),
  };
}

export function autoWeakenProperty(property: PropertyDefinition): PropertyDefinition | null {
  if (property.status === "refined") {
    return null;
  }

  let assertion = property.assertion;
  let generators = property.generators;
  let changed = false;

  if (property.riskTags.includes("float_exact_equality")) {
    const weakened = weakenExactEquality(assertion);
    if (weakened && weakened !== assertion) {
      assertion = weakened;
      changed = true;
    }
  }

  if (property.riskTags.includes("tiny_abs_tolerance")) {
    const weakened = weakenTinyTolerance(assertion);
    if (weakened && weakened !== assertion) {
      assertion = weakened;
      changed = true;
    }
  }

  if (property.riskTags.includes("wide_numeric_domain")) {
    const tightened = tightenWideNumericGenerators(generators);
    if (JSON.stringify(tightened) !== JSON.stringify(generators)) {
      generators = tightened;
      changed = true;
    }
  }

  if (property.riskTags.includes("missing_precondition")) {
    const weakened = weakenMissingPrecondition(assertion);
    if (weakened && weakened !== assertion) {
      assertion = weakened;
      changed = true;
    }
  }

  if (!changed) {
    return null;
  }

  return refreshRiskMetadata({
    ...property,
    assertion,
    generators,
    status: "refined",
  });
}

function detectDocDomainRiskTags(property: PropertyDefinition, context: AnalysisContext): readonly PropertyRiskTag[] {
  const functionName = property.targetFunction.split(".").pop() ?? property.targetFunction;
  const doc = context.signals.doc.find((entry) => entry.functionName === property.targetFunction || entry.functionName === functionName);
  if (!doc) {
    return [];
  }

  for (const [paramName, spec] of Object.entries(property.generators)) {
    const docText = doc.paramDocs[paramName]?.toLowerCase();
    if (!docText || !isNumericSpec(spec)) continue;
    const { min, max } = getNumericBounds(spec);
    const mentionsPercentageRange = /0\s*(?:-|to)\s*100|0-100|0 to 100|percentage|percent/.test(docText);
    const mentionsNonNegative = /non-negative|nonnegative|>=\s*0|positive/.test(docText);
    if (mentionsPercentageRange && (min !== 0 || max !== 100)) {
      return ["doc_domain_mismatch"];
    }
    if (mentionsNonNegative && min === undefined) {
      return ["doc_domain_mismatch"];
    }
  }

  return [];
}

function applyRiskMetadata(properties: readonly PropertyDefinition[], context: AnalysisContext): readonly PropertyDefinition[] {
  return properties.map((property) => {
    const riskTags = [...new Set([...property.riskTags, ...detectDocDomainRiskTags(property, context)])];
    return {
      ...property,
      riskTags,
      riskScore: computeRiskScore(property, property.score, riskTags),
      status: riskTags.length > 0 ? "risky" : "accepted",
    };
  });
}

export async function canaryValidateProperties(
  properties: readonly PropertyDefinition[],
  targetPath: string,
  storeDir: string,
  language: TrialRunLanguage,
): Promise<{ readonly validated: readonly PropertyDefinition[]; readonly quarantined: readonly { prop: PropertyDefinition; reason: string }[] }> {
  const testsDir = path.join(storeDir, "tests");
  await fs.mkdir(testsDir, { recursive: true });

  const canaryConfig: RunConfig = {
    mode: "quick",
    iterations: 1,
    timeout: 15_000,
    verbose: false,
  };

  const validated: PropertyDefinition[] = [];
  const quarantined: { prop: PropertyDefinition; reason: string }[] = [];

  for (const property of properties) {
    if (property.riskTags.length === 0) {
      validated.push({
        ...property,
        validation: buildValidationEvidence(100, 0),
      });
      continue;
    }

    const canaryCases = buildCanaryCases(property);
    if (canaryCases.length === 0) {
      validated.push({
        ...property,
        status: property.status === "refined" ? "refined" : "risky",
        validation: buildValidationEvidence(100, 0),
      });
      continue;
    }

    let canaryPasses = 0;
    let failureReason: string | null = null;

    for (const input of canaryCases) {
      const canaryProperty: PropertyDefinition = {
        ...property,
        generators: buildConstantGenerators(input),
      };
      const result = await executeTrialRun([canaryProperty], targetPath, testsDir, canaryConfig, language);
      const failed = result.failed[0];
      const error = result.errors[0];
      if (failed || error) {
        failureReason = failed?.errorMessage ?? error?.errorMessage ?? `canary failed for ${JSON.stringify(input)}`;
        break;
      }
      canaryPasses++;
    }

    if (failureReason) {
      const weakened = autoWeakenProperty(property);
      if (weakened) {
        const rerun = await canaryValidateProperties([weakened], targetPath, storeDir, language);
        if (rerun.validated.length > 0) {
          validated.push(rerun.validated[0]);
          continue;
        }
        if (rerun.quarantined.length > 0) {
          quarantined.push(rerun.quarantined[0]);
          continue;
        }
      }

      quarantined.push({
        prop: {
          ...property,
          status: "quarantined",
          validation: buildValidationEvidence(100, canaryPasses),
        },
        reason: failureReason,
      });
      continue;
    }

    validated.push({
      ...property,
      status: property.status === "refined" ? "refined" : "risky",
      validation: buildValidationEvidence(100, canaryPasses),
    });
  }

  return { validated, quarantined };
}

async function executeTrialRun(
  properties: readonly PropertyDefinition[],
  targetPath: string,
  testsDir: string,
  config: RunConfig,
  language: TrialRunLanguage,
): Promise<ExecutionResult> {
  const generated = language === "python"
    ? generateHypothesisTest(properties, targetPath, testsDir, config)
    : generateFastCheckTest(properties, targetPath, testsDir, config);

  const testFilePath = path.join(testsDir, generated.fileName);
  await fs.writeFile(testFilePath, generated.content, "utf8");

  try {
    return language === "python"
      ? await runHypothesisTest(testFilePath, properties, config)
      : await runFastCheckTest(testFilePath, properties, config);
  } finally {
    try {
      await fs.unlink(testFilePath);
    } catch {
      // ignore cleanup failures
    }
  }
}

async function trialRunValidation(
  properties: readonly PropertyDefinition[],
  targetPath: string,
  storeDir: string,
  sourceCode: string,
  llmClient: LlmClient | null,
  isMock: boolean,
  language: TrialRunLanguage,
): Promise<{ readonly validated: readonly PropertyDefinition[]; readonly dropped: readonly { prop: PropertyDefinition; reason: string }[]; readonly repaired: number }> {
  const testsDir = path.join(storeDir, "tests");
  await fs.mkdir(testsDir, { recursive: true });

  const trialConfig: RunConfig = {
    mode: "quick",
    iterations: 100,
    timeout: 15_000,
    verbose: false,
  };

  // Mutable working set — properties that may be repaired across rounds
  let currentProperties = [...properties];
  const validated: PropertyDefinition[] = [];
  const dropped: { prop: PropertyDefinition; reason: string }[] = [];
  let totalRepaired = 0;

  for (let round = 0; round <= MAX_REPAIR_ROUNDS; round++) {
    if (currentProperties.length === 0) break;

    const result = await executeTrialRun(
      currentProperties,
      targetPath,
      testsDir,
      trialConfig,
      language,
    );

    // Classify results
    const passedIds = new Set(result.passed.map((p) => p.propertyId));
    const failedIds = new Set(result.failed.map((f) => f.propertyId));
    const errorIds = new Set(result.errors.map((e) => e.propertyId));

    const needsRepair: PropertyDefinition[] = [];

    for (const prop of currentProperties) {
      if (passedIds.has(prop.id)) {
        validated.push(prop);
      } else if (failedIds.has(prop.id)) {
        if (round < MAX_REPAIR_ROUNDS) {
          const weakened = autoWeakenProperty(prop);
          if (weakened) {
            needsRepair.push(weakened);
            totalRepaired++;
            console.log(`    ↻ Adjusting: ${prop.targetFunction}: ${prop.description} — too strict, relaxing... (attempt ${round + 1})`);
            continue;
          }
        }
        // Found a real bug — keep it
        validated.push(prop);
      } else if (errorIds.has(prop.id)) {
        const err = result.errors.find((e) => e.propertyId === prop.id);
        const errorMsg = err?.errorMessage ?? "unknown error";

        if (round < MAX_REPAIR_ROUNDS) {
          // Attempt repair
          const funcSig = `${prop.targetFunction}(...)`;

          let repaired: PropertyDefinition | null = null;

          if (isMock) {
            repaired = mockRepairProperty(prop, errorMsg);
          } else if (llmClient) {
            repaired = await repairProperty(llmClient, prop, errorMsg, sourceCode, funcSig);
          }

          if (repaired) {
            // Use repaired version for next round
            needsRepair.push(repaired);
            totalRepaired++;
            console.log(`    ↻ Repairing: ${prop.targetFunction}: ${prop.description} (round ${round + 1})`);
          } else {
            // Repair failed — drop
            dropped.push({ prop, reason: `codegen error (repair failed round ${round + 1}): ${errorMsg}` });
          }
        } else {
          // Max rounds reached — drop
          dropped.push({ prop, reason: `codegen error (max ${MAX_REPAIR_ROUNDS} repairs): ${errorMsg}` });
        }
      } else {
        // No result at all
        dropped.push({ prop, reason: "no output from trial run" });
      }
    }

    // Next round only processes properties that needed repair
    currentProperties = needsRepair;
  }

  return { validated, dropped, repaired: totalRepaired };
}

export async function inferCommand(
  target: string,
  options: InferOptions,
): Promise<void> {
  const projectRoot = process.cwd();

  // Load config
  const config = loadConfig(projectRoot, {
    mock: options.mock,
    model: options.model,
    provider: options.provider as "anthropic" | "openai-compatible" | undefined,
    baseURL: options.baseUrl,
  });

  // Resolve target with path traversal protection — BEFORE config validation
  // so "file not found" is shown instead of "API key missing"
  const targetPath = path.resolve(projectRoot, target);
  if (!targetPath.startsWith(projectRoot + path.sep) && targetPath !== projectRoot) {
    console.error(`\n  Error: Target file must be within the project root.\n`);
    process.exit(2);
  }

  try {
    await fs.access(targetPath);
  } catch {
    console.error(`\n  Error: File not found: ${target}\n`);
    process.exit(2);
  }

  // Detect language early — before config validation
  const language = detectLanguage(targetPath);
  if (!language || !["typescript", "javascript", "python"].includes(language)) {
    console.error(`\n  Error: Unsupported file type. Supported: .ts, .tsx, .js, .jsx, .py\n`);
    process.exit(2);
  }

  // Validate config (API key etc.) — after file checks pass
  const errors = validateConfig(config, "infer");
  if (errors.length > 0) {
    for (const err of errors) {
      console.error(`\n  Error: ${err}\n`);
    }
    process.exit(2);
  }

  // Ensure .propcheck/ exists
  await initStore(projectRoot, config.storeDir);
  const storeDir = path.join(projectRoot, config.storeDir);

  // Guard against excessively large files (prevent unbounded API spend)
  const MAX_SOURCE_BYTES = 500_000;
  const stat = await fs.stat(targetPath);
  if (stat.size > MAX_SOURCE_BYTES) {
    console.error(`\n  Error: File too large (${stat.size} bytes). Max: ${MAX_SOURCE_BYTES} bytes.\n`);
    process.exit(2);
  }

  // Read and parse
  const source = await fs.readFile(targetPath, "utf8");
  const context: AnalysisContext = language === "python"
    ? analyzePythonFile(targetPath, source)
    : analyzeFile(targetPath, source, language);

  // Filter to specific functions if --function provided
  let inferContext = context;
  if (options.function) {
    const names = options.function.split(",").map((n) => n.trim()).filter(Boolean);

    // Validate all names exist
    const missing = names.filter(
      (name) => !context.functions.some((fn) => matchesFunctionName(fn, name)),
    );
    if (missing.length > 0) {
      const available = context.functions.map((fn) => fn.qualifiedName).join(", ");
      console.error(`\n  Error: Function(s) not found: ${missing.join(", ")}`);
      console.error(`  Available: ${available}\n`);
      process.exit(2);
    }

    inferContext = filterContextByFunctions(context, names);
  }

  if (inferContext.functions.length === 0) {
    console.log(`\n  No exported functions found in ${target}\n`);
    return;
  }

  console.log(`\n  Analyzing ${inferContext.functions.length} function${inferContext.functions.length === 1 ? "" : "s"} in ${target}...`);

  // Parse and validate numeric options
  const maxPropsRaw = parseInt(options.maxProperties ?? "5", 10);
  if (options.maxProperties !== undefined && isNaN(maxPropsRaw)) {
    console.error(`\n  Error: --max-properties must be a number, got "${options.maxProperties}"\n`);
    process.exit(2);
  }
  const maxProperties = Math.min(Math.max(1, maxPropsRaw || 5), 20);

  const minScoreRaw = parseInt(options.minScore ?? "10", 10);
  if (options.minScore !== undefined && isNaN(minScoreRaw)) {
    console.error(`\n  Error: --min-score must be a number, got "${options.minScore}"\n`);
    process.exit(2);
  }
  const minScore = Math.min(Math.max(0, minScoreRaw || 10), 15);

  // Infer properties
  let result;
  try {
    result = await inferProperties(config.apiKey, config.model, inferContext, {
      maxProperties,
      minScore,
      mock: config.mock,
      provider: config.provider,
      baseURL: config.baseURL,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("API key") || msg.includes("AUTH_ERROR")) {
      console.error(`\n  Error: Invalid API key. Check your PROPCHECK_API_KEY or ANTHROPIC_API_KEY.\n`);
    } else {
      console.error(`\n  Error: LLM API call failed: ${msg}\n`);
    }
    process.exit(1);
  }

  result = {
    ...result,
    properties: applyRiskMetadata(result.properties, inferContext),
  };

  if (result.properties.length === 0) {
    console.log("  No properties inferred (all filtered out by quality scoring).\n");
    return;
  }

  // Trial-run validation with self-repair
  let finalProperties = result.properties;
  if (!options.skipValidation) {
    const testsDir = path.join(storeDir, "tests");
    await fs.mkdir(testsDir, { recursive: true });

    console.log(`  Validating ${result.properties.length} rules (quick test, 100 random inputs each)...`);

    // Create LLM client for self-repair (reuse same config)
    const llmClient = config.mock
      ? null
      : config.apiKey
        ? createClient(config.apiKey, config.model, config.provider, config.baseURL)
        : null;

    const { validated, dropped, repaired } = await trialRunValidation(
      result.properties,
      targetPath,
      storeDir,
      source,
      llmClient,
      config.mock,
      language as TrialRunLanguage,
    );

    if (repaired > 0) {
      console.log(`  Fixed ${repaired} rule${repaired === 1 ? "" : "s"} that ${repaired === 1 ? "was" : "were"} too strict.`);
    }

    if (dropped.length > 0) {
      console.log(`  Dropped ${dropped.length} properties during validation:`);
      for (const { prop, reason } of dropped) {
        console.log(`    - ${prop.targetFunction}: ${prop.description} [${reason}]`);
      }
    }

    const { validated: canaryValidated, quarantined } = await canaryValidateProperties(
      validated,
      targetPath,
      storeDir,
      language as TrialRunLanguage,
    );

    if (quarantined.length > 0) {
      console.log(`  Quarantined ${quarantined.length} fragile propert${quarantined.length === 1 ? "y" : "ies"} after edge-case validation:`);
      for (const { prop, reason } of quarantined) {
        console.log(`    - ${prop.targetFunction}: ${prop.description} [${reason.length > 80 ? reason.slice(0, 77) + "..." : reason}]`);
      }
    }

    finalProperties = [...canaryValidated, ...quarantined.map(({ prop }) => prop)];

    if (finalProperties.length === 0) {
      console.log("  No properties survived validation.\n");
      return;
    }

    const activeProperties = finalProperties.filter((property) => property.status !== "quarantined");

    // Refinement loop (Round 2) — strengthen weak properties, explore bug areas
    if (options.refine && activeProperties.length > 0) {
      console.log(`\n  Refinement Round 2: analyzing ${activeProperties.length} properties...`);

      // Run a full execution to classify
      const fullConfig: RunConfig = { mode: "quick", iterations: 100, timeout: 15_000, verbose: false };
      const execResult = await executeTrialRun(
        activeProperties,
        targetPath,
        testsDir,
        fullConfig,
        language as TrialRunLanguage,
      );

      // Classify results
      const classifications = classifyProperties(activeProperties, execResult);
      const functionNames = inferContext.functions.map((f) => f.qualifiedName);
      const feedback = buildFeedbackSummary(classifications, functionNames);

      const strong = classifications.filter((c) => c.kind === "strong");
      const weak = classifications.filter((c) => c.kind === "weak");
      const bugs = classifications.filter((c) => c.kind === "bug_found");

      console.log(`    Strong: ${strong.length} | Weak: ${weak.length} | Bugs: ${bugs.length}`);

      // Generate improved properties for weak/bug cases
      if (weak.length > 0 || bugs.length > 0) {
        let improvedProperties: readonly PropertyDefinition[];

        if (config.mock) {
          improvedProperties = applyRiskMetadata(mockRefineProperties(classifications), inferContext);
        } else if (llmClient) {
          const refineResult = await refineProperties(config.apiKey, config.model, inferContext, feedback, {
            maxProperties,
            minScore,
            mock: false,
            provider: config.provider,
            baseURL: config.baseURL,
          });
          improvedProperties = applyRiskMetadata(refineResult.properties, inferContext);
        } else {
          improvedProperties = [];
        }

        if (improvedProperties.length > 0) {
          console.log(`    Generated ${improvedProperties.length} improved properties`);

          // Validate improved properties with trial-run
          const { validated: improvedValidated } = await trialRunValidation(
            improvedProperties,
            targetPath,
            storeDir,
            source,
            llmClient,
            config.mock,
            language as TrialRunLanguage,
          );
          const { validated: improvedCanaryValidated, quarantined: improvedQuarantined } = await canaryValidateProperties(
            improvedValidated,
            targetPath,
            storeDir,
            language as TrialRunLanguage,
          );

          // Merge: keep strong originals + replace weak with improved + keep bug-finders
          const strongProps = classifications
            .filter((c) => c.kind === "strong" || c.kind === "bug_found")
            .map((c) => c.property);

          const quarantinedProps = finalProperties.filter((property) => property.status === "quarantined");

          // Deduplicate by assertion
          const existingAssertions = new Set(strongProps.map((p) => p.assertion));
          const improvedCombined = [...improvedCanaryValidated, ...improvedQuarantined.map(({ prop }) => prop)];
          const newUnique = improvedCombined.filter((p) => !existingAssertions.has(p.assertion));

          finalProperties = [...strongProps, ...newUnique, ...quarantinedProps];
          console.log(`    Final: ${finalProperties.length} properties after refinement`);
        }
      } else {
        console.log(`    All properties are strong — no refinement needed`);
      }
    }
  }

  // Persist to .propcheck/
  const moduleKey = toForwardSlash(path.relative(projectRoot, targetPath));
  const propertySet: PropertySet = {
    schemaVersion: 2,
    module: moduleKey,
    filePath: moduleKey,
    properties: finalProperties,
    sourceHash: hashContent(source),
    inferredAt: new Date().toISOString(),
  };

  await setProperties(storeDir, moduleKey, propertySet);

  // Report (use finalProperties count, not original)
  const finalResult = { ...result, properties: finalProperties };
  reportInferResult(finalResult, moduleKey);
}
