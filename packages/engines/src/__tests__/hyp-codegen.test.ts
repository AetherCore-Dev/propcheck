import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import type { PropertyDefinition, RunConfig } from "@propcheck/common";
import { generateHypothesisTest } from "../hypothesis/hyp-codegen";

function makeProp(overrides: Partial<PropertyDefinition> = {}): PropertyDefinition {
  return {
    id: "prop_001",
    targetFunction: "countItems",
    description: "test property",
    category: "boundary",
    assertion: "countItems(items) === 0 || items.length === 0 && !flag && Math.abs(countItems(items)) >= 0",
    generators: {
      items: { type: "array", constraints: { elementType: "float", min: 0, max: 10, maxLength: 4 } },
      flag: { type: "boolean" },
    },
    seedInputs: [{ label: "normal", value: { items: [1, 2], flag: false } }],
    score: 13,
    riskScore: 13,
    riskTags: [],
    status: "accepted",
    confidence: 0.9,
    evidence: "generated for codegen coverage",
    sourceHash: "abc",
    inferredAt: "2026-03-30T00:00:00.000Z",
    modelId: "test-model",
    ...overrides,
  };
}

const config: RunConfig = {
  mode: "quick",
  iterations: 100,
  timeout: 30_000,
  verbose: false,
};

describe("hyp-codegen", () => {
  it("should translate common JS assertion syntax into Python", () => {
    const { content } = generateHypothesisTest(
      [makeProp()],
      "/tmp/example.py",
      "/tmp/.propcheck/tests",
      config,
    );

    assert.ok(content.includes("target.countItems(items) == 0 or len(items) == 0 and not flag and abs(target.countItems(items)) >= 0"));
    assert.ok(!content.includes(".__len__()"));
    assert.ok(!content.includes("&&"));
    assert.ok(!content.includes("||"));
  });

  it("should map array element constraints into Hypothesis strategies", () => {
    const { content } = generateHypothesisTest(
      [makeProp()],
      "/tmp/example.py",
      "/tmp/.propcheck/tests",
      config,
    );

    assert.ok(content.includes("items=st.lists(st.floats(allow_nan=False, allow_infinity=False, min_value=0, max_value=10), max_size=4)"));
  });

  it("should support constant generators for canary validation", () => {
    const { content } = generateHypothesisTest(
      [makeProp({
        generators: {
          items: { type: "constant", constraints: { value: [1, 2] } },
          flag: { type: "constant", constraints: { value: false } },
        },
      })],
      "/tmp/example.py",
      "/tmp/.propcheck/tests",
      config,
    );

    assert.ok(content.includes("def approx_equal("));
    assert.ok(content.includes("items=st.just([1, 2])"));
    assert.ok(content.includes("flag=st.just(False)"));
  });

  // --- Object / Optional / Enum strategy tests ---

  it("should generate st.fixed_dictionaries() for object generators with fields", () => {
    const { content } = generateHypothesisTest(
      [makeProp({
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
      })],
      "/tmp/example.py",
      "/tmp/.propcheck/tests",
      config,
    );

    assert.ok(content.includes('st.fixed_dictionaries({"name": st.text(max_size=50), "age": st.integers(min_value=0, max_value=120)})'),
      "Should generate st.fixed_dictionaries with typed fields");
  });

  it("should generate nested st.fixed_dictionaries() for nested objects", () => {
    const { content } = generateHypothesisTest(
      [makeProp({
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
      })],
      "/tmp/example.py",
      "/tmp/.propcheck/tests",
      config,
    );

    assert.ok(content.includes('st.fixed_dictionaries({"address": st.fixed_dictionaries({"street": st.text(), "city": st.text()})})'),
      "Should generate nested st.fixed_dictionaries");
  });

  it("should generate st.one_of(st.just(None), ...) for optional generators", () => {
    const { content } = generateHypothesisTest(
      [makeProp({
        generators: {
          input: {
            type: "optional",
            constraints: {
              inner: { type: "string", constraints: { maxLength: 100 } },
            },
          },
        },
      })],
      "/tmp/example.py",
      "/tmp/.propcheck/tests",
      config,
    );

    assert.ok(content.includes("st.one_of(st.just(None), st.text(max_size=100))"),
      "Should generate st.one_of with None and inner type");
  });

  it("should generate st.sampled_from() for enum generators", () => {
    const { content } = generateHypothesisTest(
      [makeProp({
        generators: {
          status: {
            type: "enum",
            constraints: {
              values: ["active", "inactive", "pending"],
            },
          },
        },
      })],
      "/tmp/example.py",
      "/tmp/.propcheck/tests",
      config,
    );

    assert.ok(content.includes('st.sampled_from(["active", "inactive", "pending"])'),
      "Should generate st.sampled_from with values");
  });

  it("should treat unknown type with fields as object generator (fallback)", () => {
    const { content } = generateHypothesisTest(
      [makeProp({
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
      })],
      "/tmp/example.py",
      "/tmp/.propcheck/tests",
      config,
    );

    assert.ok(content.includes('st.fixed_dictionaries({"amount": st.floats(allow_nan=False, allow_infinity=False, min_value=0), "currency": st.text()})'),
      "Unknown type with fields should produce st.fixed_dictionaries, not st.integers");
  });
});
