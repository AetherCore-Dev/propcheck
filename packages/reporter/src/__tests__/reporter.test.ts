import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import { reportAsJson } from "../json-reporter";
import {
  reportPropertiesOverviewAsJson,
  reportPropertyDetailAsJson,
} from "../property-workflow-reporter";
import { formatSummary, formatCost } from "../formatters/summary";
import { formatCounterexample } from "../formatters/counterexample";
import { formatPropertyLine } from "../formatters/property-table";
import type {
  ExecutionResult,
  PropertyDefinition,
  PropertySet,
  PropertyFailure,
} from "@propcheck/common";

function makeProp(overrides: Partial<PropertyDefinition> = {}): PropertyDefinition {
  return {
    id: "prop_001",
    targetFunction: "add",
    description: "Addition is commutative",
    category: "equivalence",
    assertion: "add(a, b) === add(b, a)",
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

function makeResult(overrides: Partial<ExecutionResult> = {}): ExecutionResult {
  return {
    passed: [],
    failed: [],
    errors: [],
    skipped: [],
    duration: 1000,
    totalIterations: 0,
    properties: [],
    ...overrides,
  };
}

function makePropertySet(overrides: Partial<PropertySet> = {}): PropertySet {
  return {
    schemaVersion: 2,
    module: "src/cart.ts",
    filePath: "src/cart.ts",
    sourceHash: "abc",
    inferredAt: "2026-01-01",
    properties: [makeProp()],
    ...overrides,
  };
}

// ── JSON Reporter ──────────────────────────────────

describe("reportAsJson", () => {
  it("should produce valid JSON with correct structure", () => {
    const result = makeResult({
      passed: [{ propertyId: "prop_001", status: "passed", iterations: 1000, duration: 100, seed: 42 }],
      failed: [{
        propertyId: "prop_002",
        status: "failed",
        counterexample: [5, -1],
        shrinkSteps: 3,
        originalInput: [5, -1],
        errorMessage: "violated",
        seed: 42,
        duration: 50,
      }],
      errors: [{ propertyId: "prop_003", status: "error", errorMessage: "crash", duration: 0 }],
      skipped: [{ propertyId: "prop_004", reason: "filter", propertyStatus: "accepted" }],
      duration: 500,
    });

    const json = JSON.parse(reportAsJson(result));
    assert.equal(json.passed.length, 1);
    assert.equal(json.failed.length, 1);
    assert.equal(json.errors.length, 1);
    assert.equal(json.skipped.length, 1);
    assert.equal(json.summary.total, 3); // passed + failed + errors
    assert.equal(json.summary.passed, 1);
    assert.equal(json.summary.failed, 1);
    assert.equal(json.summary.errors, 1);
    assert.equal(json.summary.skipped, 1);
    assert.equal(json.summary.duration, 500);
  });

  it("should handle empty result", () => {
    const json = JSON.parse(reportAsJson(makeResult()));
    assert.equal(json.summary.total, 0);
    assert.equal(json.passed.length, 0);
  });

  it("should include counterexample in failed entries", () => {
    const result = makeResult({
      failed: [{
        propertyId: "prop_001",
        status: "failed",
        counterexample: [42, "hello"],
        shrinkSteps: 5,
        originalInput: [42, "hello"],
        errorMessage: "boom",
        seed: 123,
        duration: 0,
      }],
    });
    const json = JSON.parse(reportAsJson(result));
    assert.deepEqual(json.failed[0].counterexample, [42, "hello"]);
    assert.equal(json.failed[0].seed, 123);
  });
});

// ── formatSummary ──────────────────────────────────

describe("formatSummary", () => {
  it("should include pass count", () => {
    const result = makeResult({
      passed: [
        { propertyId: "p1", status: "passed", iterations: 1000, duration: 0, seed: 0 },
        { propertyId: "p2", status: "passed", iterations: 1000, duration: 0, seed: 0 },
      ],
      duration: 2300,
    });
    const summary = formatSummary(result);
    assert.match(summary, /Properties: 2/);
    assert.match(summary, /Passed: 2/);
    assert.match(summary, /2\.3s/);
  });

  it("should include failure and error counts", () => {
    const result = makeResult({
      failed: [{ propertyId: "p1", status: "failed", counterexample: null, shrinkSteps: 0, originalInput: null, errorMessage: "x", seed: 0, duration: 0 }],
      errors: [{ propertyId: "p2", status: "error", errorMessage: "y", duration: 0 }],
      duration: 1000,
    });
    const summary = formatSummary(result);
    assert.match(summary, /Failed: 1/);
    assert.match(summary, /Errors: 1/);
  });

  it("should include skipped count when present", () => {
    const result = makeResult({
      skipped: [{ propertyId: "p1", reason: "filter", propertyStatus: "accepted" }],
    });
    const summary = formatSummary(result);
    assert.match(summary, /Skipped: 1/);
  });
});

// ── formatCost ─────────────────────────────────────

describe("formatCost", () => {
  it("should format tokens and cost", () => {
    const output = formatCost(5800, 0.06);
    assert.match(output, /5,800/);
    assert.match(output, /\$0\.0600/);
  });
});

// ── formatCounterexample ───────────────────────────

describe("formatCounterexample", () => {
  it("should format array counterexample as function call", () => {
    const failure: PropertyFailure = {
      propertyId: "prop_001",
      status: "failed",
      counterexample: [5, -1],
      shrinkSteps: 12,
      originalInput: [5, -1],
      errorMessage: "Property violated",
      seed: 42,
      duration: 0,
    };
    const output = formatCounterexample(failure, makeProp());
    assert.match(output, /add\(5, -1\)/);
    assert.match(output, /12 shrink steps/);
    assert.match(output, /Seed: 42/);
  });

  it("should handle null counterexample", () => {
    const failure: PropertyFailure = {
      propertyId: "prop_001",
      status: "failed",
      counterexample: null,
      shrinkSteps: 0,
      originalInput: null,
      errorMessage: "failed",
      seed: 0,
      duration: 0,
    };
    const output = formatCounterexample(failure, makeProp());
    assert.match(output, /add\(\.\.\.\)/);
  });

  it("should handle string counterexample", () => {
    const failure: PropertyFailure = {
      propertyId: "prop_001",
      status: "failed",
      counterexample: "hello world",
      shrinkSteps: 0,
      originalInput: "hello world",
      errorMessage: "failed",
      seed: 0,
      duration: 0,
    };
    const output = formatCounterexample(failure, makeProp({ targetFunction: "reverse" }));
    assert.match(output, /reverse\("hello world"\)/);
  });

  it("should not show shrink line when shrinkSteps is 0", () => {
    const failure: PropertyFailure = {
      propertyId: "prop_001",
      status: "failed",
      counterexample: [1],
      shrinkSteps: 0,
      originalInput: [1],
      errorMessage: "failed",
      seed: 0,
      duration: 0,
    };
    const output = formatCounterexample(failure, makeProp());
    assert.ok(!output.includes("shrink steps"));
  });
});

// ── formatPropertyLine ─────────────────────────────

describe("formatPropertyLine", () => {
  it("should format inference line with category and score", () => {
    const line = formatPropertyLine(makeProp());
    assert.match(line, /add: Addition is commutative/);
    assert.match(line, /equivalence/);
    assert.match(line, /13\/13/);
  });

  it("should format passed outcome", () => {
    const line = formatPropertyLine(makeProp(), {
      propertyId: "prop_001",
      status: "passed",
      iterations: 1000,
      duration: 300,
      seed: 0,
    });
    assert.match(line, /PASS/);
    assert.match(line, /1000\/1000/);
  });

  it("should format failed outcome", () => {
    const line = formatPropertyLine(makeProp(), {
      propertyId: "prop_001",
      status: "failed",
      counterexample: [1],
      shrinkSteps: 0,
      originalInput: [1],
      errorMessage: "x",
      seed: 0,
      duration: 0,
    });
    assert.match(line, /FAIL/);
  });

  it("should show risk tags for risky properties", () => {
    const line = formatPropertyLine(makeProp({
      status: "risky",
      riskTags: ["float_exact_equality"],
    }));
    assert.match(line, /risky/);
    assert.match(line, /float_exact_equality/);
  });
});

// ── Property Workflow JSON reporters ───────────────

describe("reportPropertiesOverviewAsJson", () => {
  it("should produce valid JSON with module summaries", () => {
    const sets: PropertySet[] = [makePropertySet({
      properties: [
        makeProp({ id: "p1", status: "accepted" }),
        makeProp({ id: "p2", status: "risky", riskTags: ["wide_numeric_domain"] }),
      ],
    })];

    const json = JSON.parse(reportPropertiesOverviewAsJson(sets));
    assert.equal(json.modules.length, 1);
    assert.equal(json.modules[0].properties.length, 2);
    assert.equal(json.modules[0].summary.accepted, 1);
    assert.equal(json.modules[0].summary.risky, 1);
  });

  it("should filter by status", () => {
    const sets: PropertySet[] = [makePropertySet({
      properties: [
        makeProp({ id: "p1", status: "accepted" }),
        makeProp({ id: "p2", status: "risky" }),
      ],
    })];

    const json = JSON.parse(reportPropertiesOverviewAsJson(sets, "risky"));
    assert.equal(json.modules[0].properties.length, 1);
    assert.equal(json.modules[0].properties[0].status, "risky");
  });

  it("should exclude modules with no matching properties", () => {
    const sets: PropertySet[] = [makePropertySet({
      properties: [makeProp({ status: "accepted" })],
    })];

    const json = JSON.parse(reportPropertiesOverviewAsJson(sets, "quarantined"));
    assert.equal(json.modules.length, 0);
  });
});

describe("reportPropertyDetailAsJson", () => {
  it("should produce valid JSON with all property fields", () => {
    const prop = makeProp({
      id: "prop_007",
      targetFunction: "formatPrice",
      riskTags: ["float_exact_equality"],
    });
    const json = JSON.parse(reportPropertyDetailAsJson(prop, "src/utils.ts"));
    assert.equal(json.filePath, "src/utils.ts");
    assert.equal(json.property.id, "prop_007");
    assert.equal(json.property.targetFunction, "formatPrice");
    assert.deepEqual(json.property.riskTags, ["float_exact_equality"]);
    assert.equal(json.property.score, 13);
  });
});
