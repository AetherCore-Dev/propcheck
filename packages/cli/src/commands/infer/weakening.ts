/**
 * Property weakening and risk metadata — auto-relax fragile assertions.
 *
 * Extracted from infer.ts for maintainability.
 */

import { deepEqual } from "@propcheck/common";
import { detectRiskTags, computeRiskScore } from "@propcheck/llm";
import type {
  PropertyDefinition,
  AnalysisContext,
  GeneratorSpec,
  PropertyRiskTag,
} from "@propcheck/common";

export function isNumericSpec(spec: GeneratorSpec): boolean {
  return spec.type === "float" || spec.type === "number" || spec.type === "integer" || spec.type === "int";
}

export function getNumericBounds(spec: GeneratorSpec): { readonly min?: number; readonly max?: number } {
  const c = spec.constraints ?? {};
  const min = typeof c.min === "number" ? c.min : undefined;
  const max = typeof c.max === "number" ? c.max : undefined;
  return { ...(min !== undefined ? { min } : {}), ...(max !== undefined ? { max } : {}) };
}

function findTopLevelOperator(expression: string, operators: readonly string[]): { readonly left: string; readonly operator: string; readonly right: string } | null {
  let depth = 0;
  let quote: '"' | "'" | "`" | null = null;
  let escaped = false;

  for (let i = 0; i < expression.length; i++) {
    const ch = expression[i];

    if (quote) {
      if (escaped) { escaped = false; continue; }
      if (ch === "\\") { escaped = true; continue; }
      if (ch === quote) { quote = null; }
      continue;
    }

    if (ch === '"' || ch === "'" || ch === "`") { quote = ch; continue; }
    if (ch === "(" || ch === "[" || ch === "{") { depth++; continue; }
    if (ch === ")" || ch === "]" || ch === "}") { depth = Math.max(0, depth - 1); continue; }

    if (depth === 0) {
      for (const operator of operators) {
        if (expression.startsWith(operator, i)) {
          return { left: expression.slice(0, i).trim(), operator, right: expression.slice(i + operator.length).trim() };
        }
      }
    }
  }

  return null;
}

function weakenExactEquality(assertion: string): string | null {
  const match = findTopLevelOperator(assertion.trim(), ["!==", "==="]);
  if (!match || !match.left || !match.right) return null;
  return match.operator === "!==" ? `!approxEqual(${match.left}, ${match.right})` : `approxEqual(${match.left}, ${match.right})`;
}

function parseTinyTolerance(assertion: string): { readonly left: string; readonly right: string } | null {
  const trimmed = assertion.trim();
  if (!trimmed.startsWith("Math.abs(")) return null;
  const start = "Math.abs(".length;
  let depth = 0;
  let closeIndex = -1;
  for (let i = start; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (ch === "(") depth++;
    if (ch === ")") { if (depth === 0) { closeIndex = i; break; } depth--; }
  }
  if (closeIndex === -1) return null;

  const body = trimmed.slice(start, closeIndex).trim();
  const remainder = trimmed.slice(closeIndex + 1).trim();
  if (!/^(?:<|<=)\s*1e-(?:9|[1-9]\d+)$/i.test(remainder)) return null;

  const diff = findTopLevelOperator(body, ["-"]);
  if (!diff || !diff.left || !diff.right) return null;
  return { left: diff.left, right: diff.right };
}

function weakenTinyTolerance(assertion: string): string | null {
  const parsed = parseTinyTolerance(assertion);
  if (!parsed) return null;
  return `approxEqual(${parsed.left}, ${parsed.right}, 1e-6, 1e-6)`;
}

function weakenMissingPrecondition(assertion: string): string | null {
  const trimmed = assertion.trim();
  if (!trimmed) return null;
  if (/\btry\b|\bcatch\b/.test(trimmed)) return null;
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
        const eMin = typeof (c.elementMin ?? c.min) === "number" ? Number(c.elementMin ?? c.min) : undefined;
        const eMax = typeof (c.elementMax ?? c.max) === "number" ? Number(c.elementMax ?? c.max) : undefined;
        if (eMin === undefined && eMax === undefined) {
          return [name, { ...spec, constraints: { ...c, elementMin: 0, elementMax: 1_000_000 } }];
        }
        if (eMin !== undefined && eMax !== undefined && Math.abs(eMax - eMin) > 1_000_000) {
          return [name, { ...spec, constraints: { ...c, elementMin: Math.max(eMin, 0), elementMax: Math.min(eMax, 1_000_000) } }];
        }
      }
    }
    return [name, spec];
  }));
  return Object.freeze(next);
}

function refreshRiskMetadata(property: PropertyDefinition): PropertyDefinition {
  const preservedTags = property.riskTags.filter((tag) => tag === "doc_domain_mismatch" || tag === "missing_precondition" || tag === "spec_code_conflict");
  const riskTags = [...new Set([...detectRiskTags(property), ...preservedTags])];
  return { ...property, riskTags, riskScore: computeRiskScore(property, property.score, riskTags) };
}

