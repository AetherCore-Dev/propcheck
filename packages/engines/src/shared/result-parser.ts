/**
 * Shared JSON result parser — extracts structured test results from stdout.
 *
 * Used by both fast-check and Hypothesis runners.
 */

import type {
  PropertyResult,
  PropertyFailure,
  PropertyError,
  ExecutionResult,
  PropertyDefinition,
  RunConfig,
} from "@propcheck/common";

export interface RawResult {
  readonly propertyId: string;
  readonly status: string;
  readonly iterations?: number;
  readonly counterexample?: unknown;
  readonly errorMessage?: string;
  readonly shrinkSteps?: number;
}

/**
 * Parse JSON lines from process stdout.
 * Each valid JSON line with { propertyId, status } is extracted.
 */
export function parseJsonLines(stdout: string): readonly RawResult[] {
  const results: RawResult[] = [];
  for (const line of stdout.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{")) continue;
    try {
      const parsed = JSON.parse(trimmed) as RawResult;
      if (parsed.propertyId && (parsed.status === "passed" || parsed.status === "failed")) {
        results.push(parsed);
      }
    } catch {
      // Skip non-JSON lines
    }
  }
  return results;
}

/**
 * Map raw JSON results to typed ExecutionResult.
 */
export function mapResults(
  rawResults: readonly RawResult[],
  properties: readonly PropertyDefinition[],
  config: RunConfig,
  duration: number,
  stderrSnippet: string,
  errorPrefix: string,
): ExecutionResult {
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
        errorMessage: stderrSnippet
          ? `${errorPrefix}: ${stderrSnippet.slice(0, 200)}`
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
    } else if (raw.status === "failed") {
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
    } else {
      errors.push({
        propertyId: prop.id,
        status: "error",
        errorMessage: `Unexpected status in test output: "${String(raw.status)}"`,
        duration: 0,
      });
    }
  }

  return {
    passed,
    failed,
    errors,
    duration,
    totalIterations: passed.reduce((sum, p) => sum + p.iterations, 0),
    properties,
  };
}
