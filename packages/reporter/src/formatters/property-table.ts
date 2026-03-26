/**
 * Property line formatter — single row in the results table.
 */

import chalk from "chalk";
import type {
  PropertyDefinition,
  PropertyOutcome,
} from "@propcheck/common";

export function formatPropertyLine(
  property: PropertyDefinition,
  outcome?: PropertyOutcome,
): string {
  const desc = `${property.targetFunction}: ${property.description}`;
  const padded = desc.padEnd(50);

  if (!outcome) {
    // Inference display
    const cat = chalk.dim(`[${property.category}]`);
    const score = chalk.dim(`score: ${property.score}/15`);
    return `  ${chalk.cyan("*")} ${padded} ${cat}  ${score}`;
  }

  switch (outcome.status) {
    case "passed": {
      const iters = `(${outcome.iterations}/${outcome.iterations})`;
      const dur = `${(outcome.duration / 1000).toFixed(1)}s`;
      return `  ${chalk.green("\u2713")} ${padded} ${chalk.green("PASS")} ${chalk.dim(iters)}  ${chalk.dim(dur)}`;
    }
    case "failed": {
      return `  ${chalk.red("\u2717")} ${padded} ${chalk.red("FAIL")}`;
    }
    case "error": {
      return `  ${chalk.yellow("\u26A0")} ${padded} ${chalk.yellow("ERROR")}`;
    }
  }
}
