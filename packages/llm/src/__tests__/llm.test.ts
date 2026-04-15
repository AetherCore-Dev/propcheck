import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import { buildTemplateProperties } from "../index";
import { parseInferResponse } from "../response-parser";
import { scoreProperty, scoreAndFilter, isRedundant, detectRiskTags, computeRiskScore } from "../scoring";
import { createMockClient } from "../mock-client";
import { buildInferPrompt } from "../prompts/infer-properties";
import { classifyProperties, buildFeedbackSummary, buildRefinementPrompt } from "../prompts/refinement";
import type { AnalysisContext, ExecutionResult, FunctionSignature, PropertyDefinition } from "@propcheck/common";

function makeTestProp(overrides: Partial<PropertyDefinition> = {}): PropertyDefinition {
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
    score: 0,
    riskScore: 0,
    riskTags: [],
    status: "accepted",
    confidence: 0.9,
    evidence: "result should be non-negative for positive inputs",
    sourceHash: "abc",
    inferredAt: "2026-01-01",
    modelId: "test",
    evidenceSource: "code",
    ...overrides,
  };
}

function makeFunctionSignature(overrides: Partial<FunctionSignature> & { name: string }): FunctionSignature {
  return {
    name: overrides.name,
    qualifiedName: overrides.qualifiedName ?? overrides.name,
    parameters: overrides.parameters ?? [],
    returnType: overrides.returnType ?? null,
    docstring: overrides.docstring ?? null,
    visibility: overrides.visibility ?? "public",
    isAsync: overrides.isAsync ?? false,
    isGenerator: overrides.isGenerator ?? false,
    loc: overrides.loc ?? { startLine: 1, endLine: 1, startColumn: 0, endColumn: 0 },
  };
}

