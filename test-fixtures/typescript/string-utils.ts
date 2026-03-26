/**
 * String utilities with edge cases.
 */

/**
 * Reverse a string.
 * @param str - Input string
 * @returns Reversed string
 */
export function reverseString(str: string): string {
  return str.split("").reverse().join("");
}

/**
 * Truncate a string to a maximum length, adding "..." if truncated.
 * @param str - Input string
 * @param maxLen - Maximum length (must be >= 3)
 * @returns Truncated string
 */
export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + "...";
}

/**
 * Check if a string is a palindrome (case-insensitive).
 * @param str - Input string
 * @returns true if palindrome
 */
export function isPalindrome(str: string): boolean {
  const cleaned = str.toLowerCase().replace(/[^a-z0-9]/g, "");
  return cleaned === cleaned.split("").reverse().join("");
}
