/**
 * Summary line formatter.
 *
 * Output: "Properties: 5 | Passed: 4 | Failed: 1 | Duration: 2.3s"
 */

import chalk from "chalk";
import type { ExecutionResult } from "@propcheck/common";

export function formatSummary(result: ExecutionResult): string {
  const total = result.passed.length + result.failed.length + result.errors.length;
  const passCount = result.passed.length;
  const failCount = result.failed.length;
  const errorCount = result.errors.length;
  const skippedCount = result.skipped.length;
  const duration = (result.duration / 1000).toFixed(1);

  const parts: string[] = [
    `Properties: ${total}`,
    chalk.green(`Passed: ${passCount}`),
  ];

  if (failCount > 0) {
    parts.push(chalk.red(`Failed: ${failCount}`));
  }
  if (errorCount > 0) {
    parts.push(chalk.yellow(`Errors: ${errorCount}`));
  }
  if (skippedCount > 0) {
    parts.push(chalk.gray(`Skipped: ${skippedCount}`));
  }
  parts.push(`Duration: ${duration}s`);

  return parts.join(" | ");
}

export function formatCost(tokensUsed: number, cost: number): string {
  return chalk.dim(`Tokens: ${tokensUsed.toLocaleString()} | Cost: $${cost.toFixed(4)}`);
}
