/**
 * Refinement prompt — improves properties based on execution feedback.
 *
 * Implements multi-round iterative refinement:
 *   Round 1 results → analyze → adversarial feedback → LLM generates improved properties
 *
 * Feedback types:
 *   - WEAK: property passed 100% but has low score → ask LLM to strengthen
 *   - REDUNDANT: multiple properties test the same thing → ask LLM to diversify
 *   - COVERAGE_GAP: functions with no passing properties → ask LLM to try different angles
 *   - BUG_FOUND: property found a real bug → ask LLM to explore similar properties
 *   - CONSERVATIVE_RANGE: generators stay within documented ranges → push boundaries
 *   - TAUTOLOGY: filtered property was a tautology → replace with real test
 */

import type { PropertyDefinition, ExecutionResult } from "@propcheck/common";

/** Classification of a property after trial-run. */
export type PropertyClassification =
  | { kind: "strong"; property: PropertyDefinition }
  | { kind: "weak"; property: PropertyDefinition; reason: string }
  | { kind: "bug_found"; property: PropertyDefinition; counterexample: unknown }
  | { kind: "failed"; property: PropertyDefinition; error: string };

/**
 * Classify properties based on execution results.
 */
export function classifyProperties(
  properties: readonly PropertyDefinition[],
  result: ExecutionResult,
): readonly PropertyClassification[] {
  const passedIds = new Map(result.passed.map((p) => [p.propertyId, p]));
  const failedIds = new Map(result.failed.map((f) => [f.propertyId, f]));
  const errorIds = new Map(result.errors.map((e) => [e.propertyId, e]));

  return properties.map((prop): PropertyClassification => {
    const passed = passedIds.get(prop.id);
    if (passed) {
      if (prop.score < 12 || prop.confidence < 0.7) {
        return { kind: "weak", property: prop, reason: `low score (${prop.score}/13) or confidence (${prop.confidence})` };
      }
      return { kind: "strong", property: prop };
    }

    const failed = failedIds.get(prop.id);
    if (failed) {
      return { kind: "bug_found", property: prop, counterexample: failed.counterexample };
    }

    const error = errorIds.get(prop.id);
    if (error) {
      return { kind: "failed", property: prop, error: error.errorMessage };
    }

    return { kind: "failed", property: prop, error: "no result" };
  });
}

/** Options for feedback summary generation. */
export interface FeedbackOptions {
  /** Number of properties filtered out by quality scoring (tautologies, typeof, etc.) */
  readonly filteredCount?: number;
  /** Whether boundary expansion was performed */
  readonly boundaryExpanded?: boolean;
  /** Number of properties that failed after boundary expansion */
  readonly boundaryFailures?: number;
}

/**
 * Build a refinement feedback summary from classified properties.
 * Includes adversarial insights to guide Round 2 toward higher-value properties.
 */
