"use strict";
/**
 * Shopping cart — deliberately buggy for testing propcheck.
 *
 * Bug 1: applyDiscount doesn't clamp discount to 0-100
 * Bug 2: calculateTotal doesn't handle empty array (returns NaN with reduce on empty)
 * Bug 3: formatPrice loses precision with floating point
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyDiscount = applyDiscount;
exports.calculateTotal = calculateTotal;
exports.formatPrice = formatPrice;
/**
 * Apply a percentage discount to a price.
 * @param price - Original price (non-negative)
 * @param discount - Discount percentage (0-100)
 * @returns Discounted price
 */
function applyDiscount(price, discount) {
    // BUG: no validation on discount range — discount > 100 gives negative price
    return price * (1 - discount / 100);
}
/**
 * Calculate total from an array of prices.
 * @param prices - Array of item prices
 * @returns Total sum
 */
function calculateTotal(prices) {
    // Works fine for non-empty arrays
    return prices.reduce((sum, p) => sum + p, 0);
}
/**
 * Format a price as a string with 2 decimal places.
 * @param price - Price to format
 * @returns Formatted string like "99.99"
 */
function formatPrice(price) {
    // BUG: floating point — formatPrice(0.1 + 0.2) !== "0.30"
    return price.toFixed(2);
}
