/**
 * fast-check test runner — spawns Node.js to execute generated test files.
 *
 * Parses JSON output lines for pass/fail/counterexample results.
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
 * Run a generated fast-check test file and parse results.
 */
export async function runFastCheckTest(
  testFilePath: string,
  properties: readonly PropertyDefinition[],
  config: RunConfig,
): Promise<ExecutionResult> {
  const startTime = Date.now();

  // Run from the directory containing the test file
  // Set NODE_PATH to help find fast-check if not in local node_modules
  // Use --experimental-strip-types to support importing .ts source files directly
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

  const passed: PropertyResult[] = [];
  const failed: PropertyFailure[] = [];
  const errors: PropertyError[] = [];

  // Map results to property IDs
  const resultMap = new Map(rawResults.map((r) => [r.propertyId, r]));

  for (const prop of properties) {
    const raw = resultMap.get(prop.id);

    if (!raw) {
      // Property didn't produce output — error
      errors.push({
        propertyId: prop.id,
        status: "error",
        errorMessage: result.stderr
          ? `Test execution error: ${result.stderr.slice(0, 200)}`
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

  const duration = Date.now() - startTime;

  return {
    passed,
    failed,
    errors,
    duration,
    totalIterations: passed.reduce((sum, p) => sum + p.iterations, 0),
    properties,
  };
}
