#!/usr/bin/env node

/**
 * propcheck CLI — AI-powered property-based testing.
 *
 * Usage:
 *   propcheck init                   Initialize .propcheck/ directory
 *   propcheck infer <target>         Infer properties using LLM
 *   propcheck run [target]           Run property tests
 */

import { Command } from "commander";
import { initCommand } from "./commands/init";
import { inferCommand } from "./commands/infer";
import { runCommand } from "./commands/run";
import { badgeCommand } from "./commands/badge";

const program = new Command();

program
  .name("propcheck")
  .description("AI-powered property-based testing — find bugs your tests miss")
  .version("0.1.0");

program
  .command("init")
  .description("Initialize .propcheck/ directory in the current project")
  .action(initCommand);

program
  .command("infer <target>")
  .description("Infer testable properties for target file(s) using LLM")
  .option("--mock", "Use mock LLM client (no API key needed)")
  .option("--model <model>", "LLM model to use", "claude-sonnet-4-20250514")
  .option("--max-properties <n>", "Max properties per function", "5")
  .option("--min-score <n>", "Minimum quality score (0-15)", "10")
  .option("--skip-validation", "Skip trial-run validation of inferred properties")
  .action(inferCommand);

program
  .command("run [target]")
  .description("Run property tests against target file(s)")
  .option("--quick", "Quick mode: 100 iterations")
  .option("--thorough", "Thorough mode: 10,000 iterations")
  .option("--seed <n>", "Random seed for reproducibility")
  .option("--json", "Output results as JSON")
  .action(runCommand);

program
  .command("badge")
  .description("Output markdown badge snippet for your README")
  .action(badgeCommand);

program.parse();
