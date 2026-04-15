import { inspectConfig } from "@propcheck/config";
import chalk from "chalk";

interface ConfigShowOptions {
  json?: boolean;
}

const SOURCE_LABELS = {
  default: "default",
  rc: ".propcheckrc",
  env: "env",
  cli: "cli",
  auto: "auto",
} as const;

function formatValue(key: string, value: unknown): string {
  if (key === "apiKey") {
    if (typeof value !== "string" || value.length === 0) {
      return chalk.gray("not set");
    }
    return chalk.green(`set (${value.slice(0, 6)}…${value.slice(-4)})`);
  }

  if (value === null) return chalk.gray("default");
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? chalk.green("true") : chalk.gray("false");
  return String(value);
}

export async function configShowCommand(options: ConfigShowOptions): Promise<void> {
  const inspection = inspectConfig(process.cwd());

  if (options.json) {
    const payload = {
      warnings: inspection.warnings,
      fields: Object.fromEntries(
        Object.entries(inspection.fields).map(([key, field]) => [key, {
          value: key === "apiKey"
            ? (typeof field.value === "string" && field.value.length > 0
              ? `${field.value.slice(0, 6)}…${field.value.slice(-4)}`
              : null)
            : field.value,
          present: key === "apiKey" ? Boolean(field.value) : undefined,
          source: field.source,
          detail: field.detail,
        }]),
      ),
    };
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log(`\n  ${chalk.bold("Resolved propcheck configuration")}\n`);

  for (const [key, field] of Object.entries(inspection.fields)) {
    const label = key.padEnd(24);
    const source = SOURCE_LABELS[field.source].padEnd(11);
    const detail = field.detail ? chalk.dim(` (${field.detail})`) : "";
    console.log(`  ${chalk.cyan(label)} ${formatValue(key, field.value)} ${chalk.dim(`[${source}]`)}${detail}`);
  }

  if (inspection.warnings.length > 0) {
    console.log(`\n  ${chalk.yellow("Warnings")}:`);
    for (const warning of inspection.warnings) {
      console.log(`    - ${warning}`);
    }
  }

  console.log("");
}
