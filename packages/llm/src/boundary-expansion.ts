/**
 * Boundary expansion — automatically widens generator ranges
 * to test beyond documented input ranges.
 *
 * For each property that passes with the LLM-specified ranges,
 * we create an "expanded" variant with wider ranges and run it.
 * If the expanded variant fails, we've found a boundary-sensitive bug.
 */

import type { PropertyDefinition, GeneratorSpec } from "@propcheck/common";

/**
 * Expand numeric generator ranges by 50% in each direction.
 * Also expands numeric constraints inside array element generators.
 */
export function expandGeneratorRanges(
  property: PropertyDefinition,
): PropertyDefinition {
  const expanded: Record<string, GeneratorSpec> = {};

  for (const [name, spec] of Object.entries(property.generators)) {
    if (spec.type === "float" || spec.type === "number" || spec.type === "integer" || spec.type === "int") {
      expanded[name] = expandNumericSpec(spec);
    } else if (spec.type === "array") {
      // Also expand element constraints for array generators
      const c = spec.constraints ?? {};
      const elementType = c.element ?? c.elementType;
      if (elementType === "float" || elementType === "number" || elementType === "integer" || elementType === "int") {
        const elemConstraints = (c.elementConstraints ?? {}) as Record<string, unknown>;
        const eMin = typeof elemConstraints.min === "number" ? elemConstraints.min : -1000;
        const eMax = typeof elemConstraints.max === "number" ? elemConstraints.max : 1000;
        const eRange = eMax - eMin;
        const eExpansion = Math.max(eRange * 0.5, 10);
        expanded[name] = {
          type: spec.type,
          constraints: {
            ...c,
            elementConstraints: {
              ...elemConstraints,
              min: eMin - eExpansion,
              max: eMax + eExpansion,
            },
          },
        };
      } else {
        expanded[name] = spec;
      }
    } else {
      // Keep non-numeric generators as-is
      expanded[name] = spec;
    }
  }

  return {
    ...property,
    generators: Object.freeze(expanded),
  };
}

/** Expand a single numeric generator spec by 50% in each direction (minimum ±10). */
function expandNumericSpec(spec: GeneratorSpec): GeneratorSpec {
  const c = spec.constraints ?? {};
  const min = typeof c.min === "number" ? c.min : -1000;
  const max = typeof c.max === "number" ? c.max : 1000;
  const range = max - min;
  const expansion = Math.max(range * 0.5, 10); // At least ±10

  return {
    type: spec.type,
    constraints: {
      ...c,
      min: min - expansion,
      max: max + expansion,
    },
  };
}

/**
 * Check if a property has numeric generators that could benefit from expansion.
 */
export function hasExpandableRanges(property: PropertyDefinition): boolean {
  return Object.values(property.generators).some(
    (spec) => spec.type === "float" || spec.type === "number" || spec.type === "integer" || spec.type === "int",
  );
}
