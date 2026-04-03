/**
 * Mock LLM client for offline testing.
 *
 * Simulates realistic Claude Opus output quality:
 * - Good properties that find real bugs
 * - Mediocre properties that are technically correct but shallow
 * - A few weak/wrong properties that the scoring rubric should filter
 *
 * Activated via PROPCHECK_MOCK=true or --mock flag.
 */

import type { LlmClient, ApiResponse, LlmToolSchema, LlmCallOptions } from "./client";

/**
 * Mock responses keyed by function name.
 * Each function has 3-5 properties at varying quality levels.
 * Properties marked with LOW confidence simulate realistic LLM mistakes.
 */
const FUNCTION_PROPERTIES: Record<string, readonly unknown[]> = {

  // ═══════════════════════════════════════
  // cart-buggy.ts
  // ═══════════════════════════════════════

  applyDiscount: [
    {
      targetFunction: "applyDiscount",
      description: "Discounted price should be non-negative for valid inputs",
      category: "boundary",
      assertion: "applyDiscount(price, discount) >= 0",
      generators: {
        price: { type: "float", constraints: { min: 0, max: 10000 } },
        discount: { type: "float", constraints: { min: 0, max: 200 } },
      },
      seedInputs: [
        { label: "normal", value: { price: 100, discount: 20 } },
        { label: "boundary", value: { price: 0, discount: 100 } },
        { label: "extreme", value: { price: 0.01, discount: 150 } },
      ],
      evidence: "@param discount - Discount percentage (0-100); prices should not go negative",
      confidence: 0.92,
    },
    {
      targetFunction: "applyDiscount",
      description: "Discount should not increase the price when discount is positive",
      category: "monotonic",
      assertion: "discount >= 0 ? applyDiscount(price, discount) <= price : true",
      generators: {
        price: { type: "float", constraints: { min: 0, max: 10000 } },
        discount: { type: "float", constraints: { min: -50, max: 200 } },
      },
      seedInputs: [
        { label: "normal", value: { price: 100, discount: 25 } },
        { label: "boundary", value: { price: 100, discount: 0 } },
        { label: "extreme", value: { price: 1, discount: 200 } },
      ],
      evidence: "Discount reduces price; @param discount - Discount percentage (0-100)",
      confidence: 0.88,
    },
    {
      targetFunction: "applyDiscount",
      description: "Zero discount returns original price unchanged",
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
      evidence: "Zero discount means no change to price",
      confidence: 0.98,
    },
    {
      targetFunction: "applyDiscount",
      description: "100% discount results in zero price",
      category: "boundary",
      assertion: "applyDiscount(price, 100) === 0",
      generators: {
        price: { type: "float", constraints: { min: 0, max: 10000 } },
      },
      seedInputs: [
        { label: "normal", value: { price: 50 } },
        { label: "boundary", value: { price: 0 } },
        { label: "extreme", value: { price: 0.001 } },
      ],
      evidence: "100% discount = free; price * (1 - 100/100) = 0",
      confidence: 0.95,
    },
  ],

  calculateTotal: [
    {
      targetFunction: "calculateTotal",
      description: "Total of empty array is zero",
      category: "boundary",
      assertion: "calculateTotal([]) === 0",
      generators: {},
      seedInputs: [
        { label: "boundary", value: {} },
      ],
      evidence: "@param prices - Array of item prices; empty cart costs nothing",
      confidence: 0.95,
    },
    {
      targetFunction: "calculateTotal",
      description: "Total of single-item array equals the item",
      category: "boundary",
      assertion: "calculateTotal([price]) === price",
      generators: {
        price: { type: "float", constraints: { min: 0, max: 10000 } },
      },
      seedInputs: [
        { label: "normal", value: { price: 42.99 } },
        { label: "boundary", value: { price: 0 } },
        { label: "extreme", value: { price: 99999 } },
      ],
      evidence: "Single item total = the item itself",
      confidence: 0.97,
    },
    {
      targetFunction: "calculateTotal",
      description: "Total is non-negative when all prices are non-negative",
      category: "boundary",
      assertion: "prices.every(p => p >= 0) ? calculateTotal(prices) >= 0 : true",
      generators: {
        prices: { type: "array", constraints: { element: "float", maxLength: 20 } },
      },
      seedInputs: [
        { label: "normal", value: { prices: [10, 20, 30] } },
        { label: "boundary", value: { prices: [] } },
        { label: "extreme", value: { prices: [0.01] } },
      ],
      evidence: "@returns Total sum; sum of non-negative numbers is non-negative",
      confidence: 0.85,
    },
  ],

  formatPrice: [
    {
      targetFunction: "formatPrice",
      description: "Output always has exactly 2 decimal places",
      category: "type-preservation",
      assertion: "/^-?\\d+\\.\\d{2}$/.test(formatPrice(price))",
      generators: {
        price: { type: "float", constraints: { min: -10000, max: 10000 } },
      },
      seedInputs: [
        { label: "normal", value: { price: 42.5 } },
        { label: "boundary", value: { price: 0 } },
        { label: "extreme", value: { price: 1000000 } },
      ],
      evidence: "@returns Formatted string like \"99.99\"; toFixed(2) always gives 2 decimals",
      confidence: 0.93,
    },
    {
      targetFunction: "formatPrice",
      description: "Parsing formatted price back gives approximately the original",
      category: "roundtrip",
      assertion: "Math.abs(parseFloat(formatPrice(price)) - price) < 0.01",
      generators: {
        price: { type: "float", constraints: { min: -10000, max: 10000 } },
      },
      seedInputs: [
        { label: "normal", value: { price: 42.99 } },
        { label: "boundary", value: { price: 0 } },
        { label: "extreme", value: { price: 0.1 + 0.2 } },
      ],
      evidence: "Formatted price should round-trip within rounding tolerance",
      confidence: 0.8,
    },
  ],

  // ═══════════════════════════════════════
  // sort-utils.ts
  // ═══════════════════════════════════════

  sortNumbers: [
    {
      targetFunction: "sortNumbers",
      description: "Output length equals input length",
      category: "conservation",
      assertion: "sortNumbers(arr).length === arr.length",
      generators: {
        arr: { type: "array", constraints: { element: "float", maxLength: 50 } },
      },
      seedInputs: [
        { label: "normal", value: { arr: [3, 1, 2] } },
        { label: "boundary", value: { arr: [] } },
        { label: "extreme", value: { arr: [1] } },
      ],
      evidence: "Sorting should not add or remove elements",
      confidence: 0.99,
    },
    {
      targetFunction: "sortNumbers",
      description: "Output is monotonically non-decreasing",
      category: "monotonic",
      assertion: "sortNumbers(arr).every((v, i, a) => i === 0 || a[i-1] <= v)",
      generators: {
        arr: { type: "array", constraints: { element: "float", maxLength: 50 } },
      },
      seedInputs: [
        { label: "normal", value: { arr: [5, 2, 8, 1] } },
        { label: "boundary", value: { arr: [1, 1, 1] } },
        { label: "extreme", value: { arr: [100, -100, 0] } },
      ],
      evidence: "@returns New sorted array; ascending order",
      confidence: 0.99,
    },
    {
      targetFunction: "sortNumbers",
      description: "Sorting is idempotent",
      category: "idempotent",
      assertion: "JSON.stringify(sortNumbers(sortNumbers(arr))) === JSON.stringify(sortNumbers(arr))",
      generators: {
        arr: { type: "array", constraints: { element: "float", maxLength: 30 } },
      },
      seedInputs: [
        { label: "normal", value: { arr: [3, 1, 2] } },
        { label: "boundary", value: { arr: [] } },
        { label: "extreme", value: { arr: [1, 2, 3] } },
      ],
      evidence: "Sorting an already sorted array should be a no-op",
      confidence: 0.97,
    },
    {
      targetFunction: "sortNumbers",
      description: "Does not mutate the input array",
      category: "boundary",
      assertion: "(() => { const copy = [...arr]; sortNumbers(arr); return JSON.stringify(arr) === JSON.stringify(copy); })()",
      generators: {
        arr: { type: "array", constraints: { element: "integer", maxLength: 20 } },
      },
      seedInputs: [
        { label: "normal", value: { arr: [3, 1, 2] } },
        { label: "boundary", value: { arr: [] } },
        { label: "extreme", value: { arr: [1] } },
      ],
      evidence: "Uses [...arr].sort() — spread creates a copy",
      confidence: 0.95,
    },
  ],

  unique: [
    {
      targetFunction: "unique",
      description: "Output has no duplicate elements",
      category: "boundary",
      assertion: "new Set(unique(arr)).size === unique(arr).length",
      generators: {
        arr: { type: "array", constraints: { element: "integer", maxLength: 50 } },
      },
      seedInputs: [
        { label: "normal", value: { arr: [1, 2, 2, 3] } },
        { label: "boundary", value: { arr: [] } },
        { label: "extreme", value: { arr: [1, 1, 1, 1] } },
      ],
      evidence: "Uses new Set() which removes duplicates",
      confidence: 0.99,
    },
    {
      targetFunction: "unique",
      description: "Output length is at most input length",
      category: "conservation",
      assertion: "unique(arr).length <= arr.length",
      generators: {
        arr: { type: "array", constraints: { element: "integer", maxLength: 50 } },
      },
      seedInputs: [
        { label: "normal", value: { arr: [1, 2, 3] } },
        { label: "boundary", value: { arr: [] } },
        { label: "extreme", value: { arr: [5, 5, 5] } },
      ],
      evidence: "Removing duplicates can only reduce or maintain length",
      confidence: 0.98,
    },
    {
      targetFunction: "unique",
      description: "Unique is idempotent",
      category: "idempotent",
      assertion: "JSON.stringify(unique(unique(arr))) === JSON.stringify(unique(arr))",
      generators: {
        arr: { type: "array", constraints: { element: "integer", maxLength: 30 } },
      },
      seedInputs: [
        { label: "normal", value: { arr: [1, 2, 2, 3] } },
        { label: "boundary", value: { arr: [] } },
        { label: "extreme", value: { arr: [1] } },
      ],
      evidence: "Applying unique to already-unique array should be a no-op",
      confidence: 0.96,
    },
  ],

  mergeSorted: [
    {
      targetFunction: "mergeSorted",
      description: "Output length equals sum of input lengths",
      category: "conservation",
      assertion: "mergeSorted(a, b).length === a.length + b.length",
      generators: {
        a: { type: "array", constraints: { element: "integer", maxLength: 30 } },
        b: { type: "array", constraints: { element: "integer", maxLength: 30 } },
      },
      seedInputs: [
        { label: "normal", value: { a: [1, 3, 5], b: [2, 4, 6] } },
        { label: "boundary", value: { a: [], b: [] } },
        { label: "extreme", value: { a: [1], b: [] } },
      ],
      evidence: "Merge should include all elements from both arrays",
      confidence: 0.99,
    },
    {
      targetFunction: "mergeSorted",
      description: "Output is sorted when both inputs are sorted",
      category: "monotonic",
      assertion: "(() => { const sa = [...a].sort((x,y) => x-y); const sb = [...b].sort((x,y) => x-y); return mergeSorted(sa, sb).every((v, i, r) => i === 0 || r[i-1] <= v); })()",
      generators: {
        a: { type: "array", constraints: { element: "integer", maxLength: 20 } },
        b: { type: "array", constraints: { element: "integer", maxLength: 20 } },
      },
      seedInputs: [
        { label: "normal", value: { a: [1, 3, 5], b: [2, 4, 6] } },
        { label: "boundary", value: { a: [], b: [1] } },
        { label: "extreme", value: { a: [1, 1], b: [1, 1] } },
      ],
      evidence: "@param a - First sorted array; @param b - Second sorted array; result should be sorted",
      confidence: 0.95,
    },
  ],

  // ═══════════════════════════════════════
  // string-utils.ts
  // ═══════════════════════════════════════

  reverseString: [
    {
      targetFunction: "reverseString",
      description: "Reversing twice returns original",
      category: "roundtrip",
      assertion: "reverseString(reverseString(str)) === str",
      generators: {
        str: { type: "string", constraints: { maxLength: 100 } },
      },
      seedInputs: [
        { label: "normal", value: { str: "hello" } },
        { label: "boundary", value: { str: "" } },
        { label: "extreme", value: { str: "a" } },
      ],
      evidence: "Reverse is its own inverse: reverse(reverse(x)) === x",
      confidence: 0.99,
    },
    {
      targetFunction: "reverseString",
      description: "Length is preserved after reversing",
      category: "conservation",
      assertion: "reverseString(str).length === str.length",
      generators: {
        str: { type: "string", constraints: { maxLength: 100 } },
      },
      seedInputs: [
        { label: "normal", value: { str: "test" } },
        { label: "boundary", value: { str: "" } },
        { label: "extreme", value: { str: "x" } },
      ],
      evidence: "Reversing characters does not change count",
      confidence: 0.99,
    },
    {
      targetFunction: "reverseString",
      description: "First character becomes last character",
      category: "metamorphic",
      assertion: "str.length === 0 || reverseString(str)[str.length - 1] === str[0]",
      generators: {
        str: { type: "string", constraints: { maxLength: 50 } },
      },
      seedInputs: [
        { label: "normal", value: { str: "abc" } },
        { label: "boundary", value: { str: "x" } },
        { label: "extreme", value: { str: "" } },
      ],
      evidence: "Reversing puts first element at the end",
      confidence: 0.93,
    },
  ],

  truncate: [
    {
      targetFunction: "truncate",
      description: "Output length never exceeds maxLen",
      category: "boundary",
      assertion: "truncate(str, maxLen).length <= maxLen",
      generators: {
        str: { type: "string", constraints: { maxLength: 200 } },
        maxLen: { type: "integer", constraints: { min: 3, max: 200 } },
      },
      seedInputs: [
        { label: "normal", value: { str: "hello world", maxLen: 8 } },
        { label: "boundary", value: { str: "hi", maxLen: 3 } },
        { label: "extreme", value: { str: "a".repeat(100), maxLen: 3 } },
      ],
      evidence: "@param maxLen - Maximum length; result should respect this limit",
      confidence: 0.95,
    },
    {
      targetFunction: "truncate",
      description: "Short strings are returned unchanged",
      category: "boundary",
      assertion: "str.length <= maxLen ? truncate(str, maxLen) === str : true",
      generators: {
        str: { type: "string", constraints: { maxLength: 50 } },
        maxLen: { type: "integer", constraints: { min: 3, max: 100 } },
      },
      seedInputs: [
        { label: "normal", value: { str: "hi", maxLen: 10 } },
        { label: "boundary", value: { str: "abc", maxLen: 3 } },
        { label: "extreme", value: { str: "", maxLen: 5 } },
      ],
      evidence: "if (str.length <= maxLen) return str — code returns unchanged",
      confidence: 0.97,
    },
    {
      targetFunction: "truncate",
      description: "Truncated strings end with ellipsis",
      category: "type-preservation",
      assertion: "str.length > maxLen ? truncate(str, maxLen).endsWith('...') : true",
      generators: {
        str: { type: "string", constraints: { maxLength: 200 } },
        maxLen: { type: "integer", constraints: { min: 3, max: 100 } },
      },
      seedInputs: [
        { label: "normal", value: { str: "hello world!", maxLen: 8 } },
        { label: "boundary", value: { str: "abcdef", maxLen: 3 } },
        { label: "extreme", value: { str: "a".repeat(50), maxLen: 4 } },
      ],
      evidence: "return str.slice(0, maxLen - 3) + '...' — adds ellipsis",
      confidence: 0.96,
    },
  ],

  isPalindrome: [
    {
      targetFunction: "isPalindrome",
      description: "Empty string is a palindrome",
      category: "boundary",
      assertion: "isPalindrome('') === true",
      generators: {},
      seedInputs: [
        { label: "boundary", value: {} },
      ],
      evidence: "Empty string reversed equals itself",
      confidence: 0.95,
    },
    {
      targetFunction: "isPalindrome",
      description: "Single characters are palindromes",
      category: "boundary",
      assertion: "isPalindrome(str) === true",
      generators: {
        str: { type: "string", constraints: { maxLength: 1 } },
      },
      seedInputs: [
        { label: "normal", value: { str: "a" } },
        { label: "boundary", value: { str: "Z" } },
        { label: "extreme", value: { str: "5" } },
      ],
      evidence: "Any single character reads the same forwards and backwards",
      confidence: 0.95,
    },
    {
      targetFunction: "isPalindrome",
      description: "Concatenating a string with its reverse is always a palindrome",
      category: "metamorphic",
      assertion: "isPalindrome(str + str.split('').reverse().join('')) === true",
      generators: {
        str: { type: "string", constraints: { maxLength: 20 } },
      },
      seedInputs: [
        { label: "normal", value: { str: "abc" } },
        { label: "boundary", value: { str: "" } },
        { label: "extreme", value: { str: "x" } },
      ],
      evidence: "str + reverse(str) is always a palindrome by construction",
      confidence: 0.88,
    },
  ],

  // ═══════════════════════════════════════
  // Python: calculator.py
  // ═══════════════════════════════════════

  add: [
    {
      targetFunction: "add",
      description: "Addition is commutative",
      category: "equivalence",
      assertion: "add(a, b) === add(b, a)",
      generators: {
        a: { type: "integer", constraints: { min: -10000, max: 10000 } },
        b: { type: "integer", constraints: { min: -10000, max: 10000 } },
      },
      seedInputs: [
        { label: "normal", value: { a: 3, b: 5 } },
        { label: "boundary", value: { a: 0, b: 0 } },
        { label: "extreme", value: { a: -9999, b: 9999 } },
      ],
      evidence: "Addition: a + b == b + a for all integers",
      confidence: 0.99,
    },
    {
      targetFunction: "add",
      description: "Zero is identity element for addition",
      category: "boundary",
      assertion: "add(a, 0) === a",
      generators: {
        a: { type: "integer", constraints: { min: -10000, max: 10000 } },
      },
      seedInputs: [
        { label: "normal", value: { a: 42 } },
        { label: "boundary", value: { a: 0 } },
        { label: "extreme", value: { a: -1 } },
      ],
      evidence: "a + 0 = a; additive identity",
      confidence: 0.99,
    },
    {
      targetFunction: "add",
      description: "Addition is associative",
      category: "equivalence",
      assertion: "add(add(a, b), c) === add(a, add(b, c))",
      generators: {
        a: { type: "integer", constraints: { min: -1000, max: 1000 } },
        b: { type: "integer", constraints: { min: -1000, max: 1000 } },
        c: { type: "integer", constraints: { min: -1000, max: 1000 } },
      },
      seedInputs: [
        { label: "normal", value: { a: 1, b: 2, c: 3 } },
        { label: "boundary", value: { a: 0, b: 0, c: 0 } },
        { label: "extreme", value: { a: -999, b: 500, c: 499 } },
      ],
      evidence: "(a + b) + c == a + (b + c); associativity of addition",
      confidence: 0.97,
    },
  ],

  divide: [
    {
      targetFunction: "divide",
      description: "Division by 1 returns the original number",
      category: "boundary",
      assertion: "divide(a, 1) === a",
      generators: {
        a: { type: "float", constraints: { min: -10000, max: 10000 } },
      },
      seedInputs: [
        { label: "normal", value: { a: 42 } },
        { label: "boundary", value: { a: 0 } },
        { label: "extreme", value: { a: -0.001 } },
      ],
      evidence: "a / 1 = a; division by unity identity",
      confidence: 0.98,
    },
    {
      targetFunction: "divide",
      description: "Division of zero always returns zero",
      category: "boundary",
      assertion: "divide(0, b) === 0",
      generators: {
        b: { type: "float", constraints: { min: 0.001, max: 10000 } },
      },
      seedInputs: [
        { label: "normal", value: { b: 5 } },
        { label: "boundary", value: { b: 1 } },
        { label: "extreme", value: { b: 0.001 } },
      ],
      evidence: "0 / b = 0 for any non-zero b",
      confidence: 0.97,
    },
  ],
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
      // Extract function names from prompt (look for "### functionName" headings)
      const funcNameRegex = /^### (\w+)/gm;
      const promptFuncNames: string[] = [];
      let m: RegExpExecArray | null;
      while ((m = funcNameRegex.exec(userPrompt)) !== null) {
        promptFuncNames.push(m[1]);
      }

      // Collect properties for ALL functions found in the prompt
      const allProperties: unknown[] = [];
      const matchedFunctions: string[] = [];

      for (const funcName of promptFuncNames) {
        const props = FUNCTION_PROPERTIES[funcName];
        if (props) {
          allProperties.push(...props);
          matchedFunctions.push(funcName);
        }
      }

      if (matchedFunctions.length === 0) {
        allProperties.push({
          targetFunction: promptFuncNames[0] ?? "unknown",
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
          confidence: 0.5,
        });
      }

      const response = { properties: allProperties };
      const inputTokens = Math.floor(userPrompt.length / 4);
      const outputTokens = Math.floor(JSON.stringify(response).length / 4);

      return {
        content: response,
        inputTokens,
        outputTokens,
        model: "claude-opus-4-20250514-mock",
      };
    },
  };
}
