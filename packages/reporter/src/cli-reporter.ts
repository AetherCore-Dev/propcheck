/**
 * CLI Reporter — colored terminal output for propcheck.
 *
 * Design target:
 * $ propcheck run src/cart.ts
 *
 *   src/cart.ts
 *     ✓ applyDiscount: result >= 0                    PASS (1000/1000)  0.3s
 *     ✗ applyDiscount: result <= price                 FAIL
 *        Counterexample: applyDiscount(1, 101) → -0.01
 *        Shrunk to minimal case (12 shrink steps)
 *        Seed: 12345 (reproduce with --seed 12345)
 *     ✓ calculateTotal: total >= 0                     PASS (1000/1000)  0.2s
 *
 *   Properties: 3 | Passed: 2 | Failed: 1 | Duration: 1.8s
 */

import chalk from "chalk";
import type {
  ExecutionResult,
  PropertyDefinition,
  PropertyOutcome,
} from "@propcheck/common";
import { formatPropertyLine } from "./formatters/property-table";
import { formatCounterexample } from "./formatters/counterexample";
import { formatSummary, formatCost } from "./formatters/summary";

/** Inference result from LLM. */
export interface InferResult {
  readonly properties: readonly PropertyDefinition[];
  readonly tokensUsed: number;
  readonly cost: number;
  readonly duration: number;
}

/** Report newly inferred properties. */
export function reportInferResult(result: InferResult, filePath: string): void {
  const dur = (result.duration / 1000).toFixed(1);
  console.log("");
  console.log(
    chalk.bold(`  Discovered ${result.properties.length} rules for ${filePath}`) +
    chalk.dim(` ($${result.cost.toFixed(4)}, ${dur}s)`),
  );
  console.log("");

  for (const prop of result.properties) {
    console.log(formatPropertyLine(prop));
  }

  console.log("");
  console.log(`  ${formatCost(result.tokensUsed, result.cost)}`);
  console.log("");
}

/** Report full execution results. */
export function reportRunSummary(
  result: ExecutionResult,
  filePath: string,
): void {
  console.log("");
  console.log(chalk.bold(`  ${filePath}`));

  // Build a map from propertyId → outcome
  const outcomeMap = new Map<string, PropertyOutcome>();
  for (const r of result.passed) outcomeMap.set(r.propertyId, r);
  for (const f of result.failed) outcomeMap.set(f.propertyId, f);
  for (const e of result.errors) outcomeMap.set(e.propertyId, e);

  for (const prop of result.properties) {
    const outcome = outcomeMap.get(prop.id);
    console.log(formatPropertyLine(prop, outcome));

    // Show counterexample for failures
    if (outcome && outcome.status === "failed") {
      console.log(formatCounterexample(outcome, prop));
    }

    // Show error message
    if (outcome && outcome.status === "error") {
      console.log(chalk.yellow(`    ${outcome.errorMessage}`));
    }
  }

  console.log("");
  console.log(`  ${formatSummary(result)}`);

  // Next-step hints for failures
  if (result.failed.length > 0) {
    const failedIds = result.failed.map((f) => f.propertyId).join(",");
    console.log("");
    console.log(chalk.dim(`  Next steps:`));
    console.log(chalk.dim(`    • Review the counterexample above — is this a real bug or a false positive?`));
    console.log(chalk.dim(`    • Fix the bug:     propcheck fix ${filePath}`));
    console.log(chalk.dim(`    • Skip this rule:  propcheck run --skip ${failedIds} ${filePath}`));
    console.log(chalk.dim(`    • Quarantine it:   propcheck property ${filePath} ${result.failed[0].propertyId} --status quarantined`));
  }

  console.log("");
}
