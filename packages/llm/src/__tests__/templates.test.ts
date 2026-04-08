/**
 * Tests for community property templates.
 */

import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import { matchTemplates, getAvailableDomains, getTemplateStats } from "../templates";
import type { FunctionSignature } from "@propcheck/common";

function makeSig(overrides: Partial<FunctionSignature> = {}): FunctionSignature {
  return {
    name: "testFn",
    qualifiedName: "testFn",
    parameters: [{ name: "x", type: "number", isOptional: false, isRest: false, defaultValue: null }],
    returnType: "number",
    docstring: null,
    visibility: "public",
    isAsync: false,
    isGenerator: false,
    loc: { startLine: 0, endLine: 0, startColumn: 0, endColumn: 0 },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Domain matching
// ---------------------------------------------------------------------------

describe("matchTemplates", () => {
  it("matches sorting functions", () => {
    const sig = makeSig({ name: "sortItems", returnType: "number[]", parameters: [{ name: "arr", type: "number[]", isOptional: false, isRest: false, defaultValue: null }] });
    const props = matchTemplates(sig);
    assert.ok(props.length >= 2, `Expected >= 2 props, got ${props.length}`);
    assert.ok(props.some((p) => p.category === "conservation"));
    assert.ok(props.some((p) => p.category === "idempotent"));
    // Assertions should reference actual function name
    assert.ok(props.every((p) => p.assertion.includes("sortItems")));
  });

  it("matches formatting functions", () => {
    const sig = makeSig({ name: "formatCurrency", returnType: "string", parameters: [{ name: "amount", type: "number", isOptional: false, isRest: false, defaultValue: null }] });
    const props = matchTemplates(sig);
    assert.ok(props.length >= 1);
    assert.ok(props.some((p) => p.assertion.includes("formatCurrency")));
    assert.ok(props.some((p) => p.assertion.includes("amount")));
  });

  it("matches validator functions (isXxx)", () => {
    const sig = makeSig({ name: "isValidEmail", returnType: "boolean", parameters: [{ name: "email", type: "string", isOptional: false, isRest: false, defaultValue: null }] });
    const props = matchTemplates(sig);
    assert.ok(props.length >= 1);
    assert.ok(props.some((p) => p.category === "type-preservation"));
    assert.ok(props.some((p) => p.assertion.includes("isValidEmail")));
  });

  it("matches filter functions", () => {
    const sig = makeSig({ name: "filterPositive", returnType: "number[]", parameters: [{ name: "nums", type: "number[]", isOptional: false, isRest: false, defaultValue: null }] });
    const props = matchTemplates(sig);
    assert.ok(props.length >= 1);
    assert.ok(props.some((p) => p.category === "conservation"));
  });

  it("matches clamp functions with 3 params", () => {
    const sig = makeSig({
      name: "clamp",
      returnType: "number",
      parameters: [
        { name: "value", type: "number", isOptional: false, isRest: false, defaultValue: null },
        { name: "min", type: "number", isOptional: false, isRest: false, defaultValue: null },
        { name: "max", type: "number", isOptional: false, isRest: false, defaultValue: null },
      ],
    });
    const props = matchTemplates(sig);
    assert.ok(props.length >= 1);
    assert.ok(props.some((p) => p.assertion.includes("clamp")));
    assert.ok(props.some((p) => p.assertion.includes("value")));
    assert.ok(props.some((p) => p.assertion.includes("min")));
  });

  it("matches math/calculation functions", () => {
    const sig = makeSig({ name: "calculateTax", returnType: "number", parameters: [{ name: "price", type: "number", isOptional: false, isRest: false, defaultValue: null }] });
    const props = matchTemplates(sig);
    assert.ok(props.length >= 1);
    assert.ok(props.some((p) => p.category === "boundary"));
  });

  it("matches string-transform functions", () => {
    const sig = makeSig({ name: "trimWhitespace", returnType: "string", parameters: [{ name: "input", type: "string", isOptional: false, isRest: false, defaultValue: null }] });
    const props = matchTemplates(sig);
    assert.ok(props.length >= 1);
    assert.ok(props.some((p) => p.category === "conservation" || p.category === "idempotent"));
  });

  it("matches deduplicate functions", () => {
    const sig = makeSig({ name: "unique", returnType: "number[]", parameters: [{ name: "arr", type: "number[]", isOptional: false, isRest: false, defaultValue: null }] });
    const props = matchTemplates(sig);
    assert.ok(props.length >= 1);
    assert.ok(props.some((p) => p.assertion.includes("Set")));
  });

  it("returns empty for unmatched functions", () => {
    const sig = makeSig({ name: "fooBarBaz", returnType: "void" });
    const props = matchTemplates(sig);
    assert.equal(props.length, 0);
  });

  it("limits to 5 properties max", () => {
    const sig = makeSig({ name: "sortAndFilter", returnType: "number[]", parameters: [{ name: "arr", type: "number[]", isOptional: false, isRest: false, defaultValue: null }] });
    const props = matchTemplates(sig);
    assert.ok(props.length <= 5);
  });

  it("skips templates requiring more params than available", () => {
    // clamp needs 3 params, but signature only has 1
    const sig = makeSig({
      name: "clamp",
      returnType: "number",
      parameters: [{ name: "value", type: "number", isOptional: false, isRest: false, defaultValue: null }],
    });
    const props = matchTemplates(sig);
    // Should skip the clamp templates that need p1 and p2
    for (const p of props) {
      assert.ok(!p.assertion.includes("{p1}"), "Should not have unresolved placeholders");
    }
  });

  it("instantiates generator keys with actual param names", () => {
    const sig = makeSig({ name: "formatPrice", returnType: "string", parameters: [{ name: "amount", type: "number", isOptional: false, isRest: false, defaultValue: null }] });
    const props = matchTemplates(sig);
    for (const p of props) {
      const keys = Object.keys(p.generators);
      assert.ok(keys.every((k) => !k.includes("{")), `Generator key should be resolved: ${keys.join(", ")}`);
    }
  });

  it("instantiates seed input keys with actual param names", () => {
    const sig = makeSig({ name: "sortItems", returnType: "number[]", parameters: [{ name: "items", type: "number[]", isOptional: false, isRest: false, defaultValue: null }] });
    const props = matchTemplates(sig);
    for (const p of props) {
      for (const seed of p.seedInputs) {
        if (typeof seed.value === "object" && seed.value !== null) {
          const keys = Object.keys(seed.value as Record<string, unknown>);
          assert.ok(keys.every((k) => !k.includes("{")), `Seed key should be resolved: ${keys.join(", ")}`);
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Utility exports
// ---------------------------------------------------------------------------

describe("getAvailableDomains", () => {
  it("returns non-empty domain list", () => {
    const domains = getAvailableDomains();
    assert.ok(domains.length >= 5);
    assert.ok(domains.includes("sorting"));
    assert.ok(domains.includes("formatting"));
    assert.ok(domains.includes("validation"));
  });
});

describe("getTemplateStats", () => {
  it("returns stats for each domain", () => {
    const stats = getTemplateStats();
    assert.ok(stats.length >= 5);
    for (const s of stats) {
      assert.ok(s.domain.length > 0);
      assert.ok(s.templates > 0);
      assert.ok(s.patterns.length > 0);
    }
  });
});
