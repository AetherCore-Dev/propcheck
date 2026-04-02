import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import { parseJsonLines, mapResults } from "../shared/result-parser";
import type { PropertyDefinition, RunConfig } from "@propcheck/common";

function makeProp(overrides: Partial<PropertyDefinition> = {}): PropertyDefinition {
  return {
    id: "prop_001",
    targetFunction: "add",
    description: "test",
    category: "boundary",
    assertion: "add(a, b) >= 0",
    generators: { a: { type: "integer" }, b: { type: "integer" } },
    seedInputs: [{ label: "normal", value: 1 }],
    score: 13,
    riskScore: 0,
    riskTags: [],
    status: "accepted",
    confidence: 0.9,
    evidence: "test",
    sourceHash: "abc",
    inferredAt: "2026-01-01",
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

describe("parseJsonLines", () => {
  it("should extract valid JSON result lines", () => {
    const stdout = [
      '{"propertyId":"prop_001","status":"passed","iterations":1000}',
      "some non-json output",
      '{"propertyId":"prop_002","status":"failed","counterexample":[5],"errorMessage":"boom"}',
    ].join("\n");

    const results = parseJsonLines(stdout);
    assert.equal(results.length, 2);
    assert.equal(results[0].propertyId, "prop_001");
    assert.equal(results[0].status, "passed");
    assert.equal(results[1].propertyId, "prop_002");
    assert.equal(results[1].status, "failed");
  });

  it("should skip lines that are not JSON objects", () => {
    const stdout = [
      "Running tests...",
      "[1, 2, 3]",
      '"just a string"',
      "null",
      "",
    ].join("\n");

    const results = parseJsonLines(stdout);
    assert.equal(results.length, 0);
  });

  it("should skip JSON objects without propertyId or valid status", () => {
    const stdout = [
      '{"propertyId":"p1"}',             // missing status
      '{"status":"passed"}',             // missing propertyId
      '{"propertyId":"p2","status":"unknown"}', // invalid status
      '{"propertyId":"p3","status":"passed"}',  // valid
    ].join("\n");

    const results = parseJsonLines(stdout);
    assert.equal(results.length, 1);
    assert.equal(results[0].propertyId, "p3");
  });

  it("should handle empty stdout", () => {
    assert.equal(parseJsonLines("").length, 0);
  });

  it("should handle malformed JSON gracefully", () => {
    const stdout = '{"propertyId":"p1","status":broken}';
    const results = parseJsonLines(stdout);
    assert.equal(results.length, 0);
  });
});

describe("mapResults", () => {
  it("should map passed results correctly", () => {
    const props = [makeProp({ id: "prop_001" })];
    const raw = [{ propertyId: "prop_001", status: "passed", iterations: 500 }];

    const result = mapResults(raw, props, defaultConfig, 100, "", "Error");
    assert.equal(result.passed.length, 1);
    assert.equal(result.failed.length, 0);
    assert.equal(result.errors.length, 0);
    assert.equal(result.passed[0].iterations, 500);
  });

  it("should map failed results with counterexample", () => {
    const props = [makeProp({ id: "prop_001" })];
    const raw = [{
      propertyId: "prop_001",
      status: "failed",
      counterexample: [42, -1],
      errorMessage: "Property violated",
      shrinkSteps: 5,
    }];

    const result = mapResults(raw, props, defaultConfig, 100, "", "Error");
    assert.equal(result.passed.length, 0);
    assert.equal(result.failed.length, 1);
    assert.deepEqual(result.failed[0].counterexample, [42, -1]);
    assert.equal(result.failed[0].shrinkSteps, 5);
  });

  it("should report error for properties with no output", () => {
    const props = [
      makeProp({ id: "prop_001" }),
      makeProp({ id: "prop_002" }),
    ];
    const raw = [{ propertyId: "prop_001", status: "passed", iterations: 100 }];
    // prop_002 has no result — should become an error

    const result = mapResults(raw, props, defaultConfig, 100, "segfault", "Error");
    assert.equal(result.passed.length, 1);
    assert.equal(result.errors.length, 1);
    assert.equal(result.errors[0].propertyId, "prop_002");
    assert.match(result.errors[0].errorMessage, /segfault/);
  });

  it("should report error for unexpected status values", () => {
    const props = [makeProp({ id: "prop_001" })];
    const raw = [{ propertyId: "prop_001", status: "skipped" }];

    const result = mapResults(raw, props, defaultConfig, 100, "", "Error");
    assert.equal(result.errors.length, 1);
    assert.match(result.errors[0].errorMessage, /Unexpected status/);
  });

  it("should calculate totalIterations from passed results", () => {
    const props = [
      makeProp({ id: "prop_001" }),
      makeProp({ id: "prop_002" }),
    ];
    const raw = [
      { propertyId: "prop_001", status: "passed", iterations: 1000 },
      { propertyId: "prop_002", status: "passed", iterations: 500 },
    ];

    const result = mapResults(raw, props, defaultConfig, 200, "", "Error");
    assert.equal(result.totalIterations, 1500);
    assert.equal(result.duration, 200);
  });
});
