/**
 * Node.js version compatibility helpers.
 */

/**
 * Returns true if the current Node.js version supports `--experimental-strip-types`.
 * This flag was added in Node 22.6.0.
 */
export function supportsStripTypes(): boolean {
  const [major, minor] = process.versions.node.split(".").map(Number);
  return major > 22 || (major === 22 && minor >= 6);
}
