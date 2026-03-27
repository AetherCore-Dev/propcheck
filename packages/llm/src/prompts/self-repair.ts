/**
 * Self-repair prompt — fixes property test code that fails to compile/run.
 *
 * When a generated property's test code produces a compile or runtime error,
 * this module feeds the error back to the LLM to produce a fixed version.
 * Max 3 rounds per property (from ClassInvGen paper).
 */

import type { PropertyDefinition } from "@propcheck/common";
import type { LlmClient, LlmToolSchema } from "../client";

const REPAIR_SYSTEM_PROMPT = `You are propcheck's self-repair module. A property-based test was generated but failed to compile or run.

Your job: fix the property definition so the generated test code works correctly.

Common issues and fixes:
1. Invalid assertion syntax → rewrite as valid JavaScript/TypeScript expression
2. Missing function call → assertion must actually call the target function
3. Wrong parameter names → match the function signature exactly
4. Array literal in assertion → use generator instead (fc.property needs arbitraries, not literals)
5. Zero parameters → ensure at least one generator for fc.property to work
6. Type mismatch → generator type must match parameter type

Rules:
- Keep the same property intent/description
- Only fix the technical issue, don't change what's being tested
- The assertion must be a boolean expression using the function's parameters
- Every generator key must match a parameter name used in the assertion`;

/** Tool schema for the repair response. */
const REPAIR_TOOL: LlmToolSchema = {
  name: "repair_property",
  description: "Return the repaired property definition",
  input_schema: {
    type: "object",
    properties: {
      targetFunction: { type: "string", description: "Function being tested" },
      description: { type: "string", description: "What the property tests" },
      category: {
        type: "string",
        enum: ["roundtrip", "idempotent", "conservation", "monotonic",
               "equivalence", "type-preservation", "cross-function",
               "boundary", "metamorphic"],
      },
      assertion: { type: "string", description: "Fixed boolean expression" },
      generators: {
        type: "object",
        description: "Parameter name → { type, constraints? }",
        additionalProperties: {
          type: "object",
          properties: {
            type: { type: "string" },
            constraints: { type: "object" },
          },
          required: ["type"],
        },
      },
      confidence: { type: "number", description: "0-1 confidence in the fix" },
    },
    required: ["targetFunction", "description", "category", "assertion", "generators", "confidence"],
  },
};

/**
 * Build the repair prompt with error context.
 */
function buildRepairPrompt(
  property: PropertyDefinition,
  errorMessage: string,
  sourceCode: string,
  functionSignature: string,
): string {
  return `## Property that failed

**Target function:** \`${property.targetFunction}\`
**Function signature:** \`${functionSignature}\`
**Description:** ${property.description}
**Category:** ${property.category}
**Assertion:** \`${property.assertion}\`
**Generators:** ${JSON.stringify(property.generators, null, 2)}

## Error encountered

\`\`\`
${errorMessage.slice(0, 500)}
\`\`\`

## Source code

\`\`\`typescript
${sourceCode.slice(0, 2000)}
\`\`\`

## Task

Fix the property definition so the generated test compiles and runs correctly.
Return the repaired property via the repair_property tool.`;
}

/**
 * Attempt to repair a single property using LLM.
 *
 * Returns the fixed PropertyDefinition, or null if repair failed.
 */
export async function repairProperty(
  client: LlmClient,
  property: PropertyDefinition,
  errorMessage: string,
  sourceCode: string,
  functionSignature: string,
): Promise<PropertyDefinition | null> {
  try {
    const prompt = buildRepairPrompt(property, errorMessage, sourceCode, functionSignature);
    const response = await client.call(REPAIR_SYSTEM_PROMPT, prompt, [REPAIR_TOOL]);

    if (!response.content || typeof response.content !== "object") {
      return null;
    }

    const content = response.content as Record<string, unknown>;

    // Validate required fields
    if (!content.assertion || !content.generators || !content.targetFunction) {
      return null;
    }

    // Build repaired property — immutable, create new object
    const repaired: PropertyDefinition = {
      ...property,
      assertion: String(content.assertion),
      generators: content.generators as PropertyDefinition["generators"],
      category: (content.category as PropertyDefinition["category"]) ?? property.category,
      description: String(content.description ?? property.description),
      confidence: Math.min(
        property.confidence,
        typeof content.confidence === "number" ? content.confidence : 0.5,
      ),
    };

    return repaired;
  } catch {
    return null;
  }
}

export { REPAIR_SYSTEM_PROMPT, REPAIR_TOOL, buildRepairPrompt };
