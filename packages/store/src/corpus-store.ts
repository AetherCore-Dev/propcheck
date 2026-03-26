/**
 * Corpus store — manage .propcheck/corpus/ for seed input caching.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { SeedInput } from "@propcheck/common";

const CORPUS_DIR = "corpus";

function corpusPath(storeDir: string, functionName: string): string {
  const safeName = functionName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return path.join(storeDir, CORPUS_DIR, `${safeName}.json`);
}

/** Get cached seed inputs for a function. */
export async function getSeeds(
  storeDir: string,
  functionName: string,
): Promise<readonly SeedInput[]> {
  const filePath = corpusPath(storeDir, functionName);
  try {
    const content = await fs.readFile(filePath, "utf8");
    return JSON.parse(content) as SeedInput[];
  } catch {
    return [];
  }
}

/** Append new seed inputs for a function (deduplicates). */
export async function addSeeds(
  storeDir: string,
  functionName: string,
  seeds: readonly SeedInput[],
): Promise<void> {
  const existing = await getSeeds(storeDir, functionName);
  const existingKeys = new Set(
    existing.map((s) => JSON.stringify(s.value)),
  );
  const newSeeds = seeds.filter(
    (s) => !existingKeys.has(JSON.stringify(s.value)),
  );
  const merged = [...existing, ...newSeeds];

  const dir = path.join(storeDir, CORPUS_DIR);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(
    corpusPath(storeDir, functionName),
    JSON.stringify(merged, null, 2),
    "utf8",
  );
}
