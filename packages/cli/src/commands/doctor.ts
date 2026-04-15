import * as fs from "node:fs";
import * as path from "node:path";
import { inspectConfig, validateConfig } from "@propcheck/config";
import chalk from "chalk";

interface DoctorOptions {
  json?: boolean;
}

interface DoctorCheck {
  readonly name: string;
  readonly status: "ok" | "warn" | "error";
  readonly detail: string;
}

function statusIcon(status: DoctorCheck["status"]): string {
  switch (status) {
    case "ok":
      return chalk.green("✓");
    case "warn":
      return chalk.yellow("!");
    case "error":
      return chalk.red("✗");
  }
}

export async function doctorCommand(options: DoctorOptions): Promise<void> {
  const projectRoot = process.cwd();
  const inspection = inspectConfig(projectRoot);
  const config = inspection.config;
  const storeDir = path.join(projectRoot, config.storeDir);
  const checks: DoctorCheck[] = [];

  checks.push({
    name: "Configuration parse",
    status: inspection.warnings.length > 0 ? "warn" : "ok",
    detail: inspection.warnings.length > 0
      ? `${inspection.warnings.length} warning(s) detected while resolving config`
      : "No config parsing warnings",
  });

  checks.push({
    name: "Store directory",
    status: fs.existsSync(storeDir) ? "ok" : "warn",
    detail: fs.existsSync(storeDir)
      ? `${config.storeDir} already exists`
      : `${config.storeDir} will be created on first init/infer run`,
  });

  checks.push({
    name: "Provider",
    status: "ok",
    detail: `${config.provider} (source: ${inspection.fields.provider.source}${inspection.fields.provider.detail ? ` / ${inspection.fields.provider.detail}` : ""})`,
  });

  checks.push({
    name: "API key",
    status: config.apiKey ? "ok" : config.mock ? "warn" : "error",
    detail: config.apiKey
      ? `Resolved from ${inspection.fields.apiKey.detail ?? inspection.fields.apiKey.source}`
      : config.mock
        ? "No API key set, but mock mode is enabled"
        : "No API key resolved for real inference/fix commands",
  });

  const inferErrors = validateConfig(config, "infer");
  checks.push({
    name: "Infer readiness",
    status: inferErrors.length === 0 ? "ok" : "error",
    detail: inferErrors.length === 0
      ? (config.mock ? "Ready in mock mode" : "Ready for real inference")
      : inferErrors[0].split("\n")[0],
  });

  const fixErrors = validateConfig(config, "fix");
  checks.push({
    name: "Fix readiness",
    status: fixErrors.length === 0 ? "ok" : "error",
    detail: fixErrors.length === 0
      ? (config.mock ? "Ready in mock mode" : "Ready for real fix generation")
      : fixErrors[0].split("\n")[0],
  });

  if (options.json) {
    const payload = {
      ok: checks.every((check) => check.status !== "error"),
      warnings: inspection.warnings,
      checks,
    };
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log(`\n  ${chalk.bold("propcheck doctor")}\n`);
    for (const check of checks) {
      console.log(`  ${statusIcon(check.status)} ${chalk.bold(check.name)} — ${check.detail}`);
    }

    if (inspection.warnings.length > 0) {
      console.log(`\n  ${chalk.yellow("Warnings")}:`);
      for (const warning of inspection.warnings) {
        console.log(`    - ${warning}`);
      }
    }

    console.log("");
  }

  if (checks.some((check) => check.status === "error")) {
    process.exit(2);
  }
}
