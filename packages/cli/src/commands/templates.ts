/**
 * `propcheck templates` command — list available community property templates.
 */

import chalk from "chalk";
import { getTemplateStats } from "@propcheck/llm";

interface TemplatesOptions {
  json?: boolean;
  domain?: string;
}

export async function templatesCommand(options: TemplatesOptions): Promise<void> {
  const allStats = getTemplateStats();
  const stats = options.domain
    ? allStats.filter((entry) => entry.domain === options.domain)
    : allStats;

  if (stats.length === 0) {
    console.error(`\n  Unknown template domain: ${options.domain}`);
    console.error("  Run: propcheck templates\n");
    process.exit(2);
  }

  if (options.json) {
    console.log(JSON.stringify(stats, null, 2));
    return;
  }

  console.log(chalk.bold("\n  Community Property Templates\n"));
  console.log(chalk.dim("  Templates provide curated property patterns for common function types."));
  console.log(chalk.dim("  They are used automatically to seed inference, and in --mock mode when a function name matches.\n"));

  const maxDomainLen = Math.max(...stats.map((s) => s.domain.length));

  for (const s of stats) {
    const domain = s.domain.padEnd(maxDomainLen);
    const count = String(s.templates).padStart(2);
    const patterns = s.patterns.map((p) => chalk.dim(p)).join(", ");
    console.log(`  ${chalk.cyan(domain)}  ${count} templates  ${patterns}`);
  }

  const totalTemplates = stats.reduce((sum, s) => sum + s.templates, 0);
  const totalDomains = stats.length;

  console.log(chalk.dim(`\n  ${totalDomains} domains, ${totalTemplates} templates total\n`));
}
