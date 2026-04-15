/**
 * propcheck badge — output markdown badge snippet.
 */

import * as path from "node:path";
import { loadConfig } from "@propcheck/config";
import { getAllProperties } from "@propcheck/store";

export async function badgeCommand(): Promise<void> {
  const projectRoot = process.cwd();
  const config = loadConfig(projectRoot);
  const storeDir = path.join(projectRoot, config.storeDir);

  const allProps = await getAllProperties(storeDir);
  const totalProperties = allProps.reduce(
    (sum, ps) => sum + ps.properties.filter((property) => property.status !== "quarantined" && property.status !== "dropped").length,
    0,
  );

  if (totalProperties === 0) {
    console.error("\n  No properties found. Run: propcheck infer <file> first.\n");
    process.exit(2);
  }

  const encoded = encodeURIComponent(`${totalProperties} properties verified`);
  const badge = `[![propcheck](https://img.shields.io/badge/propcheck-${encoded}-brightgreen)](https://github.com/propcheck/propcheck)`;

  console.log("\n  Add this badge to your README.md:\n");
  console.log(`  ${badge}`);
  console.log("");
}
