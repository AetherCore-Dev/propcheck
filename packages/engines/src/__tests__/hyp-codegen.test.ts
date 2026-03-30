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
});
