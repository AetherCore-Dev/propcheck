"use strict";
/**
 * Shopping cart utilities — intentionally buggy for propcheck demo.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyDiscount = applyDiscount;
exports.calculateTotal = calculateTotal;
/**
 * Apply a discount percentage to a price.
 * @param price - Original price (should be >= 0)
 * @param discount - Discount percentage (0-100)
 * @returns Discounted price
 */
function applyDiscount(price, discount) {
    // BUG: doesn't clamp discount to 0-100 range
    return price * (1 - discount / 100);
}
/**
 * Calculate total price for items.
 * @param prices - Array of item prices
 * @returns Sum of all prices
 */
function calculateTotal(prices) {
    return prices.reduce(function (sum, p) { return sum + p; }, 0);
}
