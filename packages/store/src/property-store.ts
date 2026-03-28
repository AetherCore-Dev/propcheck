/**
 * Property store — CRUD for .propcheck/properties.json
 *
 * File format:
 * {
 *   "version": 1,
 *   "modules": {
 *     "src/cart.ts": PropertySet,
 *     "src/auth.ts": PropertySet
 *   }
 * }
 *
 * All writes are atomic (temp file → rename) to prevent corruption.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as crypto from "node:crypto";
import type { PropertySet } from "@propcheck/common";

/** On-disk format of properties.json */
interface PropertiesFile {
  readonly version: number;
  readonly modules: Readonly<Record<string, PropertySet>>;
}

const PROPERTIES_FILE = "properties.json";
const FILE_VERSION = 1;

function propertiesPath(storeDir: string): string {
  return path.join(storeDir, PROPERTIES_FILE);
}

async function readPropertiesFile(storeDir: string): Promise<PropertiesFile> {
  const filePath = propertiesPath(storeDir);
  try {
    const content = await fs.readFile(filePath, "utf8");
    return JSON.parse(content) as PropertiesFile;
  } catch (err: unknown) {
    // Only return empty state for missing file; re-throw for corruption/permission errors
    if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
      return { version: FILE_VERSION, modules: {} };
    }
    // JSON parse errors or permission errors should surface
    throw new Error(`Failed to read properties file at ${filePath}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function writePropertiesFile(
  storeDir: string,
  data: PropertiesFile,
): Promise<void> {
  const filePath = propertiesPath(storeDir);
  const tmpName = `.tmp-${crypto.randomBytes(8).toString("hex")}.json`;
  const tmpPath = path.join(storeDir, tmpName);

  const content = JSON.stringify(data, null, 2);
  await fs.writeFile(tmpPath, content, "utf8");
  await fs.rename(tmpPath, filePath);
}

/** Get properties for a single module. */
export async function getProperties(
  storeDir: string,
  module: string,
): Promise<PropertySet | null> {
  const file = await readPropertiesFile(storeDir);
  return file.modules[module] ?? null;
}

/** Get all property sets across the project. */
export async function getAllProperties(
  storeDir: string,
): Promise<readonly PropertySet[]> {
  const file = await readPropertiesFile(storeDir);
  return Object.values(file.modules);
}

/** Write properties for a module (immutable replace). */
export async function setProperties(
  storeDir: string,
  module: string,
  propertySet: PropertySet,
): Promise<void> {
  const file = await readPropertiesFile(storeDir);
  const updated: PropertiesFile = {
    ...file,
    modules: { ...file.modules, [module]: propertySet },
  };
  await writePropertiesFile(storeDir, updated);
}

/** Check if a property set is stale (source has changed). */
export function isStale(
  propertySet: PropertySet,
  currentHash: string,
): boolean {
  return propertySet.sourceHash !== currentHash;
}

/** Remove properties for a module. */
export async function removeProperties(
  storeDir: string,
  module: string,
): Promise<void> {
  const file = await readPropertiesFile(storeDir);
  const { [module]: _removed, ...remaining } = file.modules;
  const updated: PropertiesFile = {
    ...file,
    modules: remaining,
  };
  await writePropertiesFile(storeDir, updated);
}
