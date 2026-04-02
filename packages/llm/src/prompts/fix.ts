/**
 * Fix prompts — dual-agent architecture for auto-fixing property violations.
 *
 * Phase 1 (Tester Agent): diagnose whether a violation is a real bug or a false positive.
 * Phase 2 (Generator Agent): generate a minimal source code fix for confirmed bugs.
 *
 * Based on the PGS paper's dual-agent approach — properties are easier to get right
 * than code, so use properties as the oracle to verify fixes.
 */

import type { PropertyDefinition, PropertyFailure, Diagnosis } from "@propcheck/common";
import type { LlmClient, LlmToolSchema } from "../client";

// ---------------------------------------------------------------------------
// Phase 1: Diagnosis (Tester Agent)
// ---------------------------------------------------------------------------

export const DIAGNOSE_SYSTEM_PROMPT = `You are propcheck's violation analyzer. A property-based test found a counterexample that violates a property. Your job: determine if this is a real bug in the source code or a flawed property.

Rules:
- A violation is a REAL BUG if the property correctly describes intended behavior and the source code produces wrong output for the given counterexample
- A violation is a FALSE POSITIVE if the property is too strict, makes wrong assumptions, or tests unintended behavior
- Consider the function's docstring, parameter names, return type, and surrounding code as signals of intent
- Provide a clear explanation of WHY this is or isn't a bug
- If it IS a bug, suggest what the fix should look like (high-level, not code)`;

export const DIAGNOSE_TOOL: LlmToolSchema = {
  name: "diagnose_violation",
  description: "Analyze whether a property violation indicates a real bug in the source code",
  input_schema: {
    type: "object",
    properties: {
      propertyId: { type: "string", description: "ID of the violated property" },
      isBug: { type: "boolean", description: "true if this is a real bug in the source code" },
      explanation: { type: "string", description: "Why this is or isn't a bug" },
      suggestedFix: {
        type: ["string", "null"],
        description: "High-level description of the fix (null if not a bug)",
      },
      confidence: { type: "number", description: "0-1 confidence in the diagnosis" },
      rootCause: {
        type: "string",
        description: "Root cause category: boundary, logic, type, overflow, edge-case, validation",
      },
    },
    required: ["propertyId", "isBug", "explanation", "suggestedFix", "confidence", "rootCause"],
  },
};

export function buildDiagnosePrompt(
  sourceCode: string,
  property: PropertyDefinition,
  failure: PropertyFailure,
  language: string,
): string {
  const counterexampleStr = typeof failure.counterexample === "string"
    ? failure.counterexample
    : JSON.stringify(failure.counterexample, null, 2);

  return `## Source Code

\`\`\`${language}
${sourceCode.slice(0, 8000)}
\`\`\`

## Property that was violated
- **ID:** ${property.id}
- **Function:** ${property.targetFunction}
- **Description:** ${property.description}
- **Category:** ${property.category}
- **Assertion:** \`${property.assertion}\`
- **Evidence:** ${property.evidence}

## Counterexample (shrunk to minimal case)
- **Input:** ${counterexampleStr}
- **Error:** ${failure.errorMessage.slice(0, 500)}
- **Shrink steps:** ${failure.shrinkSteps}
- **Seed:** ${failure.seed}

Analyze this violation. Is this a real bug in the source code, or is the property flawed?`;
}

/**
 * Diagnose a single property violation using the LLM.
 * Returns a Diagnosis, or null if the LLM response is invalid.
 */
