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
  .description("Set up propcheck in your project (creates .propcheck/ directory)")
  .action(initCommand);

program
  .command("infer <target>")
  .description("Discover rules about your code using AI (one-time, ~$0.05/file)")
  .option("--mock", "Use built-in demo mode (no API key needed)")
  .option("--model <model>", "AI model to use")
  .option("--provider <provider>", "AI provider: anthropic or openai-compatible")
  .option("--base-url <url>", "Custom API endpoint (for proxies / OpenRouter)")
  .option("--max-properties <n>", "Max rules per function", "5")
  .option("--min-score <n>", "Minimum quality score to keep (0-13)", "10")
  .option("--function <names>", "Only analyze specific functions (comma-separated)")
  .option("--skip-validation", "Skip trial-run validation of discovered rules")
  .option("--refine", "Run a second AI pass to strengthen weak rules")
  .action(inferCommand);

program
  .command("run [target]")
  .description("Test your code with random inputs (run after infer)")
  .option("--quick", "Fast mode: 100 random inputs per rule")
  .option("--thorough", "Deep mode: 10,000 random inputs per rule")
  .option("--seed <n>", "Fixed random seed (for reproducible results)")
  .option("--json", "Output results as JSON (for CI/CD)")
  .option("--changed", "Only test files changed in git diff")
  .option("--skip <ids>", "Skip specific rules by ID (comma-separated)")
  .option("--only <ids>", "Only run specific rules by ID (comma-separated)")
  .option("--include-quarantined", "Also test quarantined (fragile) rules")
  .action(runCommand);

program
  .command("badge")
  .description("Generate a README badge showing how many rules are verified")
  .action(badgeCommand);

program
  .command("quality <target>")
  .description("Check how good your rules are at catching bugs (mutation testing)")
  .action(qualityCommand);

program
  .command("props [target]")
  .description("List all discovered rules and their status")
  .option("--status <status>", "Filter: accepted, risky, refined, quarantined, dropped")
  .option("--json", "Output as JSON")
  .action(propsCommand);

program
  .command("property <target> <propertyId>")
  .description("View or update a specific rule (e.g., mark as quarantined)")
  .option("--status <status>", "Set new status (marks as human-reviewed)")
  .option("--json", "Output as JSON")
  .action(propertyCommand);

program
  .command("fix <target>")
  .description("Auto-fix bugs found by propcheck run (uses AI to generate a patch)")
  .option("--mock", "Use built-in demo mode (no API key needed)")
  .option("--model <model>", "AI model to use")
  .option("--provider <provider>", "AI provider: anthropic or openai-compatible")
  .option("--base-url <url>", "Custom API endpoint")
  .option("--apply", "Apply the fix directly (skip review)")
  .option("--property <id>", "Fix only a specific rule violation")
  .option("--max-attempts <n>", "Maximum fix attempts (default: 3)", "3")
  .option("--json", "Output fix result as JSON")
  .action(fixCommand);

program.parse();
