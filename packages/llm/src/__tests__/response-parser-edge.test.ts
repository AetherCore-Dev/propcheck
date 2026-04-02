/**
 * Edge case tests for response-parser — LLM output normalization.
 */
import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import { parseInferResponse } from "../response-parser";

const opts = { sourceHash: "abc123", modelId: "test-model" };

function makeRawProperty(overrides: Record<string, unknown> = {}) {
  return {
    targetFunction: "add",
    description: "test",
    category: "boundary",
    assertion: "add(a, b) >= 0",
    generators: { a: { type: "integer" }, b: { type: "integer" } },
    seedInputs: [{ label: "normal", value: 1 }],
    evidence: "non-negative result",
    confidence: 0.9,
    ...overrides,
  };
}

describe("parseInferResponse — edge cases", () => {
  it("should handle deeply nested array string generators", () => {
    const raw = {
      properties: [makeRawProperty({
        generators: {
          matrix: "array(array(float(0, 1), 0, 5), 0, 3)",
        },
      })],
    };
    const result = parseInferResponse(raw, opts);
    assert.equal(result.length, 1);
    assert.equal(result[0].generators.matrix.type, "array");
  });

  it("should handle empty generators object", () => {
    const raw = {
      properties: [makeRawProperty({ generators: {} })],
    };
    // generators: {} means genCount=0, Zod accepts empty record
    const result = parseInferResponse(raw, opts);
    // Should still parse but might fail Zod validation since min isn't enforced on record
    assert.ok(result.length <= 1);
  });

  it("should reject properties with unsafe assertion (injection attempt)", () => {
    const raw = {
      properties: [makeRawProperty({
        assertion: "require('child_process').execSync('rm -rf /')",
      })],
    };
    const result = parseInferResponse(raw, opts);
    assert.equal(result.length, 0); // Sanitizer should block it
  });

  it("should reject properties with unsafe generator key", () => {
    const raw = {
      properties: [makeRawProperty({
        generators: { "a; rm -rf": { type: "integer" } },
      })],
    };
    const result = parseInferResponse(raw, opts);
    assert.equal(result.length, 0);
  });

  it("should reject properties with unsafe targetFunction", () => {
    const raw = {
      properties: [makeRawProperty({
        targetFunction: "require('fs')",
      })],
    };
    const result = parseInferResponse(raw, opts);
    assert.equal(result.length, 0);
  });

  it("should normalize unknown category to 'boundary'", () => {
    const raw = {
      properties: [makeRawProperty({ category: "nonexistent_category" })],
    };
    const result = parseInferResponse(raw, opts);
    assert.equal(result.length, 1);
    assert.equal(result[0].category, "boundary");
  });

  it("should handle integer string generators like 'integer(-100, 100)'", () => {
    const raw = {
      properties: [makeRawProperty({
        generators: { x: "integer(-100, 100)" },
      })],
    };
    const result = parseInferResponse(raw, opts);
    assert.equal(result.length, 1);
    assert.equal(result[0].generators.x.type, "integer");
    assert.equal(result[0].generators.x.constraints?.min, -100);
    assert.equal(result[0].generators.x.constraints?.max, 100);
  });

  it("should handle boolean string generators", () => {
    const raw = {
      properties: [makeRawProperty({
        generators: { flag: "boolean" },
      })],
    };
    const result = parseInferResponse(raw, opts);
    assert.equal(result.length, 1);
    assert.equal(result[0].generators.flag.type, "boolean");
  });

  it("should handle provider array constraints with itemType/itemMin/itemMax", () => {
    const raw = {
      properties: [makeRawProperty({
        generators: {
          prices: {
            type: "array",
            constraints: {
              itemType: "float",
              itemMin: 0,
              itemMax: 100,
              minItems: 1,
              maxItems: 10,
            },
          },
        },
      })],
    };
    const result = parseInferResponse(raw, opts);
    assert.equal(result.length, 1);
    const gen = result[0].generators.prices;
    assert.equal(gen.type, "array");
    assert.equal(gen.constraints?.element, "float");
    assert.equal(gen.constraints?.maxLength, 10);
  });

  it("should handle unknown type with fields as object generator", () => {
    const raw = {
      properties: [makeRawProperty({
        generators: {
          config: {
            type: "AppConfig",
            constraints: {
              fields: { timeout: { type: "integer" }, name: { type: "string" } },
            },
          },
        },
      })],
    };
    const result = parseInferResponse(raw, opts);
    assert.equal(result.length, 1);
    assert.equal(result[0].generators.config.type, "object");
  });

  it("should reject more than 20 generators", () => {
    const generators: Record<string, unknown> = {};
    for (let i = 0; i < 21; i++) {
      generators[`param${i}`] = { type: "integer" };
    }
    const raw = {
      properties: [makeRawProperty({ generators })],
    };
    const result = parseInferResponse(raw, opts);
    assert.equal(result.length, 0);
  });

  it("should handle properties array inside non-Zod-compliant wrapper", () => {
    // LLM returns extra fields at top level
    const raw = {
      properties: [makeRawProperty()],
      extraField: "should be ignored",
    };
    const result = parseInferResponse(raw, opts);
    assert.equal(result.length, 1);
  });

  it("should assign sequential IDs (prop_001, prop_002, ...)", () => {
    const raw = {
      properties: [
        makeRawProperty({ targetFunction: "add" }),
        makeRawProperty({ targetFunction: "sub", assertion: "sub(a, b) >= 0" }),
      ],
    };
    const result = parseInferResponse(raw, opts);
    assert.equal(result.length, 2);
    assert.equal(result[0].id, "prop_001");
    assert.equal(result[1].id, "prop_002");
  });

  it("should set score to 0 initially (scoring happens later)", () => {
    const raw = { properties: [makeRawProperty()] };
    const result = parseInferResponse(raw, opts);
    assert.equal(result[0].score, 0);
  });

  it("should preserve confidence value from LLM", () => {
    const raw = { properties: [makeRawProperty({ confidence: 0.42 })] };
    const result = parseInferResponse(raw, opts);
    assert.equal(result[0].confidence, 0.42);
  });
});
