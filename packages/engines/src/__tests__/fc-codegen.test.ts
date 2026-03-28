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
        s: { type: "string" },
        b: { type: "boolean" },
        f: { type: "float", constraints: { min: 0, max: 1 } },
        arr: { type: "array", constraints: { element: "integer", maxLength: 10 } },
      },
    });

    const result = generateFastCheckTest(
      [prop],
      "/project/src/test.ts",
      "/project/.propcheck/tests",
      defaultConfig,
    );

    assert.ok(result.content.includes("fc.string()"));
    assert.ok(result.content.includes("fc.boolean()"));
    assert.ok(result.content.includes("fc.double("));
    assert.ok(result.content.includes("fc.array("));
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
});
