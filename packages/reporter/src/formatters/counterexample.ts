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

  // Format counterexample values as function call
  let args: string;
  if (Array.isArray(failure.counterexample)) {
    args = failure.counterexample.map((v) => prettyValue(v)).join(", ");
  } else if (failure.counterexample != null) {
    args = prettyValue(failure.counterexample);
  } else {
    args = "...";
  }

  const funcName = property.targetFunction.split(".").pop() ?? property.targetFunction;
  lines.push(
    chalk.red(`    Counterexample: ${funcName}(${args})`),
  );

  if (failure.shrinkSteps > 0) {
    lines.push(
      chalk.dim(`    Shrunk to minimal case (${failure.shrinkSteps} shrink steps)`),
    );
  }

  if (failure.errorMessage) {
    // Extract just the first line of error message (skip the verbose fast-check output)
    const firstLine = failure.errorMessage.split("\n")[0].trim();
    lines.push(chalk.dim(`    Error: ${firstLine}`));
  }

  lines.push(
    chalk.dim(`    Seed: ${failure.seed} (reproduce with --seed ${failure.seed})`),
  );

  return lines.join("\n");
}
