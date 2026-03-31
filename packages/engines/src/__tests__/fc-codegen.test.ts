import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import { generateFastCheckTest } from "../fast-check/fc-codegen";
import type { PropertyDefinition, RunConfig } from "@propcheck/common";

function makeProp(overrides: Partial<PropertyDefinition> = {}): PropertyDefinition {
  return {
    id: "prop_001",
    targetFunction: "add",
    description: "Addition is commutative",
    category: "equivalence",
    assertion: "add(a, b) === add(b, a)",
    generators: {
      a: { type: "integer", constraints: { min: -100, max: 100 } },
      b: { type: "integer", constraints: { min: -100, max: 100 } },
    },
    seedInputs: [
      { label: "normal", value: { a: 3, b: 5 } },
      { label: "boundary", value: { a: 0, b: 0 } },
      { label: "extreme", value: { a: -100, b: 100 } },
    ],
    score: 14,
    riskScore: 14,
    riskTags: [],
    status: "accepted",
    confidence: 0.95,
    evidence: "addition is commutative",
    sourceHash: "abc123",
    inferredAt: "2026-03-25",
    modelId: "test",
    ...overrides,
  };
}

const defaultConfig: RunConfig = {
  mode: "default",
  iterations: 1000,
  timeout: 30000,
  verbose: false,
};

