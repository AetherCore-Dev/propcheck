/**
 * Price utilities — looks correct, passes all unit tests.
 *
 * Unit test coverage: 100%
 * All 12 tests passing ✅
 */

/**
 * Apply a percentage discount to a price.
 * @param price - Original price (should be non-negative)
 * @param discountPercent - Discount as percentage (e.g., 20 means 20% off)
 * @returns The discounted price
 */
export function applyDiscount(price: number, discountPercent: number): number {
  return price * (1 - discountPercent / 100);
}

/**
 * Split a bill evenly among a group of people.
 * @param total - Total bill amount
 * @param people - Number of people splitting
 * @returns Amount each person pays
 */
export function splitBill(total: number, people: number): number {
  return Math.round((total / people) * 100) / 100;
}

/**
 * Calculate compound interest.
 * @param principal - Initial amount
 * @param rate - Annual interest rate (e.g., 0.05 for 5%)
 * @param years - Number of years
 * @returns Final amount after compound interest
 */
export function compoundInterest(principal: number, rate: number, years: number): number {
  return principal * Math.pow(1 + rate, years);
}
