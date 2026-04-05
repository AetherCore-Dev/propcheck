/**
 * File scanner — recursively find source files in a directory.
 */

import * as fs from "node:fs";
import * as path from "node:path";

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".py"]);

const IGNORED_DIRS = new Set([
  "node_modules", ".propcheck", "dist", "dist-bundle", "build",
  ".git", ".next", ".nuxt", "__pycache__", ".venv", "venv",
  "coverage", ".turbo", ".cache",
]);

/**
 * Recursively find all source files in a directory.
 * Returns relative paths from the given root.
 */
export function findSourceFiles(dir: string): readonly string[] {
  const results: string[] = [];

  function walk(currentDir: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return; // Skip unreadable directories
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name) && !entry.name.startsWith(".")) {
          walk(path.join(currentDir, entry.name));
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (SOURCE_EXTENSIONS.has(ext) && !entry.name.endsWith(".d.ts") && !entry.name.endsWith(".test.ts") && !entry.name.endsWith(".spec.ts") && !entry.name.endsWith(".test.js") && !entry.name.endsWith(".spec.js")) {
          results.push(path.join(currentDir, entry.name));
        }
      }
    }
  }

  walk(dir);
  return results;
}
