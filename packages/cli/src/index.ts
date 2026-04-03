#!/usr/bin/env node

/**
 * propcheck CLI — AI-powered property-based testing.
 *
 * Usage:
 *   propcheck init                   Initialize .propcheck/ directory
 *   propcheck infer <target>         Infer properties using LLM
 *   propcheck run [target]           Run property tests
 *   propcheck props [target]         List property inventory
 *   propcheck property <t> <id>      Inspect / update a property
 */

import { Command } from "commander";
import { initCommand } from "./commands/init";
import { inferCommand } from "./commands/infer";
import { runCommand } from "./commands/run";
import { badgeCommand } from "./commands/badge";
import { qualityCommand } from "./commands/quality";
import { propsCommand } from "./commands/props";
import { propertyCommand } from "./commands/property";
import { fixCommand } from "./commands/fix";

import chalk from "chalk";

const program = new Command();

program
  .name("propcheck")
  .description("AI-powered property-based testing — find bugs your tests miss")
  .version("0.2.0")
  .option("--no-color", "Disable colored output")
  .hook("preAction", () => {
    if (program.opts().color === false) {
      chalk.level = 0;
    }
  });

program
  .command("init")
  .description("Initialize .propcheck/ directory in the current project")
  .action(initCommand);

program
  .command("infer <target>")
  .description("Infer testable properties for target file(s) using LLM")
  .option("--mock", "Use mock LLM client (no API key needed)")
  .option("--model <model>", "LLM model to use")
  .option("--provider <provider>", "LLM provider: anthropic or openai-compatible")
  .option("--base-url <url>", "Base URL for LLM API (for proxies / OpenRouter)")
  .option("--max-properties <n>", "Max properties per function", "5")
  .option("--min-score <n>", "Minimum quality score (0-13)", "10")
  .option("--function <names>", "Infer only specific functions (comma-separated names)")
  .option("--skip-validation", "Skip trial-run validation of inferred properties")
  .option("--refine", "Enable refinement loop (Round 2): strengthen weak properties")
  .action(inferCommand);

program
  .command("run [target]")
  .description("Run property tests against target file(s)")
  .option("--quick", "Quick mode: 100 iterations")
  .option("--thorough", "Thorough mode: 10,000 iterations")
  .option("--seed <n>", "Random seed for reproducibility")
  .option("--json", "Output results as JSON")
  .option("--changed", "Only run properties for git-changed files")
  .option("--skip <ids>", "Comma-separated property IDs to skip")
  .option("--only <ids>", "Comma-separated property IDs to run exclusively")
  .option("--include-quarantined", "Run quarantined properties too")
  .action(runCommand);

program
  .command("badge")
  .description("Output markdown badge snippet for your README")
  .action(badgeCommand);

program
  .command("quality <target>")
  .description("Measure property effectiveness via mutation testing")
  .action(qualityCommand);

program
  .command("props [target]")
  .description("List property inventory with status overview")
  .option("--status <status>", "Filter by status: accepted, risky, refined, quarantined, dropped")
  .option("--json", "Output as JSON")
  .action(propsCommand);

program
  .command("property <target> <propertyId>")
  .description("Inspect or update a single property")
  .option("--status <status>", "Set new status (marks as humanVerified)")
  .option("--json", "Output as JSON")
  .action(propertyCommand);

program
  .command("fix <target>")
  .description("Generate a fix for property violations found by `propcheck run`")
  .option("--mock", "Use mock LLM client (no API key needed)")
  .option("--model <model>", "LLM model to use")
  .option("--provider <provider>", "LLM provider: anthropic or openai-compatible")
  .option("--base-url <url>", "Base URL for LLM API")
  .option("--apply", "Apply the fix directly without review")
  .option("--property <id>", "Fix only a specific property violation")
  .option("--max-attempts <n>", "Maximum fix attempts (default: 3)", "3")
  .option("--json", "Output fix result as JSON")
  .action(fixCommand);

program.parse();
