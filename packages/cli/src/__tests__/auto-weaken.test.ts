/**
 * Edge case tests for autoWeakenProperty and its helper functions.
 * These are exported from infer.ts for testability.
 */
import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import { autoWeakenProperty } from "../commands/infer";
import type { PropertyDefinition } from "@propcheck/common";

function makeProp(overrides: Partial<PropertyDefinition> = {}): PropertyDefinition {
  return {
    id: "prop_001",
    targetFunction: "add",
    description: "test",
    category: "boundary",
    assertion: "add(a, b) >= 0",
    generators: { a: { type: "integer" }, b: { type: "integer" } },
    seedInputs: [
      { label: "normal", value: 1 },
      { label: "boundary", value: 0 },
      { label: "extreme", value: -1 },
    ],
    score: 13,
    riskScore: 0,
    riskTags: [],
    status: "accepted",
    confidence: 0.9,
    evidence: "result should be non-negative",
    sourceHash: "abc",
    inferredAt: "2026-01-01",
    modelId: "test",
    ...overrides,
  };
}

describe("autoWeakenProperty", () => {
  it("should return null for already-refined properties (recursion guard)", () => {
    const prop = makeProp({
      status: "refined",
      riskTags: ["float_exact_equality"],
      assertion: "add(a, b) === add(b, a)",
      generators: { a: { type: "float" }, b: { type: "float" } },
    });
    assert.equal(autoWeakenProperty(prop), null);
  });

  it("should return null when no risk tags are present", () => {
    const prop = makeProp({ riskTags: [] });
    assert.equal(autoWeakenProperty(prop), null);
  });

  it("should return null when risk tags exist but no weakening is possible", () => {
    // doc_domain_mismatch has no weakening logic
    const prop = makeProp({
      riskTags: ["doc_domain_mismatch"],
      assertion: "add(a, b) >= 0",
    });
    assert.equal(autoWeakenProperty(prop), null);
  });

  it("should weaken float_exact_equality === to approxEqual", () => {
    const prop = makeProp({
      riskTags: ["float_exact_equality"],
      assertion: "add(a, b) === add(b, a)",
      generators: { a: { type: "float" }, b: { type: "float" } },
    });
    const weakened = autoWeakenProperty(prop);
    assert.ok(weakened);
    assert.match(weakened.assertion, /approxEqual/);
    assert.equal(weakened.status, "refined");
  });

  it("should weaken float_exact_equality !== to !approxEqual", () => {
    const prop = makeProp({
      riskTags: ["float_exact_equality"],
      assertion: "add(a, b) !== subtract(a, b)",
      generators: { a: { type: "float" }, b: { type: "float" } },
    });
    const weakened = autoWeakenProperty(prop);
    assert.ok(weakened);
    assert.match(weakened.assertion, /!approxEqual/);
  });

  it("should weaken tiny_abs_tolerance to reasonable epsilon", () => {
    const prop = makeProp({
      riskTags: ["tiny_abs_tolerance"],
      assertion: "Math.abs(add(a, b) - expected) < 1e-12",
      generators: { a: { type: "float" }, b: { type: "float" } },
    });
    const weakened = autoWeakenProperty(prop);
    assert.ok(weakened);
    assert.match(weakened.assertion, /approxEqual/);
    assert.match(weakened.assertion, /1e-6/);
  });

  it("should tighten wide_numeric_domain by clamping to 0..1M", () => {
    const prop = makeProp({
      riskTags: ["wide_numeric_domain"],
      assertion: "add(a, b) >= 0",
      generators: { a: { type: "float" }, b: { type: "float" } },
    });
    const weakened = autoWeakenProperty(prop);
    assert.ok(weakened);
    assert.equal(weakened.generators.a.constraints?.min, 0);
    assert.equal(weakened.generators.a.constraints?.max, 1_000_000);
  });

  it("should wrap missing_precondition in try-catch", () => {
    const prop = makeProp({
      riskTags: ["missing_precondition"],
      category: "boundary",
      assertion: "add(a, b) >= 0",
    });
    const weakened = autoWeakenProperty(prop);
    assert.ok(weakened);
    assert.match(weakened.assertion, /try/);
    assert.match(weakened.assertion, /catch/);
  });

  it("should not wrap assertion already containing try/catch", () => {
    const prop = makeProp({
      riskTags: ["missing_precondition"],
      assertion: "(() => { try { return add(a, b) >= 0; } catch { return true; } })()",
    });
    const weakened = autoWeakenProperty(prop);
    // Should return null because weakenMissingPrecondition returns null for try/catch
    assert.equal(weakened, null);
  });

  it("should handle multiple risk tags simultaneously", () => {
    const prop = makeProp({
      riskTags: ["float_exact_equality", "wide_numeric_domain"],
      assertion: "add(a, b) === add(b, a)",
      generators: { a: { type: "float" }, b: { type: "float" } },
    });
    const weakened = autoWeakenProperty(prop);
    assert.ok(weakened);
    // Both weakenings applied
    assert.match(weakened.assertion, /approxEqual/);
    assert.equal(weakened.generators.a.constraints?.min, 0);
    assert.equal(weakened.status, "refined");
  });

  it("should not modify the original property (immutability)", () => {
    const original = makeProp({
      riskTags: ["float_exact_equality"],
      assertion: "add(a, b) === add(b, a)",
      generators: { a: { type: "float" }, b: { type: "float" } },
    });
    const originalAssertion = original.assertion;
    autoWeakenProperty(original);
    assert.equal(original.assertion, originalAssertion);
  });

  it("should handle deeply nested equality in parentheses", () => {
    const prop = makeProp({
      riskTags: ["float_exact_equality"],
      assertion: "(compute(a) + compute(b)) === (compute(b) + compute(a))",
      generators: { a: { type: "float" }, b: { type: "float" } },
    });
    const weakened = autoWeakenProperty(prop);
    assert.ok(weakened);
    assert.match(weakened.assertion, /approxEqual/);
  });
});