describe("response-parser", () => {
  const opts = { sourceHash: "abc123", modelId: "test-model" };

  it("should parse valid response", () => {
    const raw = {
      properties: [
        {
          targetFunction: "add",
          description: "Commutativity",
          category: "equivalence",
          assertion: "add(a, b) === add(b, a)",
          generators: { a: { type: "integer" }, b: { type: "integer" } },
          seedInputs: [{ label: "normal", value: { a: 1, b: 2 } }],
          evidence: "addition is commutative",
          confidence: 0.9,
          evidenceSource: "spec",
          relatedFunctions: ["subtract"],
        },
      ],
    };

    const result = parseInferResponse(raw, opts);
    assert.equal(result.length, 1);
    assert.equal(result[0].targetFunction, "add");
    assert.equal(result[0].id, "prop_001");
    assert.equal(result[0].sourceHash, "abc123");
    assert.equal(result[0].evidenceSource, "spec");
    assert.deepEqual(result[0].relatedFunctions, ["subtract"]);
  });

  it("should skip malformed entries", () => {
    const raw = {
      properties: [
        { targetFunction: "add" }, // Missing fields
        {
          targetFunction: "sub",
          description: "Valid",
          category: "boundary",
          assertion: "sub(a, b) >= 0",
          generators: { a: { type: "integer" } },
          seedInputs: [{ label: "normal", value: 1 }],
          evidence: "result check",
          confidence: 0.8,
        },
      ],
    };

    const result = parseInferResponse(raw, opts);
    assert.equal(result.length, 1);
    assert.equal(result[0].targetFunction, "sub");
  });

  it("should handle null/undefined input", () => {
    assert.equal(parseInferResponse(null, opts).length, 0);
    assert.equal(parseInferResponse(undefined, opts).length, 0);
    assert.equal(parseInferResponse("string", opts).length, 0);
  });

  it("should normalize string-format generators from real LLMs", () => {
    const raw = {
      properties: [
        {
          targetFunction: "applyDiscount",
          description: "Zero discount returns original price",
          category: "boundary",
          assertion: "applyDiscount(price, 0) === price",
          generators: { price: "float(0, 10000)" },
          seedInputs: [{ label: "normal", value: { price: 1 } }],
          evidence: "formula preserves price at 0% discount",
          confidence: 0.9,
        },
      ],
    };

    const result = parseInferResponse(raw, opts);
    assert.equal(result.length, 1);
    assert.deepEqual(result[0].generators, { price: { type: "float", constraints: { min: 0, max: 10000 } } });
  });

  it("should normalize nested array generator strings", () => {
    const raw = {
      properties: [
        {
          targetFunction: "calculateTotal",
          description: "works for arrays",
          category: "boundary",
          assertion: "calculateTotal(prices) >= 0",
          generators: { prices: "array(float(0, 1000), 0, 10)" },
          seedInputs: [{ label: "normal", value: { prices: [1, 2, 3] } }],
          evidence: "sum of non-negative values is non-negative",
          confidence: 0.8,
        },
      ],
    };

    const result = parseInferResponse(raw, opts);
    assert.equal(result.length, 1);
    assert.deepEqual(result[0].generators, {
      prices: {
        type: "array",
        constraints: {
          element: "float",
          elementConstraints: { min: 0, max: 1000 },
          maxLength: 10,
        },
      },
    });
  });

  it("should map single numeric argument generators by type", () => {
    const raw = {
      properties: [
        {
          targetFunction: "formatPrice",
          description: "string max length",
          category: "boundary",
          assertion: "formatPrice(value).length <= 50",
          generators: {
            value: "float(100)",
            label: "string(50)",
          },
          seedInputs: [{ label: "normal", value: { value: 10, label: "ok" } }],
          evidence: "test generator parsing",
          confidence: 0.8,
        },
      ],
    };

    const result = parseInferResponse(raw, opts);
    assert.equal(result.length, 1);
    assert.deepEqual(result[0].generators, {
      value: { type: "float", constraints: { max: 100 } },
      label: { type: "string", constraints: { maxLength: 50 } },
    });
  });

  it("should normalize array generator objects from third-party providers", () => {
    const raw = {
      properties: [
        {
          targetFunction: "calculateTotal",
          description: "sum of non-negative prices is non-negative",
          category: "boundary",
          assertion: "calculateTotal(prices) >= 0",
          generators: {
            prices: {
              type: "array",
              constraints: {
                itemType: "float",
                itemMin: 0,
                itemMax: 100000,
                minItems: 0,
                maxItems: 100,
              },
            },
          },
          seedInputs: [{ label: "normal", value: { prices: [1, 2, 3] } }],
          evidence: "sum of non-negative values is non-negative",
          confidence: 0.9,
        },
      ],
    };

    const result = parseInferResponse(raw, opts);
    assert.equal(result.length, 1);
    assert.deepEqual(result[0].generators, {
      prices: {
        type: "array",
        constraints: {
          itemType: "float",
          itemMin: 0,
          itemMax: 100000,
          minItems: 0,
          maxItems: 100,
          element: "float",
          elementConstraints: { min: 0, max: 100000 },
          maxLength: 100,
        },
      },
    });
  });
});

describe("template-backed inference", () => {
  it("should build domain-backed template properties for matching functions", () => {
    const context: AnalysisContext = {
      filePath: "pricing.ts",
      language: "typescript",
      sourceCode: "export function applyDiscount(price: number, discount: number): number { return price * (1 - discount / 100); }",
      functions: [
        makeFunctionSignature({
          name: "applyDiscount",
          parameters: [
            { name: "price", type: "number", defaultValue: null, isOptional: false, isRest: false },
            { name: "discount", type: "number", defaultValue: null, isOptional: false, isRest: false },
          ],
          returnType: "number",
        }),
      ],
      types: [],
      imports: [],
      signals: { ast: [], type: [], doc: [] },
    };

    const properties = buildTemplateProperties(context);
    assert.ok(properties.length >= 2);
    assert.ok(properties.every((property) => property.evidenceSource === "domain"));
    assert.ok(properties.some((property) => property.assertion.includes("approxEqual(applyDiscount(price, 0), price)")));
  });

  it("should preserve qualified names in template-backed properties", () => {
    const context: AnalysisContext = {
      filePath: "pricing.ts",
      language: "typescript",
      sourceCode: "export class Cart { applyDiscount(price: number, discount: number): number { return price * (1 - discount / 100); } }",
      functions: [
        makeFunctionSignature({
          name: "applyDiscount",
          qualifiedName: "Cart.applyDiscount",
          parameters: [
            { name: "price", type: "number", defaultValue: null, isOptional: false, isRest: false },
            { name: "discount", type: "number", defaultValue: null, isOptional: false, isRest: false },
          ],
          returnType: "number",
        }),
      ],
      types: [],
      imports: [],
      signals: { ast: [], type: [], doc: [] },
    };

    const properties = buildTemplateProperties(context);
    assert.ok(properties.length >= 1);
    assert.ok(properties.every((property) => property.targetFunction === "Cart.applyDiscount"));
  });
});

