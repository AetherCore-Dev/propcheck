/**
 * propcheck init — create .propcheck/ directory.
 */

import * as path from "node:path";
import { initStore } from "@propcheck/store";

export async function initCommand(): Promise<void> {
  const projectRoot = process.cwd();

  try {
    const result = await initStore(projectRoot);

    if (result.created) {
      console.log(`\n  Created ${path.relative(projectRoot, result.path)}/`);
      console.log("  Directory structure:");
      console.log("    .propcheck/");
      console.log("    .propcheck/properties.json");
      console.log("    .propcheck/tests/");
      console.log("    .propcheck/corpus/");
      console.log("    .propcheck/reports/");
      console.log("\n  Next steps:");
      console.log("    1. Add .propcheck/config.json to .gitignore");
      console.log("    2. Run: propcheck infer src/yourfile.ts");
      console.log("");
    } else {
      console.log("\n  .propcheck/ already exists — validated structure.");
      console.log("");
    }
  } catch (err) {
    console.error(`\n  Error initializing: ${(err as Error).message}\n`);
    process.exit(2);
  }
}
