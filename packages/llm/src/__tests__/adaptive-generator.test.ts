/**
 * Tests for adaptive property generator.
 */

import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import {
  generateAdaptiveProperties,
  mapParamGenerators,
  selectCategories,
  buildSeedInputs,
} from "../adaptive-generator";
import { extractSignaturesFromPrompt } from "../mock-client";
import { scoreProperty } from "../scoring";
import type { FunctionSignature, ParameterInfo, PropertyDefinition } from "@propcheck/common";
import type { RawMockProperty } from "../adaptive-generator";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSig(overrides: Partial<FunctionSignature> & { name: string }): FunctionSignature {
  return {
    qualifiedName: overrides.qualifiedName ?? overrides.name,
    parameters: [],
    returnType: null,
    docstring: null,
    visibility: "public",
    isAsync: false,
    isGenerator: false,
    loc: { startLine: 1, endLine: 10, startColumn: 0, endColumn: 0 },
    ...overrides,
  };
}

function makeParam(name: string, type: string | null = null, opts: Partial<ParameterInfo> = {}): ParameterInfo {
  return { name, type, defaultValue: null, isOptional: false, isRest: false, ...opts };
}

/** Convert a RawMockProperty to a minimal PropertyDefinition for scoring. */
function toScorable(prop: RawMockProperty): PropertyDefinition {
  return {
    id: "test_001",
    ...prop,
    score: 0,
    riskScore: 0,
    riskTags: [],
    status: "accepted",
    sourceHash: "abc123",
    inferredAt: new Date().toISOString(),
    modelId: "mock",
  };
}

// ---------------------------------------------------------------------------
// 1. Parameter → Generator Mapping
// ---------------------------------------------------------------------------

describe("mapParamGenerators", () => {
  it("maps number type to float generator", () => {
    const gens = mapParamGenerators([makeParam("x", "number")]);
    assert.equal(gens.x.type, "float");
    assert.equal(typeof (gens.x.constraints as Record<string, unknown>).min, "number");
  });

  it("maps string type to string generator", () => {
    const gens = mapParamGenerators([makeParam("s", "string")]);
    assert.equal(gens.s.type, "string");
  });

  it("maps boolean type to boolean generator", () => {
    const gens = mapParamGenerators([makeParam("flag", "boolean")]);
    assert.equal(gens.flag.type, "boolean");
  });

  it("maps number[] to array of float generator", () => {
    const gens = mapParamGenerators([makeParam("arr", "number[]")]);
    assert.equal(gens.arr.type, "array");
    assert.equal((gens.arr.constraints as Record<string, unknown>).element, "float");
  });

  it("maps Array<string> to array of string generator", () => {
    const gens = mapParamGenerators([makeParam("items", "Array<string>")]);
    assert.equal(gens.items.type, "array");
    assert.equal((gens.items.constraints as Record<string, unknown>).element, "string");
  });

  it("uses name heuristic for price → float(0, 10000)", () => {
    const gens = mapParamGenerators([makeParam("price")]);
    assert.equal(gens.price.type, "float");
    assert.equal((gens.price.constraints as Record<string, unknown>).min, 0);
  });

  it("uses name heuristic for count → integer(0, 1000)", () => {
    const gens = mapParamGenerators([makeParam("count")]);
    assert.equal(gens.count.type, "integer");
    assert.equal((gens.count.constraints as Record<string, unknown>).min, 0);
  });

  it("falls back to integer for unknown type and name", () => {
    const gens = mapParamGenerators([makeParam("xyz")]);
    assert.equal(gens.xyz.type, "integer");
  });

  it("handles rest params as array", () => {
    const gens = mapParamGenerators([makeParam("args", null, { isRest: true })]);
    assert.equal(gens.args.type, "array");
  });

  it("returns empty record for no params", () => {
    const gens = mapParamGenerators([]);
    assert.deepEqual(gens, {});
  });
});

// ---------------------------------------------------------------------------
// 2. Category Selection
// ---------------------------------------------------------------------------

