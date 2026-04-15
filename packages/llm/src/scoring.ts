/**
 * Property quality scoring — 13-point rubric.
 *
 * Filters out tautologies, redundant, and low-quality properties.
 */

import type { PropertyDefinition, PropertyRiskTag } from "@propcheck/common";

const TAUTOLOGY_PATTERNS = [
  /^true$/i,
  /^x\s*===?\s*x$/,
  /^result\s*===?\s*result$/,
  /^typeof\s+\w+\s*(!==?|===?)\s*['"]undefined['"]\s*$/,
];

/**
 * Detect identity tautologies: f(x) === f(x) where both sides are the same call.
 * JavaScript always evaluates the same expression to the same value within
 * a single execution, so this tests nothing.
 */
function isIdentityTautology(assertion: string): boolean {
  const trimmed = assertion.trim();

  // Direct pattern: expr === expr
  const eqMatch = trimmed.match(/^(.+?)\s*===\s*(.+?)$/);
  if (eqMatch) {
    const lhs = eqMatch[1].trim();
    const rhs = eqMatch[2].trim();
    if (lhs === rhs) return true;
  }

  // IIFE wrapped: (() => { return expr === expr; })()
  const iifeMatch = trimmed.match(/return\s+(.+?)\s*===\s*(.+?)\s*;?\s*\}\s*\)\s*\(\s*\)$/);
  if (iifeMatch) {
    const lhs = iifeMatch[1].trim();
    const rhs = iifeMatch[2].trim();
    if (lhs === rhs) return true;
  }

  return false;
}

/**
 * Detect typeof assertions for TypeScript-declared return types.
 * These are trivial because the type system already guarantees them.
 * Only matches when typeof check is the SOLE content of the assertion
 * (not part of a larger expression with && or ||).
 */
