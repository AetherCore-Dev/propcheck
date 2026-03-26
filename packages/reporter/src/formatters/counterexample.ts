/**
 * Counterexample display formatter.
 */

import chalk from "chalk";
import type { PropertyFailure, PropertyDefinition } from "@propcheck/common";

function prettyValue(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (typeof value === "string") return `"${value}"`;
  if (typeof value === "object") {
    return JSON.stringify(value, null, 2);
  }
  return String(value);
}

export function formatCounterexample(
  failure: PropertyFailure,
  property: PropertyDefinition,
): string {
  const lines: string[] = [];

  lines.push(
    chalk.red(`    Counterexample: ${property.targetFunction}(${prettyValue(failure.counterexample)})`),
  );

  if (failure.shrinkSteps > 0) {
    lines.push(
      chalk.dim(`    Shrunk to minimal case (${failure.shrinkSteps} shrink steps)`),
    );
  }

  if (failure.errorMessage) {
    lines.push(chalk.dim(`    Error: ${failure.errorMessage}`));
  }

  lines.push(
    chalk.dim(`    Seed: ${failure.seed} (reproduce with --seed ${failure.seed})`),
  );

  return lines.join("\n");
}