describe("fc-codegen", () => {
  it("should generate valid fast-check test code", () => {
    const props = [makeProp()];
    const result = generateFastCheckTest(
      props,
      "/project/src/math.ts",
      "/project/.propcheck/tests",
      defaultConfig,
    );

    assert.ok(result.content.includes("fast-check"), "Should reference fast-check");
    assert.ok(result.content.includes("fc.integer"));
    assert.ok(result.content.includes("min: -100"));
    assert.ok(result.content.includes("max: 100"));
    assert.ok(result.content.includes("target.add(a, b) === target.add(b, a)"));
    assert.ok(result.content.includes("numRuns"));
    assert.equal(result.fileName, "math.fc.js");
  });

  it("should generate correct import path", () => {
    const props = [makeProp()];
    const result = generateFastCheckTest(
      props,
      "/project/src/math.ts",
      "/project/.propcheck/tests",
      defaultConfig,
    );

    // Import should use forward slashes and be relative
    assert.ok(result.content.includes("require("));
    assert.ok(!result.content.includes("\\\\"));
  });

  it("should handle multiple properties", () => {
    const props = [
      makeProp({ id: "prop_001", description: "Commutativity" }),
      makeProp({
        id: "prop_002",
        description: "Zero identity",
        assertion: "add(a, 0) === a",
        generators: { a: { type: "integer" } },
      }),
    ];

    const result = generateFastCheckTest(
      props,
      "/project/src/math.ts",
      "/project/.propcheck/tests",
      defaultConfig,
    );

    assert.ok(result.content.includes("prop_001"));
    assert.ok(result.content.includes("prop_002"));
  });

  it("should map generator types correctly", () => {
    const prop = makeProp({
      generators: {
        i: { type: "int", constraints: { min: 1, max: 3 } },
        s: { type: "string" },
        b: { type: "boolean" },
        f: { type: "float", constraints: { min: 0, max: 1 } },
        arr: {
          type: "array",
          constraints: {
            element: "integer",
            elementConstraints: { min: 0, max: 10 },
            maxLength: 10,
          },
        },
      },
    });

    const result = generateFastCheckTest(
      [prop],
      "/project/src/test.ts",
      "/project/.propcheck/tests",
      defaultConfig,
    );

    assert.ok(result.content.includes("fc.integer({ min: 1, max: 3 })"), "Should support int alias");
    assert.ok(result.content.includes("fc.string()"));
    assert.ok(result.content.includes("fc.boolean()"));
    assert.ok(result.content.includes("fc.double("));
    assert.ok(result.content.includes("fc.array("));
    assert.ok(result.content.includes("fc.integer({ min: 0, max: 10 })"), "Should preserve nested array element constraints");
  });

  it("should support constant generators for canary validation", () => {
    const prop = makeProp({
      generators: {
        x: { type: "constant", constraints: { value: 0.1 } },
        y: { type: "constant", constraints: { value: [1, 2] } },
      },
      assertion: "add(x, 0) === x",
    });

    const result = generateFastCheckTest(
      [prop],
      "/project/src/test.ts",
      "/project/.propcheck/tests",
      defaultConfig,
    );

    assert.ok(result.content.includes("function approxEqual("));
    assert.ok(result.content.includes("fc.constant(0.1)"));
    assert.ok(result.content.includes("fc.constant([1,2])"));
  });

  it("should respect seed in config", () => {
    const config: RunConfig = { ...defaultConfig, seed: 42 };
    const result = generateFastCheckTest(
      [makeProp()],
      "/project/src/math.ts",
      "/project/.propcheck/tests",
      config,
    );

    assert.ok(result.content.includes("seed: 42"));
  });

  it("should handle zero-parameter assertions via fc.constant(null)", () => {
    const prop = makeProp({
      id: "prop_zero",
      targetFunction: "calculateTotal",
      assertion: "calculateTotal([]) === 0",
      generators: {},
    });

    const result = generateFastCheckTest(
      [prop],
      "/project/src/cart.ts",
      "/project/.propcheck/tests",
      defaultConfig,
    );

    // Should use fc.constant(null) as a dummy arbitrary instead of
    // a plain boolean check, so all properties go through fc.assert.
    assert.ok(result.content.includes("fc.constant(null)"), "Should use fc.constant(null) for zero-param");
    assert.ok(result.content.includes("fc.assert("), "Should use fc.assert");
    assert.ok(result.content.includes("numRuns: 1"), "Should run exactly 1 iteration");
    assert.ok(result.content.includes("target.calculateTotal([]) === 0"), "Should rewrite function name");
  });

  it("should handle array literal assertions correctly", () => {
    const prop = makeProp({
      id: "prop_arr",
      targetFunction: "calculateTotal",
      assertion: "calculateTotal([price]) === price",
      generators: {
        price: { type: "float", constraints: { min: 0, max: 10000 } },
      },
    });

    const result = generateFastCheckTest(
      [prop],
      "/project/src/cart.ts",
      "/project/.propcheck/tests",
      defaultConfig,
    );

    // [price] is valid JS — price is a lambda param and [price] creates an array.
    // The generated code should contain the assertion with target-qualified function name.
    assert.ok(result.content.includes("target.calculateTotal([price]) === price"), "Should preserve array literal");
    assert.ok(result.content.includes("fc.double("), "Should generate double arbitrary");
    assert.ok(result.content.includes("(price)"), "Should use price as lambda param");
  });

  it("should default unconstrained doubles to non-negative range", () => {
    const prop = makeProp({
      generators: {
        x: { type: "float" },
      },
    });

    const result = generateFastCheckTest(
      [prop],
      "/project/src/test.ts",
      "/project/.propcheck/tests",
      defaultConfig,
    );

    assert.ok(result.content.includes("min: 0"), "Unconstrained double should default to min: 0");
    assert.ok(result.content.includes("noNaN: true"), "Should include noNaN");
    assert.ok(result.content.includes("noDefaultInfinity: true"), "Should include noDefaultInfinity");
  });

  it("should preserve explicit constraints on doubles", () => {
    const prop = makeProp({
      generators: {
        x: { type: "float", constraints: { min: -50, max: 50 } },
      },
    });

    const result = generateFastCheckTest(
      [prop],
      "/project/src/test.ts",
      "/project/.propcheck/tests",
      defaultConfig,
    );

    assert.ok(result.content.includes("min: -50"), "Should preserve explicit min");
    assert.ok(result.content.includes("max: 50"), "Should preserve explicit max");
  });

  it("should normalize top-level implies syntax into valid JS", () => {
    const prop = makeProp({
      targetFunction: "applyDiscount",
      assertion: "discount1 <= discount2 implies applyDiscount(price, discount1) >= applyDiscount(price, discount2)",
      generators: {
        price: { type: "float", constraints: { min: 0, max: 1000 } },
        discount1: { type: "float", constraints: { min: 0, max: 100 } },
        discount2: { type: "float", constraints: { min: 0, max: 100 } },
      },
    });

    const result = generateFastCheckTest(
      [prop],
      "/project/src/cart.ts",
      "/project/.propcheck/tests",
      defaultConfig,
    );

    assert.ok(
      result.content.includes("!(discount1 <= discount2) || (target.applyDiscount(price, discount1) >= target.applyDiscount(price, discount2))"),
      "Should rewrite implies to JS implication",
    );
  });

  it("should support alternate array constraint field names from providers", () => {
    const prop = makeProp({
      targetFunction: "calculateTotal",
      assertion: "calculateTotal(prices) >= 0",
      generators: {
        prices: {
          type: "array",
          constraints: {
            elementType: "float",
            elementMin: 0,
            elementMax: 100,
            maxLength: 5,
          },
        },
      },
    });

    const result = generateFastCheckTest(
      [prop],
      "/project/src/cart.ts",
      "/project/.propcheck/tests",
      defaultConfig,
    );

    assert.ok(result.content.includes("fc.array(fc.double({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true }), { maxLength: 5 })"));
  });

  it("should not rewrite quoted implies occurrences", () => {
    const prop = makeProp({
      targetFunction: "formatLabel",
      assertion: "formatLabel(label) === 'implies'",
      generators: { label: { type: "string", constraints: { maxLength: 20 } } },
    });

    const result = generateFastCheckTest(
      [prop],
      "/project/src/labels.ts",
      "/project/.propcheck/tests",
      defaultConfig,
    );

    assert.ok(result.content.includes("target.formatLabel(label) === 'implies'"));
  });

  it("should handle real provider array constraints with direct min/max keys", () => {
    // Real providers (Claude via OpenAI-compatible gateway) return:
    //   { elementType: "float", min: 0, max: 10000, maxLength: 50 }
    // instead of { elementConstraints: { min, max } }
    const prop = makeProp({
      targetFunction: "calculateTotal",
      assertion: "calculateTotal(prices) >= 0",
      generators: {
        prices: {
          type: "array",
          constraints: {
            elementType: "float",
            min: 0,
            max: 10000,
            maxLength: 50,
          },
        },
      },
    });

    const result = generateFastCheckTest(
      [prop],
      "/project/src/cart.ts",
      "/project/.propcheck/tests",
      defaultConfig,
    );

    // Must NOT fall back to fc.anything() — should use constrained double
    assert.ok(
      result.content.includes("fc.array(fc.double({ min: 0, max: 10000, noNaN: true, noDefaultInfinity: true }), { maxLength: 50 })"),
      "Should use direct min/max from array constraints as element constraints",
    );
  });

  // --- Real LLM assertion patterns (from Claude Opus 4.6 output) ---

  it("should NOT prefix target. on method calls like .match(), .split(), .concat(), .reverse()", () => {
    // Simulates real assertions from Claude Opus 4.6 for formatPrice / calculateTotal
    const props = [
      makeProp({
        id: "prop_011",
        targetFunction: "formatPrice",
        assertion: "(formatPrice(price).match(/\\\\./g) || []).length === 1",
        generators: { price: { type: "float", constraints: { min: 0, max: 1000000 } } },
      }),
      makeProp({
        id: "prop_012",
        targetFunction: "formatPrice",
        assertion: "formatPrice(price).split('.')[1].length === 2",
        generators: { price: { type: "float", constraints: { min: 0, max: 1000000 } } },
      }),
    ];

    const result = generateFastCheckTest(
      props,
      "/project/src/price-utils.ts",
      "/project/.propcheck/tests",
      defaultConfig,
    );

    // .match() and .split() are method calls — must NOT become .target.match() or .target.split()
    assert.ok(
      result.content.includes("target.formatPrice(price).match("),
      "Should qualify formatPrice but not .match()",
    );
    assert.ok(
      !result.content.includes(".target.match("),
      "Must NOT produce .target.match()",
    );
    assert.ok(
      result.content.includes("target.formatPrice(price).split("),
      "Should qualify formatPrice but not .split()",
    );
    assert.ok(
      !result.content.includes(".target.split("),
      "Must NOT produce .target.split()",
    );
  });

  it("should NOT prefix target. on Math.abs()", () => {
    const props = [
      makeProp({
        id: "prop_005",
        targetFunction: "applyDiscount",
        assertion: "Math.abs(applyDiscount(price, discount) - (price - price * discount / 100)) < 1e-10",
        generators: {
          discount: { type: "float", constraints: { min: 0, max: 100 } },
          price: { type: "float", constraints: { min: 0, max: 100000 } },
        },
      }),
    ];

    const result = generateFastCheckTest(
      props,
      "/project/src/price-utils.ts",
      "/project/.propcheck/tests",
      defaultConfig,
    );

    assert.ok(
      result.content.includes("Math.abs(target.applyDiscount("),
      "Should qualify applyDiscount but keep Math.abs intact",
    );
    assert.ok(
      !result.content.includes("Math.target.abs("),
      "Must NOT produce Math.target.abs()",
    );
  });

  it("should NOT prefix target. on .concat() and .reverse() in array assertions", () => {
    const props = [
      makeProp({
        id: "prop_008",
        targetFunction: "calculateTotal",
        assertion: "Math.abs(calculateTotal(a.concat(b)) - (calculateTotal(a) + calculateTotal(b))) < 1e-6",
        generators: {
          a: { type: "array", constraints: { elementType: "float", min: 0, max: 10000, maxLength: 20 } },
          b: { type: "array", constraints: { elementType: "float", min: 0, max: 10000, maxLength: 20 } },
        },
      }),
      makeProp({
        id: "prop_009",
        targetFunction: "calculateTotal",
        assertion: "Math.abs(calculateTotal(prices) - calculateTotal([...prices].reverse())) < 1e-6",
        generators: {
          prices: { type: "array", constraints: { elementType: "float", min: 0, max: 10000, maxLength: 50 } },
        },
      }),
    ];

    const result = generateFastCheckTest(
      props,
      "/project/src/price-utils.ts",
      "/project/.propcheck/tests",
      defaultConfig,
    );

    assert.ok(
      result.content.includes("a.concat(b)"),
      "Should keep .concat() as method call",
    );
    assert.ok(
      !result.content.includes("a.target.concat("),
      "Must NOT produce a.target.concat()",
    );
    assert.ok(
      result.content.includes("[...prices].reverse()"),
      "Should keep .reverse() as method call",
    );
    assert.ok(
      !result.content.includes(".target.reverse("),
      "Must NOT produce .target.reverse()",
    );
  });

  it("should NOT prefix target. on parseFloat/isNaN/isFinite globals", () => {
    const props = [
      makeProp({
        id: "prop_013",
        targetFunction: "formatPrice",
        assertion: "Math.abs(parseFloat(formatPrice(price)) - price) < 0.005 + 1e-10",
        generators: { price: { type: "float", constraints: { min: 0, max: 1000000 } } },
      }),
      makeProp({
        id: "prop_015",
        targetFunction: "formatPrice",
        assertion: "!isNaN(parseFloat(formatPrice(price))) && isFinite(parseFloat(formatPrice(price)))",
        generators: { price: { type: "float", constraints: { min: 0, max: 1000000 } } },
      }),
    ];

    const result = generateFastCheckTest(
      props,
      "/project/src/price-utils.ts",
      "/project/.propcheck/tests",
      defaultConfig,
    );

    // parseFloat, isNaN, isFinite are JS globals — must NOT be prefixed
    assert.ok(
      result.content.includes("parseFloat(target.formatPrice(price))"),
      "parseFloat should stay global, formatPrice should be qualified",
    );
    assert.ok(
      !result.content.includes("target.parseFloat("),
      "Must NOT produce target.parseFloat()",
    );
    assert.ok(
      result.content.includes("!isNaN("),
      "isNaN should stay global",
    );
    assert.ok(
      !result.content.includes("target.isNaN("),
      "Must NOT produce target.isNaN()",
    );
    assert.ok(
      result.content.includes("isFinite("),
      "isFinite should stay global",
    );
    assert.ok(
      !result.content.includes("target.isFinite("),
      "Must NOT produce target.isFinite()",
    );
  });

  it("should qualify multiple target functions in cross-function assertions", () => {
    // formatPrice(parseFloat(formatPrice(price))) — both formatPrice calls should be qualified
    const props = [
      makeProp({
        id: "prop_014",
        targetFunction: "formatPrice",
        assertion: "formatPrice(parseFloat(formatPrice(price))) === formatPrice(price)",
        generators: { price: { type: "float", constraints: { min: 0, max: 1000000 } } },
      }),
    ];

    const result = generateFastCheckTest(
      props,
      "/project/src/price-utils.ts",
      "/project/.propcheck/tests",
      defaultConfig,
    );

    // All occurrences of formatPrice should be qualified
    assert.ok(
      result.content.includes("target.formatPrice(parseFloat(target.formatPrice(price))) === target.formatPrice(price)"),
      "Should qualify all formatPrice calls but keep parseFloat global",
    );
  });
});
