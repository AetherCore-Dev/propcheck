/**
 * Tests for mock-refinement.ts — mockRefineProperties.
 */

import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import { mockRefineProperties } from "../mock-refinement";
import type { PropertyDefinition } from "@propcheck/common";
import type { PropertyClassification } from "../prompts/refinement";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProperty(overrides: Partial<PropertyDefinition> = {}): PropertyDefinition {
  return {
    id: "prop_001",
    targetFunction: "applyDiscount",
    description: "Discount is non-negative",
    assertion: "result >= 0",
    generators: { price: { type: "float", constraints: { min: 0, max: 10000 } } },
    seedInputs: [{ label: "normal", value: 100 }],
    category: "boundary",
    confidence: 0.8,
    score: 10,
    status: "accepted",
    riskTags: [],
    riskScore: 0,
    humanVerified: false,
    evidence: "Parameter price is numeric",
    sourceHash: "abc123",
    inferredAt: "2026-04-07T00:00:00Z",
    modelId: "mock",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// mockRefineProperties
// ---------------------------------------------------------------------------

describe("mockRefineProperties", () => {
  it("strengthens weak properties", () => {
    const classifications: PropertyClassification[] = [
      { kind: "weak", property: makeProperty({ score: 8, confidence: 0.7 }), reason: "low score" },
    ];
    const result = mockRefineProperties(classifications);
    assert.equal(result.length, 1);
    assert.equal(result[0].score, 10); // 8 + 2
    assert.ok(result[0].confidence > 0.7);
    assert.ok(result[0].description.includes("strengthened"));
  });

  it("caps score at 15 for weak properties", () => {
    const classifications: PropertyClassification[] = [
      { kind: "weak", property: makeProperty({ score: 14 }), reason: "low score" },
    ];
    const result = mockRefineProperties(classifications);
    assert.equal(result[0].score, 15);
  });

  it("caps confidence at 1.0 for weak properties", () => {
    const classifications: PropertyClassification[] = [
      { kind: "weak", property: makeProperty({ confidence: 0.95 }), reason: "low confidence" },
    ];
    const result = mockRefineProperties(classifications);
    assert.equal(result[0].confidence, 1.0);
  });

  it("generates boundary property for bug_found", () => {
    const classifications: PropertyClassification[] = [
      { kind: "bug_found", property: makeProperty({ targetFunction: "parseAmount" }), counterexample: { x: -1 } },
    ];
    const result = mockRefineProperties(classifications);
    assert.equal(result.length, 1);
    assert.equal(result[0].category, "boundary");
    assert.ok(result[0].description.includes("parseAmount"));
    assert.ok(result[0].description.includes("boundary"));
    assert.equal(result[0].score, 13);
  });

  it("skips strong properties (caller preserves them)", () => {
    const classifications: PropertyClassification[] = [
      { kind: "strong", property: makeProperty() },
    ];
    const result = mockRefineProperties(classifications);
    assert.equal(result.length, 0);
  });

  it("skips failed properties", () => {
    const classifications: PropertyClassification[] = [
      { kind: "failed", property: makeProperty(), error: "crash" },
    ];
    const result = mockRefineProperties(classifications);
    assert.equal(result.length, 0);
  });

  it("handles mixed classifications", () => {
    const classifications: PropertyClassification[] = [
      { kind: "strong", property: makeProperty({ id: "prop_001" }) },
      { kind: "weak", property: makeProperty({ id: "prop_002", score: 9 }), reason: "low" },
      { kind: "bug_found", property: makeProperty({ id: "prop_003" }), counterexample: {} },
      { kind: "failed", property: makeProperty({ id: "prop_004" }), error: "err" },
    ];
    const result = mockRefineProperties(classifications);
    // Only weak + bug_found produce output
    assert.equal(result.length, 2);
  });

  it("assigns unique IDs starting from 900", () => {
    const classifications: PropertyClassification[] = [
      { kind: "weak", property: makeProperty({ id: "prop_001" }), reason: "low" },
      { kind: "weak", property: makeProperty({ id: "prop_002" }), reason: "low" },
      { kind: "bug_found", property: makeProperty({ id: "prop_003" }), counterexample: {} },
    ];
    const result = mockRefineProperties(classifications);
    const ids = result.map((p) => p.id);
    assert.equal(ids[0], "prop_900");
    assert.equal(ids[1], "prop_901");
    assert.equal(ids[2], "prop_902");
    // All unique
    assert.equal(new Set(ids).size, ids.length);
  });

  it("returns empty array for empty input", () => {
    const result = mockRefineProperties([]);
    assert.equal(result.length, 0);
  });

  it("preserves targetFunction from original property", () => {
    const classifications: PropertyClassification[] = [
      { kind: "weak", property: makeProperty({ targetFunction: "customFunc" }), reason: "low" },
    ];
    const result = mockRefineProperties(classifications);
    assert.equal(result[0].targetFunction, "customFunc");
  });
});
