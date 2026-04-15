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
    evidenceSource: "code",
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

  // --- findTopLevelOperator edge cases (exercised through weakenExactEquality) ---

  it("should ignore === inside string literals", () => {
    const prop = makeProp({
      riskTags: ["float_exact_equality"],
      assertion: `"a === b"`,
      generators: { a: { type: "float" } },
    });
    // No top-level === found, so no weakening possible
    const weakened = autoWeakenProperty(prop);
    assert.equal(weakened, null);
  });

  it("should find === at top level between function call expressions", () => {
    const prop = makeProp({
      riskTags: ["float_exact_equality"],
      // === is at top level (depth 0) between two fn() call expressions
      assertion: "fn(a) === fn(b)",
      generators: { a: { type: "float" }, b: { type: "float" } },
    });
    const weakened = autoWeakenProperty(prop);
    assert.ok(weakened);
    assert.match(weakened.assertion, /approxEqual\(fn\(a\), fn\(b\)\)/);
  });

  it("should handle escaped quotes in strings", () => {
    const prop = makeProp({
      riskTags: ["float_exact_equality"],
      // The === after the string is at top level
      assertion: `"he\\'s" === result`,
      generators: { a: { type: "float" } },
    });
    const weakened = autoWeakenProperty(prop);
    assert.ok(weakened);
    assert.match(weakened.assertion, /approxEqual/);
  });

  // --- parseTinyTolerance edge cases ---

  it("should not weaken non-Math.abs assertions for tiny_abs_tolerance", () => {
    const prop = makeProp({
      riskTags: ["tiny_abs_tolerance"],
      assertion: "result < 1e-12",
      generators: { a: { type: "float" } },
    });
    // Not a Math.abs(...) pattern
    const weakened = autoWeakenProperty(prop);
    assert.equal(weakened, null);
  });

  it("should not weaken reasonable tolerance (not tiny)", () => {
    const prop = makeProp({
      riskTags: ["tiny_abs_tolerance"],
      assertion: "Math.abs(a - b) < 0.01",
      generators: { a: { type: "float" }, b: { type: "float" } },
    });
    // 0.01 doesn't match the 1e-9+ pattern
    const weakened = autoWeakenProperty(prop);
    assert.equal(weakened, null);
  });

  it("should weaken Math.abs with nested function calls", () => {
    const prop = makeProp({
      riskTags: ["tiny_abs_tolerance"],
      assertion: "Math.abs(compute(a) - expected(b)) < 1e-15",
      generators: { a: { type: "float" }, b: { type: "float" } },
    });
    const weakened = autoWeakenProperty(prop);
    assert.ok(weakened);
    assert.match(weakened.assertion, /approxEqual\(compute\(a\), expected\(b\)/);
  });

  // --- tightenWideNumericGenerators edge cases ---

  it("should tighten wide range that exceeds 1M", () => {
    const prop = makeProp({
      riskTags: ["wide_numeric_domain"],
      assertion: "fn(x) >= 0",
      generators: { x: { type: "float", constraints: { min: -5_000_000, max: 5_000_000 } } },
    });
    const weakened = autoWeakenProperty(prop);
    assert.ok(weakened);
    assert.equal(weakened.generators.x.constraints?.min, 0);
    assert.equal(weakened.generators.x.constraints?.max, 1_000_000);
  });

  it("should not tighten already-narrow numeric range", () => {
    const prop = makeProp({
      riskTags: ["wide_numeric_domain"],
      assertion: "fn(x) >= 0",
      generators: { x: { type: "float", constraints: { min: 0, max: 100 } } },
    });
    // Range is narrow, no tightening needed
    const weakened = autoWeakenProperty(prop);
    assert.equal(weakened, null);
  });

  it("should tighten array element generators with wide range", () => {
    const prop = makeProp({
      riskTags: ["wide_numeric_domain"],
      assertion: "fn(arr).length >= 0",
      generators: { arr: { type: "array", constraints: { element: "float" } } },
    });
    const weakened = autoWeakenProperty(prop);
    assert.ok(weakened);
    assert.equal(weakened.generators.arr.constraints?.elementMin, 0);
    assert.equal(weakened.generators.arr.constraints?.elementMax, 1_000_000);
  });

  it("should handle 'integer' and 'int' type in generators", () => {
    const prop = makeProp({
      riskTags: ["wide_numeric_domain"],
      assertion: "fn(x) >= 0",
      generators: { x: { type: "int" } },
    });
    const weakened = autoWeakenProperty(prop);
    assert.ok(weakened);
    assert.equal(weakened.generators.x.constraints?.min, 0);
    assert.equal(weakened.generators.x.constraints?.max, 1_000_000);
  });
});

