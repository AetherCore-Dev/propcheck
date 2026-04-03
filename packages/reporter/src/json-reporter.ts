/**
 * JSON Reporter — machine-readable output for CI.
 */

import type { ExecutionResult } from "@propcheck/common";

export interface JsonReport {
  readonly version: string;
  readonly timestamp: string;
  readonly filePath: string | null;
  readonly passed: readonly { propertyId: string; iterations: number; duration: number }[];
  readonly failed: readonly { propertyId: string; counterexample: unknown; errorMessage: string; seed: number }[];
  readonly errors: readonly { propertyId: string; errorMessage: string }[];
  readonly skipped: readonly { propertyId: string; reason: string; propertyStatus: string }[];
  readonly summary: {
    readonly total: number;
    readonly passed: number;
    readonly failed: number;
    readonly errors: number;
    readonly skipped: number;
    readonly duration: number;
  };
}

export function reportAsJson(result: ExecutionResult, filePath?: string): string {
  const report: JsonReport = {
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    filePath: filePath ?? null,
    passed: result.passed.map((p) => ({
      propertyId: p.propertyId,
      iterations: p.iterations,
      duration: p.duration,
    })),
    failed: result.failed.map((f) => ({
      propertyId: f.propertyId,
      counterexample: f.counterexample,
      errorMessage: f.errorMessage,
      seed: f.seed,
    })),
    errors: result.errors.map((e) => ({
      propertyId: e.propertyId,
      errorMessage: e.errorMessage,
    })),
    skipped: result.skipped.map((s) => ({
      propertyId: s.propertyId,
      reason: s.reason,
      propertyStatus: s.propertyStatus,
    })),
    summary: {
      total: result.passed.length + result.failed.length + result.errors.length,
      passed: result.passed.length,
      failed: result.failed.length,
      errors: result.errors.length,
      skipped: result.skipped.length,
      duration: result.duration,
    },
  };

  return JSON.stringify(report, null, 2);
}
