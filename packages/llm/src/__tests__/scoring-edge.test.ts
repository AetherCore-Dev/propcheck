/**
 * Edge case tests for scoring, risk detection, and filtering.
 */
import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import {
  scoreProperty,
  isRedundant,
  scoreAndFilter,
  detectRiskTags,
  computeRiskScore,
} from "../scoring";
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
    score: 0,
    riskScore: 0,
    riskTags: [],
    status: "accepted",
    confidence: 0.9,
    evidence: "result should be non-negative for positive inputs",
    sourceHash: "abc",
    inferredAt: "2026-01-01",
    modelId: "test",
    ...overrides,
  };
}

describe("scoreProperty — edge cases", () => {
  it("should score low for a completely empty property", () => {
    const score = scoreProperty(makeProp({
      assertion: "",
      generators: {},
      confidence: 0,
      evidence: "",
      seedInputs: [],
    }));
    // Empty assertion won't match target function (0) + no generators (0) +
    // low confidence (0) + no evidence (0) + not tautology (2) + not trivial (2) +
    // no seeds (0) = 4. Still low but not zero.
    assert.ok(score <= 6, `Expected low score, got ${score}`);
  });

  it("should detect tautology 'true'", () => {
    const score = scoreProperty(makeProp({ assertion: "true" }));
    assert.ok(score < 12, `Tautology should be penalized, got ${score}`);
  });

  it("should detect tautology 'x === x'", () => {
    const score = scoreProperty(makeProp({ assertion: "x === x" }));
    assert.ok(score < 12, `Tautology should be penalized, got ${score}`);
  });

  it("should detect tautology 'result === result'", () => {
    const score = scoreProperty(makeProp({ assertion: "result === result" }));
    assert.ok(score < 12);
  });

  it("should NOT mark 'add(a, b) === add(b, a)' as tautology", () => {
    const score = scoreProperty(makeProp({ assertion: "add(a, b) === add(b, a)" }));
    assert.ok(score >= 12, `Non-tautology should score well, got ${score}`);
  });

  it("should clamp score to 0 minimum", () => {
    // Force many penalties with fragile generators
    const score = scoreProperty(makeProp({
      assertion: "parseFloat(formatPrice(price)) === price",
      generators: { price: { type: "float" } },
      confidence: 0.1,
      evidence: "",
      seedInputs: [],
    }));
    assert.ok(score >= 0, `Score should never be negative, got ${score}`);
  });

  it("should clamp score to 13 maximum", () => {
    const score = scoreProperty(makeProp());
    assert.ok(score <= 13, `Score should never exceed 13, got ${score}`);
  });

  it("should give bonus for 3 seed inputs", () => {
    const with3 = scoreProperty(makeProp({
      seedInputs: [
        { label: "normal", value: 1 },
        { label: "boundary", value: 0 },
        { label: "extreme", value: -1 },
      ],
    }));
    const with1 = scoreProperty(makeProp({
      seedInputs: [{ label: "normal", value: 1 }],
    }));
    assert.ok(with3 > with1, `3 seeds should score higher: ${with3} vs ${with1}`);
  });

  it("should score LOW for pure typeof assertion: typeof add(a, b) === 'number'", () => {
    const trivialScore = scoreProperty(makeProp({
      assertion: 'typeof add(a, b) === "number"',
    }));
    const normalScore = scoreProperty(makeProp({
      assertion: "add(a, b) >= 0",
    }));
    assert.ok(trivialScore < normalScore, `Trivial typeof should score lower: ${trivialScore} vs ${normalScore}`);
  });

  it("should score LOW for pure typeof assertion: typeof isValid(x) === 'boolean'", () => {
    const trivialScore = scoreProperty(makeProp({
      assertion: 'typeof isValid(x) === "boolean"',
    }));
    const normalScore = scoreProperty(makeProp({
      assertion: "add(a, b) >= 0",
    }));
    assert.ok(trivialScore < normalScore, `Trivial typeof should score lower: ${trivialScore} vs ${normalScore}`);
  });

  it("should score NORMAL when typeof is part of a larger expression", () => {
    const score = scoreProperty(makeProp({
      assertion: 'typeof add(a, b) === "number" && add(a, b) >= 0',
    }));
    const normalScore = scoreProperty(makeProp({
      assertion: "add(a, b) >= 0",
    }));
    assert.equal(score, normalScore, `Compound typeof should score same as normal: ${score} vs ${normalScore}`);
  });

  it("should score NORMAL for non-typeof assertion", () => {
    const score = scoreProperty(makeProp({
      assertion: "add(a, b) >= 0",
    }));
    // Should get full 2 pts for not-trivial
    assert.ok(score >= 10, `Normal assertion should score well, got ${score}`);
  });

  it("should handle qualified function names (Class.method)", () => {
    const score = scoreProperty(makeProp({
      targetFunction: "Calculator.add",
      assertion: "Calculator.add(a, b) === Calculator.add(b, a)",
    }));
    // Should still find "add" in assertion
    assert.ok(score >= 10, `Qualified name should be found, got ${score}`);
  });
});