export function buildFeedbackSummary(
  classifications: readonly PropertyClassification[],
  functionNames: readonly string[],
  options: FeedbackOptions = {},
): string {
  const lines: string[] = [];
  lines.push("## Round 1 Results\n");

  const byFunction = new Map<string, PropertyClassification[]>();
  for (const c of classifications) {
    const fn = c.property.targetFunction;
    const list = byFunction.get(fn) ?? [];
    list.push(c);
    byFunction.set(fn, list);
  }

  for (const [fn, cls] of byFunction) {
    lines.push(`### ${fn}`);
    for (const c of cls) {
      switch (c.kind) {
        case "strong":
          lines.push(`  ✓ STRONG: "${c.property.description}" — passed, high quality`);
          // Flag properties with conservative ranges
          if (hasConservativeRanges(c.property)) {
            lines.push(`    ⚠ NOTE: Generator ranges appear to match documented input ranges exactly.`);
            lines.push(`    → Consider generating a variant with WIDER ranges to test boundary behavior.`);
          }
          break;
        case "weak":
          lines.push(`  ⚠ WEAK: "${c.property.description}" — ${c.reason}`);
          lines.push(`    → Generate a STRONGER version. Think adversarially: what input would break this function?`);
          break;
        case "bug_found":
          lines.push(`  🐛 BUG FOUND: "${c.property.description}" — counterexample: ${JSON.stringify(c.counterexample)}`);
          lines.push(`    → This is a high-value finding. Generate 1-2 RELATED properties that explore similar edge cases.`);
          lines.push(`    → What other inputs near this counterexample also trigger unexpected behavior?`);
          break;
        case "failed":
          lines.push(`  ✗ FAILED: "${c.property.description}" — ${c.error}`);
          lines.push(`    → The assertion or generators may be incorrect. Rewrite with correct types.`);
          break;
      }
    }
    lines.push("");
  }

  // Coverage gaps
  const coveredFunctions = new Set<string>();
  for (const c of classifications) {
    if (c.kind === "strong" || c.kind === "bug_found") {
      coveredFunctions.add(c.property.targetFunction);
    }
  }
  const uncovered = functionNames.filter((fn) => !coveredFunctions.has(fn));
  if (uncovered.length > 0) {
    lines.push("## Coverage Gaps");
    lines.push(`These functions have no strong properties yet: ${uncovered.join(", ")}`);
    lines.push("→ Think adversarially: what would break these functions? Test boundary inputs OUTSIDE documented ranges.");
    lines.push("");
  }

  // Quality gate insights
  if (options.filteredCount && options.filteredCount > 0) {
    lines.push("## Quality Gate Feedback");
    lines.push(`${options.filteredCount} properties were filtered as low-value (tautologies, typeof checks, identity expressions).`);
    lines.push("→ Do NOT generate: typeof checks, f(x) === f(x) identity expressions, or implementation restatements.");
    lines.push("→ Instead: generate metamorphic properties, boundary tests with adversarial inputs, or cross-function invariants.");
    lines.push("");
  }

  if (options.boundaryFailures && options.boundaryFailures > 0) {
    lines.push("## Boundary Expansion Results");
    lines.push(`${options.boundaryFailures} properties failed when generator ranges were expanded beyond documented limits.`);
    lines.push("→ These are HIGH-VALUE findings. Generate more properties that test similar boundary conditions.");
    lines.push("");
  }

  // Summary stats
  const strong = classifications.filter((c) => c.kind === "strong").length;
  const weak = classifications.filter((c) => c.kind === "weak").length;
  const bugs = classifications.filter((c) => c.kind === "bug_found").length;
  const failed = classifications.filter((c) => c.kind === "failed").length;

  lines.push("## Summary");
  lines.push(`Strong: ${strong} | Weak: ${weak} | Bugs found: ${bugs} | Failed: ${failed}`);
  lines.push("");
  lines.push("## Instructions for Round 2");
  lines.push("1. Keep all STRONG properties as-is (do not regenerate them)");
  lines.push("2. For each WEAK property, generate a stronger adversarial replacement");
  lines.push("3. For each BUG FOUND, generate 1-2 related properties exploring nearby edge cases");
  lines.push("4. For coverage gaps, try adversarial boundary testing and metamorphic properties");
  lines.push("5. For filtered tautologies, generate REAL properties that test meaningful behavior");
  lines.push("6. Generator ranges MUST extend beyond documented input ranges");
  lines.push("7. Do NOT duplicate existing strong properties");

  return lines.join("\n");
}

/**
 * Check if a property has generator ranges that look like they match documented ranges exactly.
 * (e.g. discount: {min: 0, max: 100} for a "0-100" documented percentage)
 */
function hasConservativeRanges(property: PropertyDefinition): boolean {
  for (const spec of Object.values(property.generators)) {
    if (spec.type === "float" || spec.type === "number" || spec.type === "integer") {
      const c = spec.constraints ?? {};
      const min = typeof c.min === "number" ? c.min : null;
      const max = typeof c.max === "number" ? c.max : null;
      if (min === null || max === null) continue;
      // Heuristic: ranges that look like exact documented constraints
      // Common patterns: [0, N] where N is a "round" number
      const roundMaxValues = new Set([1, 10, 100, 255, 360, 1000, 10000, 65535, 100000]);
      if (min === 0 && roundMaxValues.has(max)) return true;
      // Symmetric small ranges: [-1, 1], [-10, 10], [-100, 100]
      if (min === -max && roundMaxValues.has(max)) return true;
      // [1, N] ranges
      if (min === 1 && roundMaxValues.has(max)) return true;
    }
  }
  return false;
}

/**
 * Determine if Round 2 refinement should be triggered automatically.
 * Returns true if there are quality issues worth addressing.
 */
export function shouldAutoRefine(
  classifications: readonly PropertyClassification[],
  filteredCount: number,
): boolean {
  const weak = classifications.filter((c) => c.kind === "weak").length;
  const bugs = classifications.filter((c) => c.kind === "bug_found").length;
  const failed = classifications.filter((c) => c.kind === "failed").length;
  const total = classifications.length;

  // Trigger Round 2 if:
  // - More than 30% of properties are weak or failed
  // - Bugs found AND quality is also weak (explore more in that area)
  // - Many properties were filtered (LLM quality was poor)
  // - Too few properties survived (less than 2 per function)
  if (bugs > 0 && (weak + failed) > 0) return true;
  if (total > 0 && (weak + failed) / total > 0.3) return true;
  if (filteredCount >= 3) return true;
  if (total < 2) return true;

  return false;
}

/**
 * Build the complete refinement prompt combining original context + feedback.
 */
export function buildRefinementPrompt(
  originalPrompt: string,
  feedbackSummary: string,
): string {
  return `${originalPrompt}

---

${feedbackSummary}

Generate ONLY new or improved properties. Do NOT repeat the strong properties from Round 1.`;
}