function isTypeofTrivial(assertion: string): boolean {
  const trimmed = assertion.trim();
  // Unwrap IIFE: (() => { return EXPR; })()
  const iifeMatch = trimmed.match(/^\(\(\)\s*=>\s*\{\s*return\s+(.*?);?\s*\}\s*\)\s*\(\s*\)$/s);
  const inner = iifeMatch ? iifeMatch[1].trim() : trimmed;
  // Check if the entire (unwrapped) assertion is just a typeof check
  return /^typeof\s+.+\s*===?\s*["'][a-z]+["']\s*$/.test(inner);
}

function hasFloatLikeGenerator(property: PropertyDefinition): boolean {
  return Object.values(property.generators).some((spec) => {
    if (spec.type === "float" || spec.type === "number") {
      return true;
    }
    if (spec.type === "array") {
      const c = spec.constraints ?? {};
      return c.element === "float" || c.element === "number" || c.elementType === "float" || c.elementType === "number";
    }
    return false;
  });
}

const FRAGILITY_PENALTIES: Readonly<Record<PropertyRiskTag, number>> = {
  float_exact_equality: 2,
  tiny_abs_tolerance: 1,
  missing_precondition: 0,
  wide_numeric_domain: 0,
  doc_domain_mismatch: 0,
  spec_code_conflict: 0,
  roundtrip_numeric_fragility: 2,
  metamorphic_scale_risk: 0,
};

const RISK_PENALTIES: Readonly<Record<PropertyRiskTag, number>> = {
  float_exact_equality: 3,
  tiny_abs_tolerance: 2,
  missing_precondition: 1,
  wide_numeric_domain: 2,
  doc_domain_mismatch: 2,
  spec_code_conflict: 3,
  roundtrip_numeric_fragility: 3,
  metamorphic_scale_risk: 1,
};

function hasWideNumericDomain(property: PropertyDefinition): boolean {
  return Object.values(property.generators).some((spec) => {
    const c = spec.constraints ?? {};
    if (spec.type === "float" || spec.type === "number" || spec.type === "integer" || spec.type === "int") {
      if (c.min === undefined && c.max === undefined) return true;
      if (typeof c.min === "number" && typeof c.max === "number") {
        return Math.abs(c.max - c.min) > 1_000_000;
      }
      return false;
    }
    if (spec.type === "array") {
      const elementType = c.element ?? c.elementType;
      const min = c.elementMin ?? c.min;
      const max = c.elementMax ?? c.max;
      if (elementType === "float" || elementType === "number" || elementType === "integer" || elementType === "int") {
        if (min === undefined && max === undefined) return true;
        if (typeof min === "number" && typeof max === "number") {
          return Math.abs(max - min) > 1_000_000;
        }
      }
    }
    return false;
  });
}

export function detectRiskTags(property: PropertyDefinition): readonly PropertyRiskTag[] {
  const assertion = property.assertion.trim();
  const tags = new Set<PropertyRiskTag>();

  if (
    hasFloatLikeGenerator(property) &&
    /(===|!==)/.test(assertion) &&
    !assertion.includes("Math.abs(") &&
    !assertion.includes("approxEqual(")
  ) {
    tags.add("float_exact_equality");
  }

  if (/(<|<=)\s*1e-(9|[1-9]\d+)/i.test(assertion)) {
    tags.add("tiny_abs_tolerance");
  }

  if (
    /(parseFloat|parseInt|JSON\.parse)\s*\(/.test(assertion) &&
    /(===|!==)/.test(assertion)
  ) {
    tags.add("roundtrip_numeric_fragility");
  }

  if (hasWideNumericDomain(property)) {
    tags.add("wide_numeric_domain");
  }

  if (
    property.category === "boundary" &&
    /(>=\s*0|>\s*0|<=\s*0|<\s*0|between|within)/i.test(assertion) &&
    !/(requires|precondition|assume|if\s*\()/i.test(assertion)
  ) {
    tags.add("missing_precondition");
  }

  if (
    property.category === "metamorphic" &&
    hasFloatLikeGenerator(property) &&
    !/(Math\.abs|approx|tolerance|epsilon)/i.test(assertion)
  ) {
    tags.add("metamorphic_scale_risk");
  }

  return [...tags];
}

function detectFragility(property: PropertyDefinition): number {
  return detectRiskTags(property).reduce((sum, tag) => sum + FRAGILITY_PENALTIES[tag], 0);
}

export function computeRiskScore(property: PropertyDefinition, score: number, riskTags: readonly PropertyRiskTag[]): number {
  const penalty = riskTags.reduce((sum, tag) => sum + RISK_PENALTIES[tag], 0);
  return Math.max(0, score - penalty);
}

/**
 * Score a property from 0-13.
 *
 * Rubric:
 * - (2 pts) Assertion is non-empty and references target function
 * - (2 pts) Generators defined for all expected parameters
 * - (2 pts) Confidence > 0.5
 * - (2 pts) Evidence is non-empty and meaningful
 * - (2 pts) NOT a tautology
 * - (2 pts) NOT trivial (not just a typeof check)
 * - (1 pt) Has 3 seed inputs
 * - (-1 to -5 pts) Penalize fragile float/roundtrip assertions likely to cause false positives
 */
export function scoreProperty(property: PropertyDefinition): number {
  let score = 0;

  // (2 pts) Assertion references target function
  const funcName = property.targetFunction.split(".").pop() ?? "";
  if (
    property.assertion.length > 0 &&
    funcName.length > 0 &&
    property.assertion.includes(funcName)
  ) {
    score += 2;
  }

  // (2 pts) Generators defined
  const genCount = Object.keys(property.generators).length;
  if (genCount > 0) {
    score += 2;
  }

  // (2 pts) Confidence
  if (property.confidence > 0.5) {
    score += 2;
  }

  // (2 pts) Evidence
  if (property.evidence.length > 10) {
    score += 2;
  }

  if (property.evidenceSource === "spec" || property.evidenceSource === "mixed") {
    score += 1;
  }

  // (2 pts) Not a tautology
  const isTautology = TAUTOLOGY_PATTERNS.some((pat) =>
    pat.test(property.assertion.trim()),
  ) || isIdentityTautology(property.assertion);
  if (!isTautology) {
    score += 2;
  }

  // (2 pts) Not trivial (not just typeof or other zero-value assertion)
  const isTrivial = isTypeofTrivial(property.assertion);
  if (!isTrivial) {
    score += 2;
  }

  // (1 pt) Has 3 seed inputs
  if (property.seedInputs.length >= 3) {
    score += 1;
  }

  // Penalize likely-fragile assertions.
  score -= detectFragility(property);

  // Clamp to 0-13
  return Math.max(0, Math.min(score, 13));
}

/**
 * Check if two properties are redundant (same assertion).
 */
export function isRedundant(
  property: PropertyDefinition,
  existing: readonly PropertyDefinition[],
): boolean {
  const normalized = property.assertion.replace(/\s+/g, " ").trim();
  return existing.some(
    (p) => p.assertion.replace(/\s+/g, " ").trim() === normalized,
  );
}

/**
 * Score and filter properties. Returns only those above minScore.
 */
export function scoreAndFilter(
  properties: readonly PropertyDefinition[],
  minScore: number,
): readonly PropertyDefinition[] {
  const scored: PropertyDefinition[] = [];
  const kept: PropertyDefinition[] = [];

  for (const prop of properties) {
    const score = scoreProperty(prop);
    const riskTags = detectRiskTags(prop);
    const withScore: PropertyDefinition = {
      ...prop,
      score,
      riskTags,
      riskScore: computeRiskScore(prop, score, riskTags),
    };
    scored.push(withScore);
  }

  for (const prop of scored) {
    if (prop.score >= minScore && !isRedundant(prop, kept)) {
      kept.push(prop);
    }
  }

  return kept;
}
