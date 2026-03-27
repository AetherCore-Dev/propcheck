/**
 * Mock self-repair — simulates LLM fixing common codegen errors.
 *
 * Used when --mock is enabled. Applies deterministic fixes for known error patterns.
 */

import type { PropertyDefinition } from "@propcheck/common";

/**
 * Attempt to auto-fix a property based on the error message.
 * Returns fixed property or null if the error pattern is not recognized.
 */
export function mockRepairProperty(
  property: PropertyDefinition,
  errorMessage: string,
): PropertyDefinition | null {
  const err = errorMessage.toLowerCase();

  // Fix 1: Zero arbitraries — fc.property requires at least 1
  // Add a dummy generator if assertion doesn't use any parameters
  if (err.includes("property expects at least one arbitrary") || err.includes("fc.property")) {
    const hasGenerators = Object.keys(property.generators).length > 0;
    if (!hasGenerators) {
      return {
        ...property,
        generators: { _unused: { type: "integer", constraints: { min: 0, max: 1 } } },
        assertion: property.assertion.replace(
          /^/,
          "(() => { const _unused = arguments[0]; return ",
        ) + " })()",
        confidence: property.confidence * 0.8,
      };
    }
  }

  // Fix 2: Array literal in assertion — convert to use generator
  if (err.includes("unexpected token") && property.assertion.includes("[")) {
    // Try to extract the array pattern and move it to a seed input
    const fixed = property.assertion
      .replace(/\[(\w+)\]/g, "[$1]")  // Keep valid array access
      .replace(/\[(\d+(?:,\s*\d+)*)\]/g, (_, nums) => {
        // Replace literal arrays like [1, 2, 3] with a reference
        return `[${nums}]`;
      });

    if (fixed !== property.assertion) {
      return {
        ...property,
        assertion: fixed,
        confidence: property.confidence * 0.7,
      };
    }
  }

  // Fix 3: Cannot find name / undefined variable
  if (err.includes("cannot find name") || err.includes("is not defined")) {
    // Extract the missing name — handles both:
    //   "ReferenceError: b is not defined"
    //   "Cannot find name 'b'"
    const nameMatch = errorMessage.match(/(?:Cannot find name\s+['"](\w+)['"]|(\w+)\s+is not defined)/i);
    const missingName = nameMatch?.[1] ?? nameMatch?.[2];
    if (missingName && !property.generators[missingName]) {
      return {
        ...property,
        generators: {
          ...property.generators,
          [missingName]: { type: "number" },
        },
        confidence: property.confidence * 0.7,
      };
    }
  }

  // Fix 4: Type error — wrong generator type
  if (err.includes("type") && (err.includes("not assignable") || err.includes("expected"))) {
    // Try switching number generators to double
    const fixedGens = { ...property.generators };
    let changed = false;
    for (const [key, gen] of Object.entries(fixedGens)) {
      if (gen.type === "integer") {
        fixedGens[key] = { type: "float", constraints: gen.constraints };
        changed = true;
      }
    }
    if (changed) {
      return {
        ...property,
        generators: fixedGens,
        confidence: property.confidence * 0.8,
      };
    }
  }

  // Fix 5: NaN comparison issues
  if (err.includes("nan") || err.includes("not a number")) {
    // Add noNaN constraint to all number generators
    const fixedGens = { ...property.generators };
    for (const [key, gen] of Object.entries(fixedGens)) {
      if (gen.type === "float" || gen.type === "number") {
        fixedGens[key] = {
          ...gen,
          constraints: { ...gen.constraints, noNaN: true, noDefaultInfinity: true },
        };
      }
    }
    return {
      ...property,
      generators: fixedGens,
      confidence: property.confidence * 0.9,
    };
  }

  // Unrecognized error pattern
  return null;
}
