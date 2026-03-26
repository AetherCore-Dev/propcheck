/**
 * Shopping cart utilities — intentionally buggy for propcheck demo.
 */

/**
 * Apply a discount percentage to a price.
 * @param price - Original price (should be >= 0)
 * @param discount - Discount percentage (0-100)
 * @returns Discounted price
 */
export function applyDiscount(price: number, discount: number): number {
  // BUG: doesn't clamp discount to 0-100 range
  return price * (1 - discount / 100);
}

/**
 * Calculate total price for items.
 * @param prices - Array of item prices
 * @returns Sum of all prices
 */
export function calculateTotal(prices: number[]): number {
  return prices.reduce((sum, p) => sum + p, 0);
}