describe("detectRiskTags — edge cases", () => {
  it("should detect float_exact_equality with number type", () => {
    const tags = detectRiskTags(makeProp({
      assertion: "fn(x) === fn(y)",
      generators: { x: { type: "number" }, y: { type: "number" } },
    }));
    assert.ok(tags.includes("float_exact_equality"));
  });

  it("should NOT detect float_exact_equality with integer type", () => {
    const tags = detectRiskTags(makeProp({
      assertion: "fn(x) === fn(y)",
      generators: { x: { type: "integer" }, y: { type: "integer" } },
    }));
    assert.ok(!tags.includes("float_exact_equality"));
  });

  it("should NOT detect float_exact_equality when using Math.abs", () => {
    const tags = detectRiskTags(makeProp({
      assertion: "Math.abs(fn(x) - fn(y)) < 0.01",
      generators: { x: { type: "float" } },
    }));
    assert.ok(!tags.includes("float_exact_equality"));
  });

  it("should NOT detect float_exact_equality when using approxEqual", () => {
    const tags = detectRiskTags(makeProp({
      assertion: "approxEqual(fn(x), fn(y))",
      generators: { x: { type: "float" } },
    }));
    assert.ok(!tags.includes("float_exact_equality"));
  });

  it("should detect tiny_abs_tolerance for 1e-12", () => {
    const tags = detectRiskTags(makeProp({
      assertion: "Math.abs(a - b) < 1e-12",
    }));
    assert.ok(tags.includes("tiny_abs_tolerance"));
  });

  it("should NOT detect tiny_abs_tolerance for 1e-6", () => {
    const tags = detectRiskTags(makeProp({
      assertion: "Math.abs(a - b) < 1e-6",
    }));
    assert.ok(!tags.includes("tiny_abs_tolerance"));
  });

  it("should detect roundtrip_numeric_fragility for parseFloat + ===", () => {
    const tags = detectRiskTags(makeProp({
      assertion: "parseFloat(formatPrice(p)) === p",
      generators: { p: { type: "float" } },
    }));
    assert.ok(tags.includes("roundtrip_numeric_fragility"));
  });

  it("should detect wide_numeric_domain for unconstrained floats", () => {
    const tags = detectRiskTags(makeProp({
      assertion: "fn(x) >= 0",
      generators: { x: { type: "float" } },
    }));
    assert.ok(tags.includes("wide_numeric_domain"));
  });

  it("should NOT detect wide_numeric_domain when constraints are narrow", () => {
    const tags = detectRiskTags(makeProp({
      assertion: "fn(x) >= 0",
      generators: { x: { type: "float", constraints: { min: 0, max: 100 } } },
    }));
    assert.ok(!tags.includes("wide_numeric_domain"));
  });

  it("should detect wide_numeric_domain for unconstrained array elements", () => {
    const tags = detectRiskTags(makeProp({
      assertion: "fn(arr) >= 0",
      generators: { arr: { type: "array", constraints: { element: "float" } } },
    }));
    assert.ok(tags.includes("wide_numeric_domain"));
  });

  it("should detect missing_precondition for boundary >= 0 without precondition", () => {
    const tags = detectRiskTags(makeProp({
      category: "boundary",
      assertion: "calculateTotal(prices) >= 0",
    }));
    assert.ok(tags.includes("missing_precondition"));
  });

  it("should NOT detect missing_precondition when assume() is present", () => {
    const tags = detectRiskTags(makeProp({
      category: "boundary",
      assertion: "assume(price >= 0) && calculateTotal(prices) >= 0",
    }));
    assert.ok(!tags.includes("missing_precondition"));
  });

  it("should detect metamorphic_scale_risk for metamorphic + float without tolerance", () => {
    const tags = detectRiskTags(makeProp({
      category: "metamorphic",
      assertion: "scale(x, 2) > scale(x, 1)",
      generators: { x: { type: "float" } },
    }));
    assert.ok(tags.includes("metamorphic_scale_risk"));
  });

  it("should NOT detect metamorphic_scale_risk when approx is present", () => {
    const tags = detectRiskTags(makeProp({
      category: "metamorphic",
      assertion: "approxEqual(scale(x, 2), 2 * scale(x, 1))",
      generators: { x: { type: "float" } },
    }));
    assert.ok(!tags.includes("metamorphic_scale_risk"));
  });
});

