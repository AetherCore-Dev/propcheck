/**
 * Initialize the .propcheck/ directory structure.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";

const SUBDIRS = ["tests", "corpus", "reports"];

/** Initialize .propcheck/ directory with required structure. */
export async function initStore(
  projectRoot: string,
  storeDir: string = ".propcheck",
): Promise<{ readonly created: boolean; readonly path: string }> {
  const storePath = path.join(projectRoot, storeDir);

  // Check if already initialized
  try {
    const stat = await fs.stat(storePath);
    if (stat.isDirectory()) {
      // Validate structure — create missing subdirs
      for (const sub of SUBDIRS) {
        await fs.mkdir(path.join(storePath, sub), { recursive: true });
      }
      return { created: false, path: storePath };
    }
  } catch {
    // Directory doesn't exist — create it
  }

  // Create directory structure
  await fs.mkdir(storePath, { recursive: true });
  for (const sub of SUBDIRS) {
    await fs.mkdir(path.join(storePath, sub), { recursive: true });
  }

  // Create empty properties.json
  const propertiesPath = path.join(storePath, "properties.json");
  await fs.writeFile(
    propertiesPath,
    JSON.stringify({ version: 1, modules: {} }, null, 2),
    "utf8",
  );

  return { created: true, path: storePath };
}
