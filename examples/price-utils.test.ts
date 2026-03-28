/**
 * Unit tests for price-utils — 12 tests, 100% line coverage.
 *
 * Run: node --experimental-strip-types --test examples/price-utils.test.ts
 * Coverage: npx c8 node --experimental-strip-types --test examples/price-utils.test.ts
 */

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { applyDiscount, calculateTotal, formatPrice } from "./price-utils.ts";

describe("applyDiscount", () => {
  it("applies 20% discount correctly", () => {
    assert.equal(applyDiscount(100, 20), 80);
  });
  it("applies 50% discount correctly", () => {
    assert.equal(applyDiscount(200, 50), 100);
  });
  it("zero discount returns original price", () => {
    assert.equal(applyDiscount(49.99, 0), 49.99);
  });
  it("100% discount returns zero", () => {
    assert.equal(applyDiscount(100, 100), 0);
  });
});

describe("calculateTotal", () => {
  it("sums multiple prices", () => {
    assert.equal(calculateTotal([10, 20, 30]), 60);
  });
  it("handles single item", () => {
    assert.equal(calculateTotal([42.99]), 42.99);
  });
  it("returns 0 for empty cart", () => {
    assert.equal(calculateTotal([]), 0);
  });
  it("handles decimal prices", () => {
    assert.equal(calculateTotal([1.50, 2.50]), 4);
  });
});

describe("formatPrice", () => {
  it("formats whole number", () => {
    assert.equal(formatPrice(42), "42.00");
  });
  it("formats price with cents", () => {
    assert.equal(formatPrice(9.99), "9.99");
  });
  it("rounds to 2 decimal places", () => {
    assert.equal(formatPrice(1.999), "2.00");
  });
  it("formats zero", () => {
    assert.equal(formatPrice(0), "0.00");
  });
});
