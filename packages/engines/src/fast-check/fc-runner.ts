/**
 * fast-check test runner — spawns Node.js to execute generated test files.
 */

import * as path from "node:path";
import type { PropertyDefinition, RunConfig, ExecutionResult } from "@propcheck/common";
import { runProcess } from "../shared/process-runner";
import { parseJsonLines, mapResults } from "../shared/result-parser";

/**
 * Run a generated fast-check test file and parse results.
 */
export async function runFastCheckTest(
  testFilePath: string,
  properties: readonly PropertyDefinition[],
  config: RunConfig,
): Promise<ExecutionResult> {
  const startTime = Date.now();
  const cwd = path.dirname(testFilePath);

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
}
