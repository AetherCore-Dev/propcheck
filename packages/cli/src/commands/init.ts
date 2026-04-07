/**
 * propcheck init — create .propcheck/ directory and configure project.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { initStore } from "@propcheck/store";

const GITIGNORE_ENTRIES = [
  "# propcheck — generated tests and runtime artifacts",
  ".propcheck/tests/",
  ".propcheck/corpus/",
  ".propcheck/reports/",
];

const GITIGNORE_MARKER = ".propcheck/tests/";

/**
 * Ensure .gitignore includes propcheck entries.
 * Returns true if .gitignore was created or modified.
 */
function ensureGitignore(projectRoot: string): boolean {
  const gitignorePath = path.join(projectRoot, ".gitignore");

  let existing = "";
  try {
    existing = fs.readFileSync(gitignorePath, "utf-8");
  } catch {
    // No .gitignore yet — will create one
  }

  // Already configured?
  if (existing.includes(GITIGNORE_MARKER)) {
    return false;
  }

  const block = "\n" + GITIGNORE_ENTRIES.join("\n") + "\n";
  const updated = existing.length > 0
    ? existing.trimEnd() + "\n" + block
    : block.trimStart();

  fs.writeFileSync(gitignorePath, updated, "utf-8");
  return true;
}

export async function initCommand(): Promise<void> {
  const projectRoot = process.cwd();

  try {
    const result = await initStore(projectRoot);

    if (result.created) {
      console.log(`\n  Created ${path.relative(projectRoot, result.path)}/`);
      console.log("  Directory structure:");
      console.log("    .propcheck/properties.json    — discovered rules (commit to git)");
      console.log("    .propcheck/tests/             — generated test files (gitignored)");
      console.log("    .propcheck/corpus/            — test seed corpus (gitignored)");
      console.log("    .propcheck/reports/           — test reports (gitignored)");
    } else {
      console.log("\n  .propcheck/ already exists — validated structure.");
    }

    // Auto-configure .gitignore
    const gitignoreUpdated = ensureGitignore(projectRoot);
    if (gitignoreUpdated) {
      console.log("  Updated .gitignore (added propcheck entries)");
    }

    // Clear, actionable next steps
    console.log("\n  Next steps:");
    console.log("    propcheck infer --mock src/yourfile.ts   # Try with demo AI (free, instant)");
    console.log("    propcheck infer src/yourfile.ts          # Use real AI (needs API key)");
    console.log("    propcheck run src/yourfile.ts            # Run discovered tests");
    console.log("");
  } catch (err) {
    console.error(`\n  Error initializing: ${(err as Error).message}\n`);
    process.exit(2);
  }
}
