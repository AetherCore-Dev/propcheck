import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
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

  it("should emit .fc.cjs in type-module projects", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "propcheck-fc-esm-"));
    try {
      const projectDir = path.join(tmpDir, "project");
      const srcDir = path.join(projectDir, "src");
      const testsDir = path.join(projectDir, ".propcheck", "tests");
      fs.mkdirSync(srcDir, { recursive: true });
      fs.mkdirSync(testsDir, { recursive: true });
      fs.writeFileSync(
        path.join(projectDir, "package.json"),
        JSON.stringify({ type: "module" }, null, 2),
        "utf8",
      );

      const result = generateFastCheckTest(
        [makeProp()],
        path.join(srcDir, "math.ts"),
        testsDir,
        defaultConfig,
      );

      assert.equal(result.fileName, "math.fc.cjs");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
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

  it("should support array constraints with items as nested generator spec (LLM format)", () => {
    // Real LLMs (claude-sonnet-4-6 via fucheers proxy) return:
    //   { type: "array", constraints: { items: { type: "float", constraints: { min: 0, max: 10000 } }, maxLength: 50 } }
    const prop = makeProp({
      targetFunction: "calculateTotal",
      assertion: "calculateTotal(prices) >= 0",
      generators: {
        prices: {
          type: "array",
          constraints: {
            items: { type: "float", constraints: { min: 0, max: 10000 } },
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

    assert.ok(
      result.content.includes("fc.array(fc.double({ min: 0, max: 10000, noNaN: true, noDefaultInfinity: true }), { maxLength: 50 })"),
      "Should extract element type from items.type and items.constraints",
    );
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

  // --- Object / Optional / Enum generator tests ---

  it("should generate fc.record() for object generators with fields", () => {
    const prop = makeProp({
      generators: {
        input: {
          type: "object",
          constraints: {
            fields: {
              name: { type: "string", constraints: { maxLength: 50 } },
              age: { type: "integer", constraints: { min: 0, max: 120 } },
            },
          },
        },
      },
    });

    const result = generateFastCheckTest(
      [prop],
      "/project/src/user.ts",
      "/project/.propcheck/tests",
      defaultConfig,
    );

    assert.ok(result.content.includes("fc.record({ name: fc.string({ maxLength: 50 }), age: fc.integer({ min: 0, max: 120 }) })"),
      "Should generate fc.record with typed fields");
  });

  it("should generate nested fc.record() for nested object generators", () => {
    const prop = makeProp({
      generators: {
        input: {
          type: "object",
          constraints: {
            fields: {
              address: {
                type: "object",
                constraints: {
                  fields: {
                    street: { type: "string" },
                    city: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    });

    const result = generateFastCheckTest(
      [prop],
      "/project/src/user.ts",
      "/project/.propcheck/tests",
      defaultConfig,
    );

    assert.ok(result.content.includes("fc.record({ address: fc.record({ street: fc.string(), city: fc.string() }) })"),
      "Should generate nested fc.record");
  });

  it("should generate fc.option() for optional generators", () => {
    const prop = makeProp({
      generators: {
        input: {
          type: "optional",
          constraints: {
            inner: { type: "string", constraints: { maxLength: 100 } },
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

    assert.ok(result.content.includes("fc.option(fc.string({ maxLength: 100 }))"),
      "Should generate fc.option with inner type");
  });

  it("should generate fc.constantFrom() for enum generators", () => {
    const prop = makeProp({
      generators: {
        status: {
          type: "enum",
          constraints: {
            values: ["active", "inactive", "pending"],
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

    assert.ok(result.content.includes('fc.constantFrom("active", "inactive", "pending")'),
      "Should generate fc.constantFrom with values");
  });

  it("should generate fc.record({}) for object with empty fields", () => {
    const prop = makeProp({
      generators: {
        input: {
          type: "object",
          constraints: { fields: {} },
        },
      },
    });

    const result = generateFastCheckTest(
      [prop],
      "/project/src/test.ts",
      "/project/.propcheck/tests",
      defaultConfig,
    );

    assert.ok(result.content.includes("fc.record({})"),
      "Should generate empty fc.record");
  });

  it("should treat unknown type with fields as object generator (fallback)", () => {
    const prop = makeProp({
      generators: {
        challenge: {
          type: "X402PaymentChallenge",
          constraints: {
            fields: {
              amount: { type: "float", constraints: { min: 0 } },
              currency: { type: "string" },
            },
          },
        },
      },
    });

    const result = generateFastCheckTest(
      [prop],
      "/project/src/protocol.ts",
      "/project/.propcheck/tests",
      defaultConfig,
    );

    assert.ok(result.content.includes("fc.record({ amount: fc.double({ min: 0, noNaN: true, noDefaultInfinity: true }), currency: fc.string() })"),
      "Unknown type with fields should produce fc.record, not fc.anything");
    assert.ok(!result.content.includes("fc.anything()"),
      "Should NOT fall back to fc.anything");
  });

  it("should fall back to fc.anything() for unknown type without fields", () => {
    const prop = makeProp({
      generators: {
        challenge: { type: "X402PaymentChallenge" },
      },
    });

    const result = generateFastCheckTest(
      [prop],
      "/project/src/protocol.ts",
      "/project/.propcheck/tests",
      defaultConfig,
    );

    assert.ok(result.content.includes("fc.anything()"),
      "Unknown type without fields should still be fc.anything");
  });

  it("should handle mixed field types in object generators", () => {
    const prop = makeProp({
      generators: {
        config: {
          type: "object",
          constraints: {
            fields: {
              name: { type: "string" },
              count: { type: "integer", constraints: { min: 0 } },
              enabled: { type: "boolean" },
              tags: { type: "array", constraints: { element: "string", maxLength: 5 } },
              status: { type: "enum", constraints: { values: ["on", "off"] } },
              metadata: { type: "optional", constraints: { inner: { type: "string" } } },
            },
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

    assert.ok(result.content.includes("fc.record({"), "Should contain fc.record");
    assert.ok(result.content.includes("name: fc.string()"), "Should have string field");
    assert.ok(result.content.includes("count: fc.integer({ min: 0 })"), "Should have integer field");
    assert.ok(result.content.includes("enabled: fc.boolean()"), "Should have boolean field");
    assert.ok(result.content.includes("tags: fc.array(fc.string(), { maxLength: 5 })"), "Should have array field");
    assert.ok(result.content.includes('status: fc.constantFrom("on", "off")'), "Should have enum field");
    assert.ok(result.content.includes("metadata: fc.option(fc.string())"), "Should have optional field");
  });

  it("should guard against deeply nested objects (depth > 10)", () => {
    // Build a deeply nested object spec that exceeds MAX_GENERATOR_DEPTH
    let innermost: Record<string, unknown> = { type: "string" };
    for (let i = 0; i < 15; i++) {
      innermost = {
        type: "object",
        constraints: { fields: { nested: innermost } },
      };
    }

    const prop = makeProp({
      generators: {
        deep: innermost as { type: string; constraints?: Record<string, unknown> },
      },
    });

    const result = generateFastCheckTest(
      [prop],
      "/project/src/test.ts",
      "/project/.propcheck/tests",
      defaultConfig,
    );

    // Should not throw. The deeply nested parts will resolve to fc.anything()
    // due to the depth guard, preventing stack overflow.
    assert.ok(result.content.includes("fc.record("), "Should still generate outer fc.record");
    assert.ok(result.content.includes("fc.anything()"), "Deep nesting should fall back to fc.anything");
  });

  it("should strip block comment terminators from description in comments", () => {
    const prop = makeProp({
      description: "Ensure result */ is safe /* and */ balanced",
    });

    const result = generateFastCheckTest(
      [prop],
      "/project/src/test.ts",
      "/project/.propcheck/tests",
      defaultConfig,
    );

    // The description is embedded in // comments, but */ should still be neutralized
    assert.ok(
      !result.content.includes("*/"),
      "Generated code must not contain unescaped block comment terminator from description",
    );
    assert.ok(
      result.content.includes("* /"),
      "Block comment terminator should be neutralized to '* /'",
    );
  });
});
