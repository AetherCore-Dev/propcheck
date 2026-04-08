const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { applyDiscount } = require("./discount");

describe("applyDiscount", () => {
  it("10% off $100 = $90", () => {
    assert.equal(applyDiscount(100, 10), 90);
  });
  it("50% off $200 = $100", () => {
    assert.equal(applyDiscount(200, 50), 100);
  });
  it("0% off = original price", () => {
    assert.equal(applyDiscount(42, 0), 42);
  });
});
