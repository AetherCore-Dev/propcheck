/**
 * Test file store — manage .propcheck/tests/ directory.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";

const TESTS_DIR = "tests";

function testsPath(storeDir: string): string {
  return path.join(storeDir, TESTS_DIR);
}

/** Write a generated test file to .propcheck/tests/ */
export async function writeTestFile(
  storeDir: string,
  fileName: string,
  content: string,
): Promise<string> {
  const dir = testsPath(storeDir);
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, fileName);
  await fs.writeFile(filePath, content, "utf8");
  return filePath;
}

/** Read a generated test file. */
export async function readTestFile(
  storeDir: string,
  fileName: string,
): Promise<string> {
  const filePath = path.join(testsPath(storeDir), fileName);
  return fs.readFile(filePath, "utf8");
}

/** List all generated test files. */
export async function listTestFiles(
  storeDir: string,
): Promise<readonly string[]> {
  const dir = testsPath(storeDir);
  try {
    const entries = await fs.readdir(dir);
    return entries.filter(
      (e) => e.endsWith(".ts") || e.endsWith(".js") || e.endsWith(".py"),
    );
  } catch {
    return [];
  }
}
