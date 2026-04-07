/**
 * Tests for mock-fix.ts — mockDiagnoseViolation and mockGenerateFix.
 */

import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import { mockDiagnoseViolation, mockGenerateFix } from "../mock-fix";
import type { PropertyDefinition, PropertyFailure, Diagnosis } from "@propcheck/common";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProperty(overrides: Partial<PropertyDefinition> = {}): PropertyDefinition {
  return {
    id: "prop_001",
    targetFunction: "calculateTotal",
    description: "Total is non-negative",
    assertion: "result >= 0",
    generators: { price: { type: "float", constraints: { min: 0, max: 10000 } } },
    seedInputs: [{ label: "normal", value: 42 }],
    category: "boundary",
    confidence: 0.9,
    score: 12,
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

function makeFailure(overrides: Partial<PropertyFailure> = {}): PropertyFailure {
  return {
    propertyId: "prop_001",
    status: "failed",
    errorMessage: "Property violated: result >= 0",
    counterexample: { price: -5 },
    shrinkSteps: 3,
    originalInput: { price: -100 },
    seed: 12345,
    duration: 50,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// mockDiagnoseViolation
// ---------------------------------------------------------------------------

describe("mockDiagnoseViolation", () => {
  it("returns isBug=true for any violation", () => {
    const diag = mockDiagnoseViolation(makeProperty(), makeFailure());
    assert.equal(diag.isBug, true);
  });

  it("includes propertyId from the property", () => {
    const diag = mockDiagnoseViolation(
      makeProperty({ id: "prop_007" }),
      makeFailure({ propertyId: "prop_007" }),
    );
    assert.equal(diag.propertyId, "prop_007");
  });

  it("includes counterexample in explanation", () => {
    const diag = mockDiagnoseViolation(
      makeProperty(),
      makeFailure({ counterexample: { x: 42, y: -1 } }),
    );
    assert.ok(diag.explanation.includes("42"));
    assert.ok(diag.explanation.includes("-1"));
  });

  it("includes target function name in explanation and suggestedFix", () => {
    const diag = mockDiagnoseViolation(
      makeProperty({ targetFunction: "parseAmount" }),
      makeFailure(),
    );
    assert.ok(diag.explanation.includes("parseAmount"));
    assert.ok(diag.suggestedFix?.includes("parseAmount"));
  });

  it("includes property description in explanation", () => {
    const diag = mockDiagnoseViolation(
      makeProperty({ description: "Output is always positive" }),
      makeFailure(),
    );
    assert.ok(diag.explanation.includes("Output is always positive"));
  });

  it("returns confidence 0.85", () => {
    const diag = mockDiagnoseViolation(makeProperty(), makeFailure());
    assert.equal(diag.confidence, 0.85);
  });
});

// ---------------------------------------------------------------------------
// mockGenerateFix
// ---------------------------------------------------------------------------

describe("mockGenerateFix", () => {
  const sourceCode = `export function calculateTotal(price: number): number {
  return price * 1.1;
}`;

  it("returns a FixResult with fixedSource", () => {
    const diagnoses: Diagnosis[] = [{
      propertyId: "prop_001",
      isBug: true,
      explanation: "Bug found",
      suggestedFix: "Add guard",
      confidence: 0.8,
    }];
    const result = mockGenerateFix(sourceCode, diagnoses);
    assert.ok(result.fixedSource);
    assert.ok(result.explanation);
    assert.ok(typeof result.confidence === "number");
    assert.ok(Array.isArray(result.changedFunctions));
  });

  it("adds fix comment when function not found by name", () => {
    const diagnoses: Diagnosis[] = [{
      propertyId: "prop_001",
      isBug: true,
      explanation: "Bug",
      suggestedFix: null,
      confidence: 0.8,
    }];
    const result = mockGenerateFix(sourceCode, diagnoses);
    assert.ok(result.fixedSource.includes("[propcheck fix]"));
  });

  it("skips non-bug diagnoses", () => {
    const diagnoses: Diagnosis[] = [{
      propertyId: "prop_001",
      isBug: false,
      explanation: "False positive",
      suggestedFix: null,
      confidence: 0.5,
    }];
    const result = mockGenerateFix(sourceCode, diagnoses);
    // Source unchanged since no bugs
    assert.equal(result.fixedSource, sourceCode);
  });

  it("handles multiple diagnoses", () => {
    const diagnoses: Diagnosis[] = [
      { propertyId: "prop_001", isBug: true, explanation: "Bug 1", suggestedFix: null, confidence: 0.8 },
      { propertyId: "prop_002", isBug: true, explanation: "Bug 2", suggestedFix: null, confidence: 0.7 },
    ];
    const result = mockGenerateFix(sourceCode, diagnoses);
    assert.ok(result.explanation.includes("2"));
  });

  it("handles empty diagnoses array", () => {
    const result = mockGenerateFix(sourceCode, []);
    assert.equal(result.fixedSource, sourceCode);
    assert.ok(result.explanation.includes("0"));
  });

  it("returns confidence 0.7", () => {
    const diagnoses: Diagnosis[] = [{
      propertyId: "prop_001",
      isBug: true,
      explanation: "Bug",
      suggestedFix: null,
      confidence: 0.8,
    }];
    const result = mockGenerateFix(sourceCode, diagnoses);
    assert.equal(result.confidence, 0.7);
  });
});
