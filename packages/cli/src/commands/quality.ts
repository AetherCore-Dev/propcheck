/**
 * propcheck quality — measure property effectiveness via mutation testing.
 *
 * Injects small code mutations and checks how many your properties catch.
 * Higher mutation score = stronger properties.
 *
 * Output:
 *   Mutation Testing Report
 *   ├── Total mutants: 23
 *   ├── Killed: 19 (82.6%)
 *   ├── Survived: 4 (17.4%)
 *   └── Surviving mutants:
 *       - Line 17: + → - — "price * (1 - discount / 100)"
 *       - Line 27: 0 → 1 — "prices.reduce((sum, p) => sum + p, 0)"
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { loadConfig } from "@propcheck/config";
import { getProperties } from "@propcheck/store";
import { generateMutants, runMutationTesting } from "@propcheck/engines";
import type { MutationReport } from "@propcheck/engines";
import { toForwardSlash } from "@propcheck/common";
import chalk from "chalk";

export async function qualityCommand(
  target: string,
): Promise<void> {
  const projectRoot = process.cwd();
  const config = loadConfig(projectRoot);
  const storeDir = path.join(projectRoot, config.storeDir);

  // Resolve target
  const targetPath = path.resolve(projectRoot, target);
  try {
    await fs.access(targetPath);
  } catch {
    console.error(`\n  Error: File not found: ${target}\n`);
    process.exit(2);
  }

  // Load properties
  const moduleKey = toForwardSlash(path.relative(projectRoot, targetPath));
  const ps = await getProperties(storeDir, moduleKey);

  if (!ps || ps.properties.length === 0) {
    console.error(`\n  No properties found for ${target}`);
    console.error("  Run: propcheck infer " + target + " first\n");
    process.exit(2);
  }

  // Read source
  const source = await fs.readFile(targetPath, "utf8");

  // Show mutant preview
  const mutants = generateMutants(source, targetPath);
  console.log(`\n  ${chalk.bold("Mutation Testing")}: ${target}`);
  console.log(`  Generated ${chalk.cyan(String(mutants.length))} mutants from ${mutants.length > 0 ? new Set(mutants.map(m => m.operator)).size : 0} operators`);
  console.log(`  Testing against ${chalk.cyan(String(ps.properties.length))} properties...\n`);

  if (mutants.length === 0) {
    console.log("  No mutants generated (file may be too simple).\n");
    return;
  }

  // Run mutation testing
  const report = await runMutationTesting(sourceFilePath(targetPath), source, ps.properties, storeDir);

  // Report results
  printReport(report, target);

  // Exit code: 0 if score >= 80%, 1 otherwise
  process.exit(report.mutationScore >= 0.8 ? 0 : 1);
}

function sourceFilePath(targetPath: string): string {
  return targetPath;
}

function printReport(report: MutationReport, target: string): void {
  const scoreColor = report.mutationScore >= 0.8
    ? chalk.green
    : report.mutationScore >= 0.6
      ? chalk.yellow
      : chalk.red;

  const scorePercent = (report.mutationScore * 100).toFixed(1);

  console.log(`  ${chalk.bold("Results")}:`);
  console.log(`    Total mutants:  ${report.totalMutants}`);
  console.log(`    ${chalk.green("Killed")}:         ${report.killed} (${(report.killed / report.totalMutants * 100).toFixed(1)}%)`);
  console.log(`    ${chalk.red("Survived")}:       ${report.survived} (${(report.survived / report.totalMutants * 100).toFixed(1)}%)`);
  if (report.errors > 0) {
    console.log(`    ${chalk.yellow("Errors")}:         ${report.errors}`);
  }
  console.log(`    ${chalk.bold("Mutation score")}: ${scoreColor(scorePercent + "%")}`);
  console.log(`    Duration:       ${(report.duration / 1000).toFixed(1)}s`);

  // Show surviving mutants (property gaps)
  if (report.survivingMutants.length > 0) {
    console.log(`\n  ${chalk.yellow("Surviving mutants")} (properties missed these):`);
    for (const mutant of report.survivingMutants.slice(0, 10)) {
      console.log(`    ${chalk.dim("•")} ${mutant.description}`);
    }
    if (report.survivingMutants.length > 10) {
      console.log(`    ${chalk.dim(`... and ${report.survivingMutants.length - 10} more`)}`);
    }

    console.log(`\n  ${chalk.yellow("→")} These surviving mutants indicate areas where your properties could be stronger.`);
    console.log(`  ${chalk.yellow("→")} Consider adding properties that would catch these changes.\n`);
  } else {
    console.log(`\n  ${chalk.green("✓")} All mutants killed! Your properties are comprehensive.\n`);
  }
}
