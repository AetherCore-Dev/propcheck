/**
 * Cross-platform path utilities.
 *
 * Windows uses backslashes in paths, but JavaScript import statements
 * and most tools expect forward slashes. These utilities ensure consistent
 * path handling across platforms.
 */

import * as path from "node:path";

/** Normalize a path to use forward slashes (for imports and display). */
export function toForwardSlash(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

/** Resolve a path and normalize to forward slashes. */
export function resolveForward(...segments: string[]): string {
  return toForwardSlash(path.resolve(...segments));
}

/** Get relative path with forward slashes. */
export function relativeForward(from: string, to: string): string {
  const rel = path.relative(from, to);
  return toForwardSlash(rel);
}

/**
 * Compute a relative import path from one file to another.
 * Always uses forward slashes and adds ./ prefix if needed.
 */
export function importPath(fromFile: string, toFile: string): string {
  const fromDir = path.dirname(fromFile);
  let rel = relativeForward(fromDir, toFile);

  // Remove file extension for JS/TS imports
  rel = rel.replace(/\.(ts|tsx|js|jsx|mts|mjs)$/, "");

  // Ensure relative path starts with ./
  if (!rel.startsWith(".")) {
    rel = "./" + rel;
  }

  return rel;
}
