/**
 * JSON Reporter — machine-readable output for CI.
 */

import type {
  ExecutionResult,
  PropertyDefinition,
  PropertyFailure,
  PropertyOutcome,
} from "@propcheck/common";

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

function buildJsonReport(result: ExecutionResult, filePath?: string): JsonReport {
  return {
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
}

function escapeMarkdownCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/[\r\n]+/g, " ");
}

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, Math.max(0, maxLength - 3))}...` : value;
}

function formatInlineValue(value: unknown): string {
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  return JSON.stringify(value);
}

function formatCounterexampleCall(
  property: PropertyDefinition | undefined,
  failure: PropertyFailure,
): string {
  const targetFunction = property?.targetFunction ?? failure.propertyId;
  if (Array.isArray(failure.counterexample)) {
    return `${targetFunction}(${failure.counterexample.map((value) => formatInlineValue(value)).join(", ")})`;
  }
  if (failure.counterexample === null || failure.counterexample === undefined) {
    return `${targetFunction}(...)`;
  }
  return `${targetFunction}(${formatInlineValue(failure.counterexample)})`;
}

function buildOutcomeMap(result: ExecutionResult): ReadonlyMap<string, PropertyOutcome> {
  const outcomeMap = new Map<string, PropertyOutcome>();
  for (const passed of result.passed) {
    outcomeMap.set(passed.propertyId, passed);
  }
  for (const failed of result.failed) {
    outcomeMap.set(failed.propertyId, failed);
  }
  for (const error of result.errors) {
    outcomeMap.set(error.propertyId, error);
  }
  return outcomeMap;
}

function formatMarkdownStatus(outcome: PropertyOutcome | undefined): string {
  switch (outcome?.status) {
    case "passed":
      return "✅ PASS";
    case "failed":
      return "❌ FAIL";
    case "error":
      return "⚠️ ERROR";
    default:
      return "⏭️ SKIP";
  }
}

function formatMarkdownDetails(
  property: PropertyDefinition,
  outcome: PropertyOutcome | undefined,
): string {
  if (!outcome) {
    return "Not executed";
  }

  switch (outcome.status) {
    case "passed":
      return `${outcome.iterations}/${outcome.iterations}`;
    case "failed":
      return `Counterexample: \`${formatCounterexampleCall(property, outcome)}\``;
    case "error":
      return truncate(outcome.errorMessage, 120);
    default:
      return "Not executed";
  }
}

export function reportAsJson(result: ExecutionResult, filePath?: string): string {
  return JSON.stringify(buildJsonReport(result, filePath), null, 2);
}

export function reportAsGitHubComment(result: ExecutionResult, filePath?: string): string {
  const report = buildJsonReport(result, filePath);
  const outcomeMap = buildOutcomeMap(result);
  const propertyMap = new Map(result.properties.map((property) => [property.id, property]));
  const lines: string[] = [];

  lines.push(filePath ? `## propcheck results for \`${filePath}\`` : "## propcheck results");
  lines.push("");
  lines.push(`**Summary:** ${report.summary.total} properties · ${report.summary.passed} passed · ${report.summary.failed} failed · ${report.summary.errors} errors · ${report.summary.skipped} skipped · ${(report.summary.duration / 1000).toFixed(1)}s`);
  lines.push("");

  if (result.properties.length > 0) {
    lines.push("| Property | Status | Details |");
    lines.push("|----------|--------|---------|");
    for (const property of result.properties) {
      const title = escapeMarkdownCell(`${property.targetFunction}: ${property.description}`);
      const outcome = outcomeMap.get(property.id);
      const status = escapeMarkdownCell(formatMarkdownStatus(outcome));
      const details = escapeMarkdownCell(formatMarkdownDetails(property, outcome));
      lines.push(`| ${title} | ${status} | ${details} |`);
    }
    lines.push("");
  } else {
    lines.push("_No runnable properties._");
    lines.push("");
  }

  if (result.failed.length > 0) {
    lines.push("### Failures");
    lines.push("");
    for (const failure of result.failed) {
      const property = propertyMap.get(failure.propertyId);
      const label = property
        ? `${property.targetFunction}: ${property.description}`
        : failure.propertyId;
      lines.push(`- \`${label}\``);
      lines.push(`  - Counterexample: \`${formatCounterexampleCall(property, failure)}\``);
      lines.push(`  - Error: ${truncate(failure.errorMessage, 200)}`);
      lines.push(`  - Seed: \`${failure.seed}\``);
    }
    lines.push("");
  }

  if (result.errors.length > 0) {
    lines.push("### Errors");
    lines.push("");
    for (const error of result.errors) {
      const property = propertyMap.get(error.propertyId);
      const label = property
        ? `${property.targetFunction}: ${property.description}`
        : error.propertyId;
      lines.push(`- \`${label}\` — ${truncate(error.errorMessage, 200)}`);
    }
    lines.push("");
  }

  if (report.summary.failed === 0 && report.summary.errors === 0) {
    lines.push("> All executed propcheck rules passed.");
  }

  return lines.join("\n").trimEnd();
}
