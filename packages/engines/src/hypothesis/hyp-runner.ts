/**
 * Hypothesis test runner — spawns Python to execute generated test files.
 */

import * as path from "node:path";
import type {
  PropertyResult,
  PropertyFailure,
  PropertyError,
  ExecutionResult,
  PropertyDefinition,
  RunConfig,
} from "@propcheck/common";
import { runProcess } from "../shared/process-runner";

interface RawResult {
  propertyId: string;
  status: "passed" | "failed";
  iterations?: number;
  counterexample?: unknown;
  errorMessage?: string;
  shrinkSteps?: number;
}

function parseJsonLines(stdout: string): readonly RawResult[] {
  const results: RawResult[] = [];
  for (const line of stdout.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{")) continue;
    try {
      const parsed = JSON.parse(trimmed) as RawResult;
      if (parsed.propertyId && parsed.status) {
        results.push(parsed);
      }
    } catch {
      // Skip non-JSON lines
    }
  }
  return results;
}

/**
 * Detect available Python command.
 */
async function findPython(): Promise<string> {
  for (const cmd of ["python", "python3"]) {
    try {
      const result = await runProcess(cmd, ["--version"], { timeout: 5000 });
      if (result.exitCode === 0) return cmd;
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
  const passed: PropertyResult[] = [];
  const failed: PropertyFailure[] = [];
  const errors: PropertyError[] = [];
  const resultMap = new Map(rawResults.map((r) => [r.propertyId, r]));

  for (const prop of properties) {
    const raw = resultMap.get(prop.id);

    if (!raw) {
      errors.push({
        propertyId: prop.id,
        status: "error",
        errorMessage: result.stderr
          ? `Python error: ${result.stderr.slice(0, 300)}`
          : "Property produced no output",
        duration: 0,
      });
      continue;
    }

    if (raw.status === "passed") {
      passed.push({
        propertyId: prop.id,
        status: "passed",
        iterations: raw.iterations ?? config.iterations,
        duration: 0,
        seed: config.seed ?? 0,
      });
    } else {
      failed.push({
        propertyId: prop.id,
        status: "failed",
        counterexample: raw.counterexample ?? null,
        shrinkSteps: raw.shrinkSteps ?? 0,
        originalInput: raw.counterexample,
        errorMessage: raw.errorMessage ?? "Property violated",
        seed: config.seed ?? 0,
        duration: 0,
      });
    }
  }

  return {
    passed,
    failed,
    errors,
    duration: Date.now() - startTime,
    totalIterations: passed.reduce((sum, p) => sum + p.iterations, 0),
    properties,
  };
}
