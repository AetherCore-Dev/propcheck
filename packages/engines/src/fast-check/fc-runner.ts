/**
 * fast-check test runner — spawns Node.js to execute generated test files.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { PropertyDefinition, RunConfig, ExecutionResult } from "@propcheck/common";
import { runProcess } from "../shared/process-runner";
import { parseJsonLines, mapResults } from "../shared/result-parser";

/**
 * Run a generated fast-check test file and parse results.
 *
 * When the generated test needs a .mts copy of the target (CJS+TS projects),
 * this function creates and cleans up the temporary copy.
 */
export async function runFastCheckTest(
  testFilePath: string,
  properties: readonly PropertyDefinition[],
  config: RunConfig,
  options?: { readonly targetFile?: string; readonly needsMtsCopy?: boolean },
): Promise<ExecutionResult> {
  const startTime = Date.now();
  const cwd = path.dirname(testFilePath);
  const isESM = testFilePath.endsWith(".mjs");

  // Create .mts copy if needed (CJS+TS compatibility)
  let mtsPath: string | null = null;
  if (options?.needsMtsCopy && options.targetFile) {
    mtsPath = options.targetFile.replace(/\.ts$/, ".mts").replace(/\.tsx$/, ".mtsx");
    fs.copyFileSync(options.targetFile, mtsPath);
  }

  try {
    const nodeArgs = [
      "--experimental-strip-types",
      "--no-warnings",
      testFilePath,
    ];

    const result = await runProcess(
      "node",
      nodeArgs,
      {
        cwd,
        timeout: config.timeout * Math.max(properties.length, 1),
        env: {
          NODE_PATH: [
            path.join(cwd, "node_modules"),
            path.join(cwd, "..", "..", "node_modules"),
            path.join(cwd, "..", "..", "..", "node_modules"),
            process.env["NODE_PATH"] ?? "",
          ].join(path.delimiter),
        },
      },
    );

    const rawResults = parseJsonLines(result.stdout);
    return mapResults(rawResults, properties, config, Date.now() - startTime, result.stderr, "Test execution error");
  } finally {
    // Clean up .mts copy
    if (mtsPath) {
      try {
        fs.unlinkSync(mtsPath);
      } catch (e) {
        if (e instanceof Error && (e as NodeJS.ErrnoException).code !== "ENOENT") {
          console.warn(`  Warning: Failed to clean up ${mtsPath}: ${(e as Error).message}`);
        }
      }
    }
  }
}
