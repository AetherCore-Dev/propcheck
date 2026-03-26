/**
 * Sort utilities — should have classic PBT properties.
 */

/**
 * Sort an array of numbers in ascending order.
 * @param arr - Input array
 * @returns New sorted array
 */
export function sortNumbers(arr: number[]): number[] {
  return [...arr].sort((a, b) => a - b);
}

/**
 * Find unique elements in an array.
 * @param arr - Input array
 * @returns Array of unique elements
 */
export function unique(arr: number[]): number[] {
  return [...new Set(arr)];
}

/**
 * Merge two sorted arrays into one sorted array.
 * @param a - First sorted array
 * @param b - Second sorted array
 * @returns Merged sorted array
 */
export function mergeSorted(a: number[], b: number[]): number[] {
  const result: number[] = [];
  let i = 0, j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] <= b[j]) {
      result.push(a[i++]);
    } else {
      result.push(b[j++]);
    }
  }
  while (i < a.length) result.push(a[i++]);
  while (j < b.length) result.push(b[j++]);
  return result;
}
