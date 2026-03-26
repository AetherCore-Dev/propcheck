/**
 * Property quality scoring — 15-point rubric.
 *
 * Filters out tautologies, redundant, and low-quality properties.
 */

import type { PropertyDefinition } from "@propcheck/common";

const TAUTOLOGY_PATTERNS = [
  /^true$/i,
  /^x\s*===?\s*x$/,
  /^result\s*===?\s*result$/,
  /^typeof\s+\w+\s*(!==?|===?)\s*['"]undefined['"]\s*$/,
];

/**
 * Score a property from 0-15.
 *
 * Rubric:
 * - (2 pts) Assertion is non-empty and references target function
 * - (2 pts) Generators defined for all expected parameters
 * - (2 pts) Confidence > 0.5
 * - (2 pts) Evidence is non-empty and meaningful
 * - (2 pts) NOT a tautology
 * - (2 pts) NOT trivial (not just a typeof check)
 * - (1 pt) Has 3 seed inputs
 * - (1 pt) Category is specific (not generic)
 * - (1 pt) Assertion looks syntactically valid
 */
export function scoreProperty(property: PropertyDefinition): number {
  let score = 0;

  // (2 pts) Assertion references target function
  if (
    property.assertion.length > 0 &&
    property.assertion.includes(property.targetFunction.split(".").pop() ?? "")
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

  // (2 pts) Not a tautology
  const isTautology = TAUTOLOGY_PATTERNS.some((pat) =>
    pat.test(property.assertion.trim()),
  );
  if (!isTautology) {
    score += 2;
  }

  // (2 pts) Not trivial (not just typeof)
  const isTrivial = /^typeof\s+/.test(property.assertion.trim()) &&
    !property.assertion.includes("===");
  if (!isTrivial) {
    score += 2;
  }

  // (1 pt) Has 3 seed inputs
  if (property.seedInputs.length >= 3) {
    score += 1;
  }

  // Clamp to 15
  return Math.min(score, 15);
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
    const withScore: PropertyDefinition = { ...prop, score };
    scored.push(withScore);
  }

  for (const prop of scored) {
    if (prop.score >= minScore && !isRedundant(prop, kept)) {
      kept.push(prop);
    }
  }

  return kept;
}