describe("computeRiskScore — edge cases", () => {
  it("should not go below 0", () => {
    const risk = computeRiskScore(
      makeProp(),
      5,
      ["float_exact_equality", "roundtrip_numeric_fragility", "wide_numeric_domain"],
    );
    assert.ok(risk >= 0, `Risk score should be >= 0, got ${risk}`);
  });

  it("should return score unchanged when no risk tags", () => {
    const risk = computeRiskScore(makeProp(), 13, []);
    assert.equal(risk, 13);
  });
});

describe("isRedundant — edge cases", () => {
  it("should normalize whitespace for comparison", () => {
    const p1 = makeProp({ assertion: "add(a,  b)  ===  add(b,  a)" });
    const p2 = makeProp({ assertion: "add(a, b) === add(b, a)" });
    assert.equal(isRedundant(p2, [p1]), true);
  });

  it("should not treat different assertions as redundant", () => {
    const p1 = makeProp({ assertion: "add(a, b) >= 0" });
    const p2 = makeProp({ assertion: "add(a, b) === add(b, a)" });
    assert.equal(isRedundant(p2, [p1]), false);
  });

  it("should handle empty existing list", () => {
    assert.equal(isRedundant(makeProp(), []), false);
  });
});

describe("scoreAndFilter — edge cases", () => {
  it("should remove tautologies", () => {
    const props = [
      makeProp({ assertion: "true", confidence: 0.1, evidence: "" }),
      makeProp({ id: "prop_002", assertion: "add(a, b) >= 0" }),
    ];
    const filtered = scoreAndFilter(props, 10);
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].id, "prop_002");
  });

  it("should remove duplicates", () => {
    const props = [
      makeProp({ id: "prop_001", assertion: "add(a, b) >= 0" }),
      makeProp({ id: "prop_002", assertion: "add(a, b) >= 0" }),
    ];
    const filtered = scoreAndFilter(props, 0);
    assert.equal(filtered.length, 1);
  });

  it("should return empty for empty input", () => {
    assert.equal(scoreAndFilter([], 10).length, 0);
  });

  it("should filter by minScore", () => {
    const props = [
      makeProp({ assertion: "add(a, b) >= 0" }),
    ];
    // With minScore=100, nothing should pass
    const filtered = scoreAndFilter(props, 100);
    assert.equal(filtered.length, 0);
  });
});
