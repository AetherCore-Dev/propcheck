/**
 * Mock fix — simulates LLM diagnosis and fix generation for offline testing.
 *
 * Used when --mock is enabled. Applies deterministic fixes for known patterns.
 */

import type { PropertyDefinition, PropertyFailure, Diagnosis } from "@propcheck/common";
import type { FixResult } from "./prompts/fix";

/**
 * Mock diagnosis: always returns isBug=true with a deterministic explanation.
 */
export function mockDiagnoseViolation(
  property: PropertyDefinition,
  failure: PropertyFailure,
): Diagnosis {
  return {
    propertyId: property.id,
    isBug: true,
    explanation: `Mock diagnosis: the counterexample ${JSON.stringify(failure.counterexample)} triggers a bug in ${property.targetFunction}. The property "${property.description}" is violated.`,
    suggestedFix: `Add input validation or boundary check in ${property.targetFunction}`,
    confidence: 0.85,
  };
}

/**
 * Mock fix: adds guard comments to the source code for each diagnosed bug.
 *
 * This is a simple mock that prepends fix comments — real LLM fix would
 * generate actual code changes.
 */
export function mockGenerateFix(
  sourceCode: string,
  diagnoses: readonly Diagnosis[],
): FixResult {
  let fixedSource = sourceCode;
  const changedFunctions: string[] = [];
  const bugDiagnoses = diagnoses.filter((d) => d.isBug);

  if (bugDiagnoses.some((d) => d.suggestedFix?.includes("applyDiscount"))) {
    const nextSource = fixedSource.replace(
      /return price \* \(1 - discount \/ 100\);/,
      [
        "const normalizedDiscount = Math.max(0, Math.min(100, discount));",
        "  return price * (1 - normalizedDiscount / 100);",
      ].join("\n  "),
    );
    if (nextSource !== fixedSource) {
      fixedSource = nextSource;
      changedFunctions.push("applyDiscount");
    }
  }

  if (changedFunctions.length === 0) {
    for (const d of bugDiagnoses) {
      fixedSource = `// [propcheck fix] Applied mock fix for ${d.propertyId}\n${fixedSource}`;
    }
  }

  return {
    fixedSource,
    explanation: `Mock fix: applied guards for ${bugDiagnoses.length} diagnosed bug(s)`,
    changedFunctions,
    confidence: 0.7,
  };
}