export async function diagnoseViolation(
  client: LlmClient,
  sourceCode: string,
  property: PropertyDefinition,
  failure: PropertyFailure,
  language: string,
): Promise<Diagnosis | null> {
  try {
    const prompt = buildDiagnosePrompt(sourceCode, property, failure, language);
    const response = await client.call(DIAGNOSE_SYSTEM_PROMPT, prompt, [DIAGNOSE_TOOL]);

    if (!response.content || typeof response.content !== "object") {
      return null;
    }

    const content = response.content as Record<string, unknown>;

    if (typeof content.isBug !== "boolean" || typeof content.explanation !== "string") {
      return null;
    }

    return {
      propertyId: String(content.propertyId ?? property.id),
      isBug: content.isBug,
      explanation: content.explanation,
      suggestedFix: content.suggestedFix ? String(content.suggestedFix) : null,
      confidence: typeof content.confidence === "number" ? content.confidence : 0.5,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Phase 2: Fix Generation (Generator Agent)
// ---------------------------------------------------------------------------

export const FIX_SYSTEM_PROMPT = `You are propcheck's code fix generator. Property-based testing found real bugs in the source code. Your job: generate a minimal, correct fix.

Rules:
- Fix ONLY the bug(s) identified — do not refactor or change unrelated code
- The fix must make ALL listed properties pass, not just the violated one(s)
- Prefer the smallest possible change (minimal diff)
- Preserve function signatures (parameter names, types, return type)
- Preserve code style (indentation, naming conventions, comment style)
- Do NOT add new dependencies or imports unless absolutely necessary
- The counterexample shows the EXACT input that triggers the bug — use it to understand the edge case
- Consider ALL properties listed (both passing and failing) to ensure no regressions
- Return the COMPLETE source file with fixes applied`;

export const FIX_TOOL: LlmToolSchema = {
  name: "generate_fix",
  description: "Generate a fixed version of the source code",
  input_schema: {
    type: "object",
    properties: {
      fixedSource: { type: "string", description: "The complete fixed source code" },
      explanation: { type: "string", description: "What was changed and why" },
      changedFunctions: {
        type: "array",
        items: { type: "string" },
        description: "Names of functions that were modified",
      },
      confidence: { type: "number", description: "0-1 confidence the fix is correct" },
    },
    required: ["fixedSource", "explanation", "changedFunctions", "confidence"],
  },
};

/** Result from the fix generation LLM call. */
export interface FixResult {
  readonly fixedSource: string;
  readonly explanation: string;
  readonly changedFunctions: readonly string[];
  readonly confidence: number;
}

export function buildFixPrompt(
  sourceCode: string,
  diagnoses: readonly Diagnosis[],
  properties: readonly PropertyDefinition[],
  failures: readonly PropertyFailure[],
  language: string,
  retryFeedback?: string,
): string {
  const bugSections = diagnoses
    .filter((d) => d.isBug)
    .map((d) => {
      const failure = failures.find((f) => f.propertyId === d.propertyId);
      const property = properties.find((p) => p.id === d.propertyId);
      const counterexampleStr = failure
        ? (typeof failure.counterexample === "string"
            ? failure.counterexample
            : JSON.stringify(failure.counterexample, null, 2))
        : "N/A";

      return `### Bug in \`${property?.targetFunction ?? "unknown"}\`
- **Property:** ${property?.description ?? d.propertyId}
- **Counterexample:** ${counterexampleStr}
- **Explanation:** ${d.explanation}
- **Suggested fix:** ${d.suggestedFix ?? "N/A"}`;
    })
    .join("\n\n");

  const propertySummary = properties
    .map((p) => {
      const failed = failures.some((f) => f.propertyId === p.id);
      const status = failed ? "FAILING" : "PASSING";
      return `- [${status}] ${p.targetFunction}: ${p.description}\n  Assertion: \`${p.assertion}\``;
    })
    .join("\n");

  let prompt = `## Source Code (with bug)

\`\`\`${language}
${sourceCode.slice(0, 10000)}
\`\`\`

## Bug Diagnosis

${bugSections}

## ALL Properties (fix must not break any)

${propertySummary}

## Task

Generate a fixed version of the source code that:
1. Fixes the bug(s) described above
2. Passes ALL listed properties (including the currently-passing ones)
3. Makes the MINIMAL change necessary

Return the complete fixed source code via the generate_fix tool.`;

  if (retryFeedback) {
    prompt += `\n\n## Previous Attempt Feedback\n\n${retryFeedback}\n\nPlease fix the issues above and try again.`;
  }

  return prompt;
}

/**
 * Generate a fix for confirmed bugs using the LLM.
 * Returns a FixResult, or null if the LLM response is invalid.
 */
export async function generateFix(
  client: LlmClient,
  sourceCode: string,
  diagnoses: readonly Diagnosis[],
  properties: readonly PropertyDefinition[],
  failures: readonly PropertyFailure[],
  language: string,
  retryFeedback?: string,
): Promise<FixResult | null> {
  try {
    const prompt = buildFixPrompt(
      sourceCode,
      diagnoses,
      properties,
      failures,
      language,
      retryFeedback,
    );
    const response = await client.call(FIX_SYSTEM_PROMPT, prompt, [FIX_TOOL]);

    if (!response.content || typeof response.content !== "object") {
      return null;
    }

    const content = response.content as Record<string, unknown>;

    if (typeof content.fixedSource !== "string" || !content.fixedSource.trim()) {
      return null;
    }

    return {
      fixedSource: content.fixedSource,
      explanation: typeof content.explanation === "string" ? content.explanation : "",
      changedFunctions: Array.isArray(content.changedFunctions)
        ? (content.changedFunctions as string[]).map(String)
        : [],
      confidence: typeof content.confidence === "number" ? content.confidence : 0.5,
    };
  } catch {
    return null;
  }
}
