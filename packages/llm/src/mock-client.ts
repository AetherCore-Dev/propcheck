/**
 * Mock LLM client for offline testing.
 *
 * Returns canned responses for known function patterns.
 * Activated via PROPCHECK_MOCK=true or --mock flag.
 */

import type { LlmClient, ApiResponse, LlmToolSchema, LlmCallOptions } from "./client";

/** Built-in mock responses keyed by function name patterns. */
const MOCK_RESPONSES: Record<string, unknown> = {
  // Math functions
  add: {
    properties: [
      {
        targetFunction: "add",
        description: "Addition is commutative",
        category: "equivalence",
        assertion: "add(a, b) === add(b, a)",
        generators: {
          a: { type: "integer", constraints: { min: -1000, max: 1000 } },
          b: { type: "integer", constraints: { min: -1000, max: 1000 } },
        },
        seedInputs: [
          { label: "normal", value: { a: 3, b: 5 } },
          { label: "boundary", value: { a: 0, b: 0 } },
          { label: "extreme", value: { a: Number.MAX_SAFE_INTEGER, b: 1 } },
        ],
        evidence: "add(a, b) takes two numbers and returns their sum",
        confidence: 0.95,
      },
      {
        targetFunction: "add",
        description: "Zero is identity element",
        category: "boundary",
        assertion: "add(a, 0) === a",
        generators: {
          a: { type: "integer", constraints: { min: -1000, max: 1000 } },
        },
        seedInputs: [
          { label: "normal", value: { a: 42 } },
          { label: "boundary", value: { a: 0 } },
          { label: "extreme", value: { a: -999999 } },
        ],
        evidence: "adding zero should not change the value",
        confidence: 0.99,
      },
    ],
  },

  // Cart/discount functions
  applyDiscount: {
    properties: [
      {
        targetFunction: "applyDiscount",
        description: "Result is non-negative",
        category: "boundary",
        assertion: "applyDiscount(price, discount) >= 0",
        generators: {
          price: { type: "float", constraints: { min: 0, max: 10000 } },
          discount: { type: "float", constraints: { min: 0, max: 100 } },
        },
        seedInputs: [
          { label: "normal", value: { price: 100, discount: 10 } },
          { label: "boundary", value: { price: 0, discount: 0 } },
          { label: "extreme", value: { price: 0.01, discount: 99.99 } },
        ],
        evidence: "prices should never be negative after discount",
        confidence: 0.9,
      },
      {
        targetFunction: "applyDiscount",
        description: "Result does not exceed original price",
        category: "monotonic",
        assertion: "applyDiscount(price, discount) <= price",
        generators: {
          price: { type: "float", constraints: { min: 0, max: 10000 } },
          discount: { type: "float", constraints: { min: 0, max: 100 } },
        },
        seedInputs: [
          { label: "normal", value: { price: 100, discount: 20 } },
          { label: "boundary", value: { price: 100, discount: 0 } },
          { label: "extreme", value: { price: 100, discount: 100 } },
        ],
        evidence: "discount should reduce or maintain price, never increase",
        confidence: 0.92,
      },
      {
        targetFunction: "applyDiscount",
        description: "Zero discount returns original price",
        category: "boundary",
        assertion: "applyDiscount(price, 0) === price",
        generators: {
          price: { type: "float", constraints: { min: 0, max: 10000 } },
        },
        seedInputs: [
          { label: "normal", value: { price: 49.99 } },
          { label: "boundary", value: { price: 0 } },
          { label: "extreme", value: { price: 99999.99 } },
        ],
        evidence: "zero discount should not change the price",
        confidence: 0.98,
      },
    ],
  },

  // Sort functions
  sort: {
    properties: [
      {
        targetFunction: "sort",
        description: "Output length equals input length",
        category: "conservation",
        assertion: "sort(arr).length === arr.length",
        generators: {
          arr: { type: "array", constraints: { element: "integer", maxLength: 100 } },
        },
        seedInputs: [
          { label: "normal", value: { arr: [3, 1, 2] } },
          { label: "boundary", value: { arr: [] } },
          { label: "extreme", value: { arr: [1] } },
        ],
        evidence: "sorting should not add or remove elements",
        confidence: 0.99,
      },
      {
        targetFunction: "sort",
        description: "Output is monotonically increasing",
        category: "monotonic",
        assertion: "sort(arr).every((v, i, a) => i === 0 || a[i-1] <= v)",
        generators: {
          arr: { type: "array", constraints: { element: "integer", maxLength: 100 } },
        },
        seedInputs: [
          { label: "normal", value: { arr: [5, 2, 8, 1] } },
          { label: "boundary", value: { arr: [1, 1, 1] } },
          { label: "extreme", value: { arr: [100, 99, 98, 97] } },
        ],
        evidence: "sorted output should be in ascending order",
        confidence: 0.99,
      },
      {
        targetFunction: "sort",
        description: "Sorting is idempotent",
        category: "idempotent",
        assertion: "JSON.stringify(sort(sort(arr))) === JSON.stringify(sort(arr))",
        generators: {
          arr: { type: "array", constraints: { element: "integer", maxLength: 50 } },
        },
        seedInputs: [
          { label: "normal", value: { arr: [3, 1, 2] } },
          { label: "boundary", value: { arr: [] } },
          { label: "extreme", value: { arr: [1, 2, 3] } },
        ],
        evidence: "sorting an already sorted array should give the same result",
        confidence: 0.97,
      },
    ],
  },
};

/** Create a mock LLM client that returns canned responses. */
export function createMockClient(): LlmClient {
  return {
    async call(
      _systemPrompt: string,
      userPrompt: string,
      _tools: readonly LlmToolSchema[],
      _options?: LlmCallOptions,
    ): Promise<ApiResponse> {
      // Find the best matching mock response by looking for function names in the prompt
      let matchedResponse: unknown = null;

      for (const [funcName, response] of Object.entries(MOCK_RESPONSES)) {
        if (userPrompt.includes(funcName)) {
          matchedResponse = response;
          console.log(`  [MOCK] Using canned response for "${funcName}"`);
          break;
        }
      }

      // Default: return a generic property
      if (!matchedResponse) {
        console.log("  [MOCK] No specific mock found, using generic response");
        matchedResponse = {
          properties: [
            {
              targetFunction: "unknown",
              description: "Output type is consistent",
              category: "type-preservation",
              assertion: "typeof result !== 'undefined'",
              generators: { x: { type: "integer" } },
              seedInputs: [
                { label: "normal", value: { x: 1 } },
                { label: "boundary", value: { x: 0 } },
                { label: "extreme", value: { x: -1 } },
              ],
              evidence: "function should return a defined value",
              confidence: 0.6,
            },
          ],
        };
      }

      // Simulate token usage
      const inputTokens = Math.floor(userPrompt.length / 4);
      const outputTokens = Math.floor(JSON.stringify(matchedResponse).length / 4);

      return {
        content: matchedResponse,
        inputTokens,
        outputTokens,
        model: "mock-model",
      };
    },
  };
}