export function autoWeakenProperty(property: PropertyDefinition): PropertyDefinition | null {
  if (property.status === "refined") return null;

  let assertion = property.assertion;
  let generators = property.generators;
  let changed = false;

  if (property.riskTags.includes("float_exact_equality")) {
    const weakened = weakenExactEquality(assertion);
    if (weakened && weakened !== assertion) { assertion = weakened; changed = true; }
  }
  if (property.riskTags.includes("tiny_abs_tolerance")) {
    const weakened = weakenTinyTolerance(assertion);
    if (weakened && weakened !== assertion) { assertion = weakened; changed = true; }
  }
  if (property.riskTags.includes("wide_numeric_domain")) {
    const tightened = tightenWideNumericGenerators(generators);
    if (!deepEqual(tightened, generators)) { generators = tightened; changed = true; }
  }
  if (property.riskTags.includes("missing_precondition")) {
    const weakened = weakenMissingPrecondition(assertion);
    if (weakened && weakened !== assertion) { assertion = weakened; changed = true; }
  }

  if (!changed) return null;
  return refreshRiskMetadata({ ...property, assertion, generators, status: "refined" });
}

export function detectDocDomainRiskTags(property: PropertyDefinition, context: AnalysisContext): readonly PropertyRiskTag[] {
  const functionName = property.targetFunction.split(".").pop() ?? property.targetFunction;
  const doc = context.signals.doc.find((entry) => entry.functionName === property.targetFunction || entry.functionName === functionName);
  if (!doc) return [];

  for (const [paramName, spec] of Object.entries(property.generators)) {
    const docText = doc.paramDocs[paramName]?.toLowerCase();
    if (!docText || !isNumericSpec(spec)) continue;
    const { min, max } = getNumericBounds(spec);
    if (/0\s*(?:-|to)\s*100|0-100|0 to 100|percentage|percent/.test(docText) && (min !== 0 || max !== 100)) return ["doc_domain_mismatch"];
    if (/non-negative|nonnegative|>=\s*0|positive/.test(docText) && min === undefined) return ["doc_domain_mismatch"];
  }
  return [];
}

function findMatchingSpecSignal(property: PropertyDefinition, context: AnalysisContext) {
  const functionName = property.targetFunction.split(".").pop() ?? property.targetFunction;
  return context.spec?.functions.find(
    (entry) => entry.functionName === property.targetFunction || entry.functionName === functionName,
  );
}

function violatesSpecRange(spec: GeneratorSpec, minValue: number, maxValue: number): boolean {
  if (isNumericSpec(spec)) {
    const { min, max } = getNumericBounds(spec);
    return min === undefined || max === undefined || min < minValue || max > maxValue;
  }

  if (spec.type === "array") {
    const c = spec.constraints ?? {};
    const elementType = c.element ?? c.elementType;
    if (elementType === "float" || elementType === "number" || elementType === "integer" || elementType === "int") {
      const min = typeof (c.elementMin ?? c.min) === "number" ? Number(c.elementMin ?? c.min) : undefined;
      const max = typeof (c.elementMax ?? c.max) === "number" ? Number(c.elementMax ?? c.max) : undefined;
      return min === undefined || max === undefined || min < minValue || max > maxValue;
    }
  }

  return false;
}

function detectSpecRiskTags(property: PropertyDefinition, context: AnalysisContext): readonly PropertyRiskTag[] {
  const specSignal = findMatchingSpecSignal(property, context);
  if (!specSignal) return [];

  const hasConstraintConflict = specSignal.constraints.some((constraint) => {
    if (constraint.kind === "non-negative" || constraint.kind === "positive") {
      return property.assertion.includes("< 0") || property.assertion.includes("<= -") || /negative/i.test(property.description);
    }
    if (constraint.kind === "range" && constraint.min !== undefined && constraint.max !== undefined) {
      return Object.values(property.generators).some((spec) => violatesSpecRange(spec, constraint.min!, constraint.max!));
    }
    return false;
  });

  return hasConstraintConflict ? ["spec_code_conflict"] : [];
}

export function applyRiskMetadata(properties: readonly PropertyDefinition[], context: AnalysisContext): readonly PropertyDefinition[] {
  return properties.map((property) => {
    const specSignal = findMatchingSpecSignal(property, context);
    const evidenceSource = specSignal && property.evidenceSource === "code"
      ? "mixed"
      : property.evidenceSource;
    const riskTags = [...new Set([
      ...property.riskTags,
      ...detectDocDomainRiskTags(property, context),
      ...detectSpecRiskTags(property, context),
    ])];
    return {
      ...property,
      evidenceSource,
      riskTags,
      riskScore: computeRiskScore(property, property.score, riskTags),
      status: riskTags.length > 0 ? "risky" as const : "accepted" as const,
    };
  });
}
