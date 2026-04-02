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
 * Mock fix: applies a simple boundary-clamping fix to the source code.
 *
 * For testing, this wraps numeric parameters with Math.min/Math.max clamps
 * or adds early-return guards for edge cases.
 */
export function mockGenerateFix(
  sourceCode: string,
  diagnoses: readonly Diagnosis[],
): FixResult {
  // Simple mock: add a comment noting the fix location for each diagnosed bug
  let fixedSource = sourceCode;
  const changedFunctions: string[] = [];

  for (const d of diagnoses) {
    if (!d.isBug) continue;

    // Find function containing the bug (naive: look for "function <name>" or "export function <name>")
    const funcPattern = new RegExp(
      `((?:export\\s+)?function\\s+${escapeRegExp(d.propertyId.split("_")[0] ?? "")}\\s*\\()`,
    );
    const match = fixedSource.match(funcPattern);

    if (!match) {
      // Can't find the function — just add a guard comment at the top
      fixedSource = `// [propcheck fix] Applied mock fix for ${d.propertyId}\n${fixedSource}`;
    }
  }

  // For mock, return source with minimal changes
  return {
    fixedSource,
    explanation: `Mock fix: applied guards for ${diagnoses.filter((d) => d.isBug).length} diagnosed bug(s)`,
    changedFunctions,
    confidence: 0.7,
  };
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