describe("prompt builder", () => {
  it("should include sibling functions when provided", () => {
    const context: AnalysisContext = {
      filePath: "codec.ts",
      language: "typescript",
      sourceCode: "export function encode(value: string): number { return value.length; }",
      functions: [
        makeFunctionSignature({
          name: "encode",
          parameters: [{ name: "value", type: "string", defaultValue: null, isOptional: false, isRest: false }],
          returnType: "number",
        }),
      ],
      types: [],
      imports: [],
      signals: { ast: [], type: [], doc: [] },
    };

    const sibling = makeFunctionSignature({
      name: "decode",
      parameters: [{ name: "encoded", type: "number", defaultValue: null, isOptional: false, isRest: false }],
      returnType: "string",
    });

    const prompt = buildInferPrompt(context, [sibling]);
    assert.match(prompt, /Look for cross-function properties between the analyzed functions and these sibling functions:/);
    assert.match(prompt, /function decode\(encoded: number\): string/);
  });
});

describe("scoring", () => {
  it("should give high score to well-formed property", () => {
    const score = scoreProperty(makeTestProp());
    assert.ok(score >= 12, `Expected >= 12, got ${score}`);
  });

  it("should give low score to tautology", () => {
    const score = scoreProperty(makeTestProp({ assertion: "true" }));
    assert.ok(score < 12, `Expected < 12, got ${score}`);
  });

  it("should give low score to empty evidence", () => {
    const score = scoreProperty(makeTestProp({ evidence: "" }));
    assert.ok(score < 13, `Expected < 13, got ${score}`);
  });

  it("should detect redundant properties", () => {
    const p1 = makeTestProp({ assertion: "add(a, b) >= 0" });
    const p2 = makeTestProp({ assertion: "add(a, b) >= 0" });
    assert.equal(isRedundant(p2, [p1]), true);
  });

  it("should not mark different properties as redundant", () => {
    const p1 = makeTestProp({ assertion: "add(a, b) >= 0" });
    const p2 = makeTestProp({ assertion: "add(a, b) === add(b, a)" });
    assert.equal(isRedundant(p2, [p1]), false);
  });

  it("should filter by minScore", () => {
    const props = [
      makeTestProp({ confidence: 0.9 }),
      makeTestProp({ assertion: "true", confidence: 0.1, evidence: "" }),
    ];
    const filtered = scoreAndFilter(props, 10);
    assert.equal(filtered.length, 1);
  });

  it("should penalize tiny float tolerances", () => {
    const score = scoreProperty(makeTestProp({
      targetFunction: "calculateTotal",
      assertion: "Math.abs(calculateTotal(a) - calculateTotal(b)) < 1e-12",
      generators: {
        a: { type: "array", constraints: { element: "float", maxLength: 5 } },
        b: { type: "array", constraints: { element: "float", maxLength: 5 } },
      },
    }));
    assert.ok(score <= 12, `Expected fragile tolerance penalty, got ${score}`);
  });

  it("should penalize exact float equality", () => {
    const score = scoreProperty(makeTestProp({
      targetFunction: "formatPrice",
      assertion: "parseFloat(formatPrice(price)) === price",
      generators: { price: { type: "float", constraints: { min: 0, max: 1000 } } },
    }));
    assert.ok(score <= 9, `Expected exact float equality penalty, got ${score}`);
  });

  it("should not penalize reasonable tolerances", () => {
    const score = scoreProperty(makeTestProp({
      targetFunction: "formatPrice",
      assertion: "Math.abs(parseFloat(formatPrice(price)) - price) < 0.005",
      generators: { price: { type: "float", constraints: { min: 0, max: 1000 } } },
    }));
    assert.ok(score >= 12, `Expected reasonable tolerance to stay high, got ${score}`);
  });

  it("should tag wide numeric domains and missing preconditions as risk", () => {
    const property = makeTestProp({
      assertion: "calculateTotal(prices) >= 0",
      targetFunction: "calculateTotal",
      generators: { prices: { type: "array", constraints: { element: "float" } } },
    });

    const tags = detectRiskTags(property);
    assert.ok(tags.includes("wide_numeric_domain"));
    assert.ok(tags.includes("missing_precondition"));
  });

  it("should compute risk score separately from quality score", () => {
    const property = makeTestProp({
      targetFunction: "formatPrice",
      assertion: "parseFloat(formatPrice(price)) === price",
      generators: { price: { type: "float", constraints: { min: 0, max: 1000 } } },
    });

    const score = scoreProperty(property);
    const tags = detectRiskTags(property);
    const riskScore = computeRiskScore(property, score, tags);

    assert.ok(score > riskScore, `Expected risk score below quality score, got score=${score}, riskScore=${riskScore}`);
    assert.ok(tags.includes("float_exact_equality"));
    assert.ok(tags.includes("roundtrip_numeric_fragility"));
  });

  it("should not flag approxEqual-based assertions as exact float equality", () => {
    const property = makeTestProp({
      assertion: "approxEqual(add(a, b), add(b, a))",
      generators: { a: { type: "float" }, b: { type: "float" } },
    });

    const tags = detectRiskTags(property);
    assert.ok(!tags.includes("float_exact_equality"));
  });
});