// ---------------------------------------------------------------------------
// detectDocDomainRiskTags & applyRiskMetadata
// ---------------------------------------------------------------------------

import { detectDocDomainRiskTags, applyRiskMetadata } from "../commands/infer/weakening";
import type { AnalysisContext, DocSignal } from "@propcheck/common";

function makeContext(docSignals: DocSignal[]): AnalysisContext {
  return {
    filePath: "test.ts",
    language: "typescript",
    sourceCode: "",
    functions: [],
    types: [],
    imports: [],
    signals: { ast: [], type: [], doc: docSignals },
  };
}

describe("detectDocDomainRiskTags", () => {
  it("should return empty for property with no matching doc", () => {
    const prop = makeProp({ targetFunction: "unknown" });
    const ctx = makeContext([]);
    assert.deepEqual(detectDocDomainRiskTags(prop, ctx), []);
  });

  it("should detect doc_domain_mismatch when doc says 0-100 but generator is 0-10000", () => {
    const prop = makeProp({
      targetFunction: "applyDiscount",
      generators: { discount: { type: "float", constraints: { min: 0, max: 10000 } } },
    });
    const ctx = makeContext([{
      functionName: "applyDiscount",
      description: "Apply discount",
      paramDocs: { discount: "Discount percentage (0-100)" },
      returnDoc: null,
      throws: [],
      examples: [],
    }]);
    const tags = detectDocDomainRiskTags(prop, ctx);
    assert.ok(tags.includes("doc_domain_mismatch"));
  });

  it("should detect doc_domain_mismatch when doc says non-negative but no min constraint", () => {
    const prop = makeProp({
      targetFunction: "setPrice",
      generators: { price: { type: "float" } },
    });
    const ctx = makeContext([{
      functionName: "setPrice",
      description: "Set price",
      paramDocs: { price: "Must be non-negative" },
      returnDoc: null,
      throws: [],
      examples: [],
    }]);
    const tags = detectDocDomainRiskTags(prop, ctx);
    assert.ok(tags.includes("doc_domain_mismatch"));
  });

  it("should return empty when doc and generator match", () => {
    const prop = makeProp({
      targetFunction: "applyDiscount",
      generators: { discount: { type: "float", constraints: { min: 0, max: 100 } } },
    });
    const ctx = makeContext([{
      functionName: "applyDiscount",
      description: "Apply discount",
      paramDocs: { discount: "Discount percentage (0-100)" },
      returnDoc: null,
      throws: [],
      examples: [],
    }]);
    const tags = detectDocDomainRiskTags(prop, ctx);
    assert.deepEqual(tags, []);
  });

  it("should skip non-numeric generators", () => {
    const prop = makeProp({
      targetFunction: "greet",
      generators: { name: { type: "string", constraints: { maxLength: 100 } } },
    });
    const ctx = makeContext([{
      functionName: "greet",
      description: "Greet",
      paramDocs: { name: "Must be non-negative" },
      returnDoc: null,
      throws: [],
      examples: [],
    }]);
    const tags = detectDocDomainRiskTags(prop, ctx);
    assert.deepEqual(tags, []);
  });
});

