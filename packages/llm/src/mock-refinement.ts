/**
 * Mock refinement — simulates LLM strengthening weak properties.
 *
 * Used when --mock is enabled. Applies deterministic improvements for common patterns.
 */

import type { PropertyDefinition } from "@propcheck/common";
import type { PropertyClassification } from "./prompts/refinement";

/**
 * Generate improved properties based on round 1 classifications.
 * Returns new/improved properties only (strong ones are kept as-is by caller).
 */
export function mockRefineProperties(
  classifications: readonly PropertyClassification[],
): readonly PropertyDefinition[] {
  const improved: PropertyDefinition[] = [];
  let idCounter = 900; // Start from 900 to avoid ID conflicts

  for (const c of classifications) {
    switch (c.kind) {
      case "weak": {
        // Strengthen weak properties by adding tighter constraints
        const strengthened: PropertyDefinition = {
          ...c.property,
          id: `prop_${idCounter++}`,
          score: Math.min(c.property.score + 2, 13),
          confidence: Math.min(c.property.confidence + 0.1, 1.0),
          description: c.property.description + " (strengthened)",
        };
        improved.push(strengthened);
        break;
      }

      case "bug_found": {
        // Generate a related property exploring the same area
        const related: PropertyDefinition = {
          ...c.property,
          id: `prop_${idCounter++}`,
          description: `${c.property.targetFunction}: boundary around discovered bug`,
          category: "boundary",
          confidence: 0.8,
          score: 13,
        };
        improved.push(related);
        break;
      }

      case "failed": {
        // Don't try to regenerate failed properties — self-repair already tried
        break;
      }

      case "strong": {
        // Keep as-is — not included in improved (caller preserves these)
        break;
      }
    }
  }

  return improved;
}
