/**
 * Sort utilities — should pass all property tests.
 */

export function bubbleSort(arr: number[]): number[] {
  const result = [...arr];
  for (let i = 0; i < result.length; i++) {
    for (let j = 0; j < result.length - i - 1; j++) {
      if (result[j] > result[j + 1]) {
        [result[j], result[j + 1]] = [result[j + 1], result[j]];
      }
    }
  }
  return result;
}

export function unique(arr: number[]): number[] {
  return [...new Set(arr)];
}

export function reverseArray<T>(arr: T[]): T[] {
  return [...arr].reverse();
}
