import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import { parseInferResponse } from "../response-parser";
import { scoreProperty, scoreAndFilter, isRedundant } from "../scoring";
import { createMockClient } from "../mock-client";
import type { PropertyDefinition } from "@propcheck/common";

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
        },
      ],
    };

    const result = parseInferResponse(raw, opts);
    assert.equal(result.length, 1);
    assert.equal(result[0].targetFunction, "add");
    assert.equal(result[0].id, "prop_001");
    assert.equal(result[0].sourceHash, "abc123");
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

describe("scoring", () => {
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
      score: 0,
      confidence: 0.9,
      evidence: "result should be non-negative for positive inputs",
      sourceHash: "abc",
      inferredAt: "2026-01-01",
      modelId: "test",
      ...overrides,
    };
  }

  it("should give high score to well-formed property", () => {
    const score = scoreProperty(makeProp());
    assert.ok(score >= 12, `Expected >= 12, got ${score}`);
  });

  it("should give low score to tautology", () => {
    const score = scoreProperty(makeProp({ assertion: "true" }));
    assert.ok(score < 12, `Expected < 12, got ${score}`);
  });

  it("should give low score to empty evidence", () => {
    const score = scoreProperty(makeProp({ evidence: "" }));
    assert.ok(score < 13, `Expected < 13, got ${score}`);
  });

  it("should detect redundant properties", () => {
    const p1 = makeProp({ assertion: "add(a, b) >= 0" });
    const p2 = makeProp({ assertion: "add(a, b) >= 0" });
    assert.equal(isRedundant(p2, [p1]), true);
  });

  it("should not mark different properties as redundant", () => {
    const p1 = makeProp({ assertion: "add(a, b) >= 0" });
    const p2 = makeProp({ assertion: "add(a, b) === add(b, a)" });
    assert.equal(isRedundant(p2, [p1]), false);
  });

  it("should filter by minScore", () => {
    const props = [
      makeProp({ confidence: 0.9 }),
      makeProp({ assertion: "true", confidence: 0.1, evidence: "" }),
    ];
    const filtered = scoreAndFilter(props, 10);
    assert.equal(filtered.length, 1);
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