describe("selectCategories", () => {
  it("always includes boundary", () => {
    const sig = makeSig({ name: "doSomething" });
    const cats = selectCategories(sig);
    assert.ok(cats.includes("boundary"));
  });

  it("returns at least 3 categories", () => {
    const sig = makeSig({ name: "doSomething" });
    const cats = selectCategories(sig);
    assert.ok(cats.length >= 3);
  });

  it("returns at most 5 categories", () => {
    const sig = makeSig({
      name: "sortAndFilter",
      parameters: [makeParam("arr", "number[]"), makeParam("arr2", "number[]")],
      returnType: "number[]",
    });
    const cats = selectCategories(sig);
    assert.ok(cats.length <= 5);
  });

  it("boosts monotonic for sort-like names", () => {
    const sig = makeSig({ name: "sortItems", parameters: [makeParam("arr", "number[]")], returnType: "number[]" });
    const cats = selectCategories(sig);
    assert.ok(cats.includes("monotonic"));
  });

  it("boosts roundtrip for parse-like names", () => {
    const sig = makeSig({ name: "parseValue", parameters: [makeParam("s", "string")], returnType: "string" });
    const cats = selectCategories(sig);
    assert.ok(cats.includes("roundtrip"));
  });

  it("boosts conservation for array params", () => {
    const sig = makeSig({ name: "process", parameters: [makeParam("items", "number[]")], returnType: "number[]" });
    const cats = selectCategories(sig);
    assert.ok(cats.includes("conservation"));
  });

  it("boosts equivalence for 2 same-type params", () => {
    const sig = makeSig({ name: "combine", parameters: [makeParam("a", "number"), makeParam("b", "number")], returnType: "number" });
    const cats = selectCategories(sig);
    assert.ok(cats.includes("equivalence"));
  });

  it("boosts boundary for boolean return", () => {
    const sig = makeSig({ name: "check", returnType: "boolean" });
    const cats = selectCategories(sig);
    assert.ok(cats.includes("boundary"));
    // boundary should be high-ranked
    assert.equal(cats[0], "boundary");
  });
});

// ---------------------------------------------------------------------------
// 3. Property Building
// ---------------------------------------------------------------------------

describe("generateAdaptiveProperties", () => {
  it("generates at least 3 properties for any function", () => {
    const sig = makeSig({ name: "foo", parameters: [makeParam("x", "number")], returnType: "number" });
    const props = generateAdaptiveProperties(sig);
    assert.ok(props.length >= 3, `Expected ≥ 3, got ${props.length}`);
  });

  it("generates at most 5 properties", () => {
    const sig = makeSig({
      name: "complexFn",
      parameters: [makeParam("a", "number"), makeParam("b", "number"), makeParam("arr", "number[]")],
      returnType: "number[]",
    });
    const props = generateAdaptiveProperties(sig);
    assert.ok(props.length <= 5, `Expected ≤ 5, got ${props.length}`);
  });

  it("each property references function name in assertion", () => {
    const sig = makeSig({ name: "calculateTax", parameters: [makeParam("amount", "number")], returnType: "number" });
    const props = generateAdaptiveProperties(sig);
    for (const prop of props) {
      assert.ok(prop.assertion.includes("calculateTax"), `Assertion should include function name: ${prop.assertion}`);
    }
  });

  it("no duplicate assertions", () => {
    const sig = makeSig({ name: "transform", parameters: [makeParam("s", "string")], returnType: "string" });
    const props = generateAdaptiveProperties(sig);
    const assertions = props.map((p) => p.assertion);
    const uniqueAssertions = new Set(assertions);
    assert.equal(uniqueAssertions.size, assertions.length, "Found duplicate assertions");
  });

  it("works for zero-param functions", () => {
    const sig = makeSig({ name: "getTimestamp", returnType: "number" });
    const props = generateAdaptiveProperties(sig);
    assert.ok(props.length >= 2, `Expected ≥ 2, got ${props.length}`);
  });

  it("works for many-param functions", () => {
    const params = Array.from({ length: 8 }, (_, i) => makeParam(`p${i}`, "number"));
    const sig = makeSig({ name: "multiParam", parameters: params, returnType: "number" });
    const props = generateAdaptiveProperties(sig);
    assert.ok(props.length >= 3);
  });
});

// ---------------------------------------------------------------------------
// 4. Seed Inputs
// ---------------------------------------------------------------------------

describe("buildSeedInputs", () => {
  it("always returns 3 seeds", () => {
    const gens = { x: { type: "integer", constraints: { min: 0, max: 100 } } };
    const seeds = buildSeedInputs(gens);
    assert.equal(seeds.length, 3);
  });

  it("has correct labels: normal, boundary, extreme", () => {
    const gens = { x: { type: "string", constraints: { maxLength: 10 } } };
    const seeds = buildSeedInputs(gens);
    assert.equal(seeds[0].label, "normal");
    assert.equal(seeds[1].label, "boundary");
    assert.equal(seeds[2].label, "extreme");
  });
});

// ---------------------------------------------------------------------------
// 5. Scoring Integration
// ---------------------------------------------------------------------------

