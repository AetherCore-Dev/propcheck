/**
 * Property line formatter — single row in the results table.
 */

import chalk from "chalk";
import type {
  PropertyDefinition,
  PropertyOutcome,
} from "@propcheck/common";

function formatStatus(property: PropertyDefinition): string {
  const formatStatusLabel = (() => {
    switch (property.status) {
      case "risky":
        return chalk.yellow(`[${property.status}]`);
      case "refined":
        return chalk.cyan(`[${property.status}]`);
      case "quarantined":
      case "dropped":
        return chalk.gray(`[${property.status}]`);
      default:
        return "";
    }
  })();
  const status = formatStatusLabel ? ` ${formatStatusLabel}` : "";
  const risk = property.riskTags.length > 0
    ? ` ${chalk.yellow(`risk:${property.riskTags.join(",")}`)}`
    : "";
  return `${status}${risk}`;
}

export function formatPropertyLine(
  property: PropertyDefinition,
  outcome?: PropertyOutcome,
): string {
  const desc = `${property.targetFunction}: ${property.description}`;
  const padded = desc.padEnd(50);

  const meta = formatStatus(property);

  if (!outcome) {
    // Inference display
    const cat = chalk.dim(`[${property.category}]`);
    const score = chalk.dim(`score: ${property.score}/13`);
    return `  ${chalk.cyan("*")} ${padded} ${cat}  ${score}${meta}`;
  }

  switch (outcome.status) {
    case "passed": {
      const iters = `(${outcome.iterations}/${outcome.iterations})`;
      const dur = `${(outcome.duration / 1000).toFixed(1)}s`;
      return `  ${chalk.green("\u2713")} ${padded} ${chalk.green("PASS")} ${chalk.dim(iters)}  ${chalk.dim(dur)}${meta}`;
    }
    case "failed": {
      return `  ${chalk.red("\u2717")} ${padded} ${chalk.red("FAIL")}${meta}`;
    }
    case "error": {
      return `  ${chalk.yellow("\u26A0")} ${padded} ${chalk.yellow("ERROR")}${meta}`;
    }
  }
}
