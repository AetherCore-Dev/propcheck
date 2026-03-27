/**
 * Refinement prompt — improves properties based on execution feedback.
 *
 * Implements FUEL-style iterative refinement:
 *   Round 1 results → analyze → feedback prompt → LLM generates improved properties
 *
 * Feedback types:
 *   - WEAK: property passed 100% but has low score → ask LLM to strengthen
 *   - REDUNDANT: multiple properties test the same thing → ask LLM to diversify
 *   - COVERAGE_GAP: functions with no passing properties → ask LLM to try different angles
 *   - BUG_FOUND: property found a real bug → ask LLM to explore similar properties
 */

import type { PropertyDefinition, ExecutionResult, PropertyResult, PropertyFailure } from "@propcheck/common";

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
      // Passed — but is it strong or weak?
      if (prop.score < 12 || prop.confidence < 0.7) {
        return { kind: "weak", property: prop, reason: `low score (${prop.score}/15) or confidence (${prop.confidence})` };
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

/**
 * Build a refinement feedback summary from classified properties.
 */
export function buildFeedbackSummary(
  classifications: readonly PropertyClassification[],
  functionNames: readonly string[],
): string {
  const lines: string[] = [];
  lines.push("## Round 1 Results\n");

  // Group by function
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
          break;
        case "weak":
          lines.push(`  ⚠ WEAK: "${c.property.description}" — ${c.reason}`);
          lines.push(`    → Please generate a STRONGER version that tests deeper behavior`);
          break;
        case "bug_found":
          lines.push(`  🐛 BUG FOUND: "${c.property.description}" — counterexample: ${JSON.stringify(c.counterexample)}`);
          lines.push(`    → Explore SIMILAR properties around this bug area`);
          break;
        case "failed":
          lines.push(`  ✗ FAILED: "${c.property.description}" — ${c.error}`);
          break;
      }
    }
    lines.push("");
  }

  // Check for coverage gaps — functions with no strong properties
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
    lines.push("→ Try different property categories (roundtrip, conservation, metamorphic)");
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
  lines.push("2. For each WEAK property, generate a stronger replacement");
  lines.push("3. For each BUG FOUND, generate 1-2 related properties exploring the same area");
  lines.push("4. For coverage gaps, try completely different property categories");
  lines.push("5. Do NOT duplicate existing strong properties");

  return lines.join("\n");
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