describe("applyRiskMetadata", () => {
  it("should add risk tags and set status to risky", () => {
    const prop = makeProp({
      targetFunction: "fn",
      riskTags: ["float_exact_equality"],
    });
    const ctx = makeContext([]);
    const result = applyRiskMetadata([prop], ctx);
    assert.equal(result.length, 1);
    assert.ok(result[0].riskTags.includes("float_exact_equality"));
    assert.equal(result[0].status, "risky");
  });

  it("should set status to accepted when no risk tags", () => {
    const prop = makeProp({ riskTags: [] });
    const ctx = makeContext([]);
    const result = applyRiskMetadata([prop], ctx);
    assert.equal(result[0].status, "accepted");
  });

  it("should not mutate original properties", () => {
    const prop = makeProp({ riskTags: [] });
    const ctx = makeContext([]);
    const result = applyRiskMetadata([prop], ctx);
    assert.notEqual(result[0], prop);
  });

  it("should add spec_code_conflict and upgrade evidence source when spec disagrees", () => {
    const prop = makeProp({
      targetFunction: "applyDiscount",
      description: "discount may be negative",
      assertion: "applyDiscount(price, discount) < 0",
      generators: { discount: { type: "float", constraints: { min: 0, max: 1000 } } },
    });
    const ctx: AnalysisContext = {
      ...makeContext([]),
      spec: {
        sourcePath: "requirements.md",
        rawText: "applyDiscount must keep discount percentage in the 0-100 range",
        generalRequirements: [],
        functions: [{
          functionName: "applyDiscount",
          requirements: ["applyDiscount must keep discount percentage in the 0-100 range"],
          constraints: [{ subject: "applyDiscount", kind: "range", detail: "discount percentage in the 0-100 range", min: 0, max: 100 }],
        }],
      },
    };
    const result = applyRiskMetadata([prop], ctx);
    assert.equal(result[0].evidenceSource, "mixed");
    assert.ok(result[0].riskTags.includes("spec_code_conflict"));
  });

  it("should keep code evidence when spec does not match the property function", () => {
    const prop = makeProp({ targetFunction: "applyDiscount", evidenceSource: "code" });
    const ctx: AnalysisContext = {
      ...makeContext([]),
      spec: {
        sourcePath: "requirements.md",
        rawText: "calculateTotal should never be negative",
        generalRequirements: [],
        functions: [{
          functionName: "calculateTotal",
          requirements: ["calculateTotal should never be negative"],
          constraints: [{ subject: "calculateTotal", kind: "non-negative", detail: "calculateTotal should never be negative", min: 0 }],
        }],
      },
    };
    const result = applyRiskMetadata([prop], ctx);
    assert.equal(result[0].evidenceSource, "code");
  });

  it("should add spec_code_conflict for negative lower bounds in 0-100 specs", () => {
    const prop = makeProp({
      targetFunction: "applyDiscount",
      generators: { discount: { type: "float", constraints: { min: -10, max: 100 } } },
    });
    const ctx: AnalysisContext = {
      ...makeContext([]),
      spec: {
        sourcePath: "requirements.md",
        rawText: "applyDiscount must keep discount percentage in the 0-100 range",
        generalRequirements: [],
        functions: [{
          functionName: "applyDiscount",
          requirements: ["applyDiscount must keep discount percentage in the 0-100 range"],
          constraints: [{ subject: "applyDiscount", kind: "range", detail: "discount percentage in the 0-100 range", min: 0, max: 100 }],
        }],
      },
    };
    const result = applyRiskMetadata([prop], ctx);
    assert.ok(result[0].riskTags.includes("spec_code_conflict"));
  });

  it("should add spec_code_conflict for array element ranges outside 0-100 specs", () => {
    const prop = makeProp({
      targetFunction: "applyDiscount",
      generators: { discounts: { type: "array", constraints: { element: "float", elementMin: 0, elementMax: 1000 } } },
    });
    const ctx: AnalysisContext = {
      ...makeContext([]),
      spec: {
        sourcePath: "requirements.md",
        rawText: "applyDiscount must keep discount percentage in the 0-100 range",
        generalRequirements: [],
        functions: [{
          functionName: "applyDiscount",
          requirements: ["applyDiscount must keep discount percentage in the 0-100 range"],
          constraints: [{ subject: "applyDiscount", kind: "range", detail: "discount percentage in the 0-100 range", min: 0, max: 100 }],
        }],
      },
    };
    const result = applyRiskMetadata([prop], ctx);
    assert.ok(result[0].riskTags.includes("spec_code_conflict"));
  });

  it("should merge doc risk tags with existing risk tags", () => {
    const prop = makeProp({
      targetFunction: "setPrice",
      riskTags: ["float_exact_equality"],
      generators: { price: { type: "float" } },
    });
    const ctx = makeContext([{
      functionName: "setPrice",
      description: "Set price",
      paramDocs: { price: "Must be non-negative" },
      returnDoc: null,
      throws: [],
      examples: [],
    }]);
    const result = applyRiskMetadata([prop], ctx);
    assert.ok(result[0].riskTags.includes("float_exact_equality"));
    assert.ok(result[0].riskTags.includes("doc_domain_mismatch"));
  });
});