describe("refinement", () => {
  function makeResult(overrides: Partial<ExecutionResult> = {}): ExecutionResult {
    return {
      passed: [{ propertyId: "prop_001", status: "passed", iterations: 100, duration: 0, seed: 0 }],
      failed: [{ propertyId: "prop_002", status: "failed", counterexample: [101], shrinkSteps: 3, originalInput: [101], errorMessage: "boom", seed: 0, duration: 0 }],
      errors: [],
      skipped: [],
      duration: 0,
      totalIterations: 100,
      properties: [],
      ...overrides,
    };
  }

  it("should classify strong, weak, and bug-finding properties", () => {
    const strong = makeTestProp({ id: "prop_001", score: 13, confidence: 0.95, description: "strong prop" });
    const weak = makeTestProp({ id: "prop_003", score: 10, confidence: 0.6, description: "weak prop" });
    const bug = makeTestProp({ id: "prop_002", score: 12, confidence: 0.9, description: "bug prop" });

    const classifications = classifyProperties([strong, weak, bug], makeResult());

    assert.equal(classifications[0].kind, "strong");
    assert.equal(classifications[1].kind, "failed");
    assert.equal(classifications[2].kind, "bug_found");
  });

  it("should build a feedback summary and refinement prompt", () => {
    const weak = makeTestProp({ id: "prop_001", targetFunction: "add", description: "weak prop", score: 10, confidence: 0.6 });
    const bug = makeTestProp({ id: "prop_002", targetFunction: "add", description: "bug prop", score: 13, confidence: 0.9 });

    const classifications = classifyProperties(
      [weak, bug],
      makeResult({
        passed: [],
        failed: [{ propertyId: "prop_002", status: "failed", counterexample: [5, 6], shrinkSteps: 1, originalInput: [5, 6], errorMessage: "bug", seed: 0, duration: 0 }],
        errors: [{ propertyId: "prop_001", status: "error", errorMessage: "too weak", duration: 0 }],
      }),
    );

    const feedback = buildFeedbackSummary(classifications, ["add", "subtract"]);
    const prompt = buildRefinementPrompt("ORIGINAL PROMPT", feedback);

    assert.match(feedback, /BUG FOUND/);
    assert.match(feedback, /Coverage Gaps/);
    assert.match(prompt, /ORIGINAL PROMPT/);
    assert.match(prompt, /Round 1 Results/);
    assert.match(prompt, /Generate ONLY new or improved properties/);
  });
});

describe("mock-client", () => {
  it("should return properties for known function names", async () => {
    const client = createMockClient();
    const response = await client.call(
      "system",
      "## Functions to analyze:\n\n### applyDiscount\nSignature: function applyDiscount(price: number, discount: number): number",
      [],
    );

    assert.ok(response.content !== null);
    const content = response.content as { properties: unknown[] };
    assert.ok(content.properties.length >= 2);
  });

  it("should return generic response for unknown functions", async () => {
    const client = createMockClient();
    const response = await client.call(
      "system",
      "### unknownXyzFunction\nSignature: function unknownXyzFunction()",
      [],
    );

    assert.ok(response.content !== null);
    const content = response.content as { properties: unknown[] };
    assert.ok(content.properties.length >= 1);
  });
});
