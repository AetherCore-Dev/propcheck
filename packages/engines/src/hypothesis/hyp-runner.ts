/**
 * Hypothesis test runner — spawns Python to execute generated test files.
 */

import * as path from "node:path";
import type { PropertyDefinition, RunConfig, ExecutionResult } from "@propcheck/common";
import { runProcess } from "../shared/process-runner";
import { parseJsonLines, mapResults } from "../shared/result-parser";

/**
 * Detect available Python command (cached after first successful lookup).
 */
let _cachedPythonCmd: string | null = null;

async function findPython(): Promise<string> {
  if (_cachedPythonCmd !== null) return _cachedPythonCmd;
  for (const cmd of ["python", "python3"]) {
    try {
      const result = await runProcess(cmd, ["--version"], { timeout: 5000 });
      if (result.exitCode === 0) {
        _cachedPythonCmd = cmd;
        return cmd;
      }
    } catch {
      // Try next
    }
  }
  throw new Error("Python not found. Install Python 3.8+ to use Hypothesis engine.");
}

/**
 * Run a generated Hypothesis test file and parse results.
 */
export async function runHypothesisTest(
  testFilePath: string,
  properties: readonly PropertyDefinition[],
  config: RunConfig,
): Promise<ExecutionResult> {
  const startTime = Date.now();
  const python = await findPython();

  const result = await runProcess(
    python,
    [testFilePath],
    {
      cwd: path.dirname(testFilePath),
      timeout: config.timeout * Math.max(properties.length, 1),
    },
  );

  const rawResults = parseJsonLines(result.stdout);
  return mapResults(rawResults, properties, config, Date.now() - startTime, result.stderr, "Python error");
}