describe("adaptive properties scoring", () => {
  it("numeric function scores ≥ 10", () => {
    const sig = makeSig({ name: "calculateTotal", parameters: [makeParam("price", "number")], returnType: "number" });
    const props = generateAdaptiveProperties(sig);
    for (const prop of props) {
      const score = scoreProperty(toScorable(prop));
      assert.ok(score >= 10, `Property "${prop.description}" scored ${score}, expected ≥ 10`);
    }
  });

  it("string function scores ≥ 10", () => {
    const sig = makeSig({ name: "formatName", parameters: [makeParam("name", "string")], returnType: "string" });
    const props = generateAdaptiveProperties(sig);
    for (const prop of props) {
      const score = scoreProperty(toScorable(prop));
      assert.ok(score >= 10, `Property "${prop.description}" scored ${score}, expected ≥ 10`);
    }
  });

  it("boolean function scores ≥ 10", () => {
    const sig = makeSig({ name: "isValid", parameters: [makeParam("input", "string")], returnType: "boolean" });
    const props = generateAdaptiveProperties(sig);
    for (const prop of props) {
      const score = scoreProperty(toScorable(prop));
      assert.ok(score >= 10, `Property "${prop.description}" scored ${score}, expected ≥ 10`);
    }
  });

  it("array function scores ≥ 10", () => {
    const sig = makeSig({ name: "filterItems", parameters: [makeParam("items", "number[]")], returnType: "number[]" });
    const props = generateAdaptiveProperties(sig);
    for (const prop of props) {
      const score = scoreProperty(toScorable(prop));
      assert.ok(score >= 10, `Property "${prop.description}" scored ${score}, expected ≥ 10`);
    }
  });

  it("zero-param function scores ≥ 10", () => {
    const sig = makeSig({ name: "getConfig", returnType: "number" });
    const props = generateAdaptiveProperties(sig);
    for (const prop of props) {
      const score = scoreProperty(toScorable(prop));
      assert.ok(score >= 10, `Property "${prop.description}" scored ${score}, expected ≥ 10`);
    }
  });

  it("no tautologies in generated properties", () => {
    const TAUTOLOGY_PATTERNS = [
      /^true$/i,
      /^x\s*===?\s*x$/,
      /^result\s*===?\s*result$/,
      /^typeof\s+\w+\s*(!==?|===?)\s*['"]undefined['"]\s*$/,
    ];
    const sig = makeSig({ name: "process", parameters: [makeParam("data", "string")], returnType: "string" });
    const props = generateAdaptiveProperties(sig);
    for (const prop of props) {
      const isTautology = TAUTOLOGY_PATTERNS.some((pat) => pat.test(prop.assertion.trim()));
      assert.ok(!isTautology, `Assertion is a tautology: ${prop.assertion}`);
    }
  });
});

// ---------------------------------------------------------------------------
// 6. Mock Client Integration (prompt parsing)
// ---------------------------------------------------------------------------

describe("extractSignaturesFromPrompt", () => {
  it("parses function with typed params and return type", () => {
    const prompt = `### calculateTotal\nSignature: function calculateTotal(prices: number[]): number\nDocumentation: Sums all prices`;
    const sigs = extractSignaturesFromPrompt(prompt);
    assert.equal(sigs.length, 1);
    assert.equal(sigs[0].name, "calculateTotal");
    assert.equal(sigs[0].parameters.length, 1);
    assert.equal(sigs[0].parameters[0].name, "prices");
    assert.equal(sigs[0].parameters[0].type, "number[]");
    assert.equal(sigs[0].returnType, "number");
  });

  it("parses async function", () => {
    const prompt = `### fetchData\nSignature: async function fetchData(url: string): Promise<string>`;
    const sigs = extractSignaturesFromPrompt(prompt);
    assert.equal(sigs[0].isAsync, true);
    assert.equal(sigs[0].returnType, "Promise<string>");
  });

  it("parses multiple functions", () => {
    const prompt = `### foo\nSignature: function foo(x: number): number\n\n### bar\nSignature: function bar(s: string): boolean`;
    const sigs = extractSignaturesFromPrompt(prompt);
    assert.equal(sigs.length, 2);
    assert.equal(sigs[0].name, "foo");
    assert.equal(sigs[1].name, "bar");
  });

  it("parses function with no return type", () => {
    const prompt = `### doStuff\nSignature: function doStuff(x: number)`;
    const sigs = extractSignaturesFromPrompt(prompt);
    assert.equal(sigs[0].returnType, null);
  });

  it("parses optional and default params", () => {
    const prompt = `### greet\nSignature: function greet(name: string, greeting?: string)`;
    const sigs = extractSignaturesFromPrompt(prompt);
    assert.equal(sigs[0].parameters.length, 2);
    assert.equal(sigs[0].parameters[1].isOptional, true);
  });
});

// ---------------------------------------------------------------------------
// 7. Edge Cases
// ---------------------------------------------------------------------------

describe("edge cases", () => {
  it("generic/union types fall back gracefully", () => {
    const sig = makeSig({
      name: "transform",
      parameters: [makeParam("input", "T | null")],
      returnType: "T",
    });
    const props = generateAdaptiveProperties(sig);
    assert.ok(props.length >= 3);
  });

  it("confidence is always 0.85", () => {
    const sig = makeSig({ name: "fn", parameters: [makeParam("x", "number")], returnType: "number" });
    const props = generateAdaptiveProperties(sig);
    for (const prop of props) {
      assert.equal(prop.confidence, 0.85);
    }
  });

  it("evidence is always > 10 chars", () => {
    const sig = makeSig({ name: "fn", parameters: [makeParam("x", "number")], returnType: "number" });
    const props = generateAdaptiveProperties(sig);
    for (const prop of props) {
      assert.ok(prop.evidence.length > 10, `Evidence too short: "${prop.evidence}"`);
    }
  });
});
