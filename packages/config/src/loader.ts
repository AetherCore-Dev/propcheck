/**
 * Configuration loader for propcheck.
 *
 * Priority (highest to lowest):
 * 1. CLI flags (--mock, --model, --provider, --base-url, etc.)
 * 2. Environment variables (PROPCHECK_API_KEY / ANTHROPIC_API_KEY, etc.)
 * 3. .propcheckrc file (JSON)
 * 4. Default values
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { z } from "zod";
import type { PropcheckConfig } from "@propcheck/common";
import { DEFAULTS } from "./defaults";

/** Schema for validating .propcheckrc content. */
const PropcheckRcSchema = z.object({
  // apiKey intentionally excluded — use env vars to avoid accidental git commits
  model: z.string().optional(),
  provider: z.enum(["anthropic", "openai-compatible", "cli"]).optional(),
  baseURL: z.string().url().optional(),
  cliCommand: z.string().optional(),
  cliArgs: z.array(z.string()).optional(),
  maxPropertiesPerFunction: z.number().int().min(1).max(20).optional(),
  minScore: z.number().int().min(0).max(13).optional(),
  defaultMode: z.enum(["quick", "default", "thorough"]).optional(),
  timeout: z.number().int().min(1000).max(300_000).optional(),
  storeDir: z.string().regex(/^[a-zA-Z0-9_][a-zA-Z0-9._-]*(?:\/[a-zA-Z0-9_][a-zA-Z0-9._-]*)*$/, "storeDir must be a relative path without traversal (no '..' components)").optional(),
  mock: z.boolean().optional(),
}).strict();

/** CLI overrides that can be passed from commander. */
export interface ConfigOverrides {
  readonly apiKey?: string;
  readonly model?: string;
  readonly provider?: "anthropic" | "openai-compatible" | "cli";
  readonly baseURL?: string;
  readonly cliCommand?: string;
  readonly cliArgs?: readonly string[];
  readonly mock?: boolean;
  readonly mode?: "quick" | "default" | "thorough";
  readonly verbose?: boolean;
}

export type ConfigValueSource = "default" | "rc" | "env" | "cli" | "auto";

export interface ConfigFieldInspection<T> {
  readonly value: T;
  readonly source: ConfigValueSource;
  readonly detail?: string;
}

export interface ConfigInspection {
  readonly config: PropcheckConfig;
  readonly fields: { [K in keyof PropcheckConfig]: ConfigFieldInspection<PropcheckConfig[K]> };
  readonly warnings: readonly string[];
}

type MutableSourceMap = { [K in keyof PropcheckConfig]: { source: ConfigValueSource; detail?: string } };

function createDefaultSourceMap(): MutableSourceMap {
  return {
    apiKey: { source: "default", detail: "DEFAULTS" },
    model: { source: "default", detail: "DEFAULTS" },
    provider: { source: "default", detail: "DEFAULTS" },
    baseURL: { source: "default", detail: "DEFAULTS" },
    cliCommand: { source: "default", detail: "DEFAULTS" },
    cliArgs: { source: "default", detail: "DEFAULTS" },
    maxPropertiesPerFunction: { source: "default", detail: "DEFAULTS" },
    minScore: { source: "default", detail: "DEFAULTS" },
    defaultMode: { source: "default", detail: "DEFAULTS" },
    timeout: { source: "default", detail: "DEFAULTS" },
    languages: { source: "default", detail: "DEFAULTS" },
    storeDir: { source: "default", detail: "DEFAULTS" },
    mock: { source: "default", detail: "DEFAULTS" },
  };
}

function setField<K extends keyof PropcheckConfig>(
  config: PropcheckConfig,
  sources: MutableSourceMap,
  key: K,
  value: PropcheckConfig[K],
  source: ConfigValueSource,
  detail?: string,
): PropcheckConfig {
  sources[key] = { source, detail };
  return { ...config, [key]: value };
}

function firstDefinedEnv(keys: readonly string[]): { name?: string; value?: string } {
  for (const key of keys) {
    const value = process.env[key];
    if (value !== undefined) {
      return { name: key, value };
    }
  }
  return {};
}

/**
 * Inspect propcheck configuration by merging all sources and tracking where each
 * resolved value came from.
 */
export function inspectConfig(
  projectRoot: string,
  overrides: ConfigOverrides = {},
): ConfigInspection {
  let config: PropcheckConfig = { ...DEFAULTS };
  const sources = createDefaultSourceMap();
  const warnings: string[] = [];

  // Layer 2: Load .propcheckrc if it exists (validated with Zod)
  const rcPath = path.join(projectRoot, ".propcheckrc");
  if (fs.existsSync(rcPath)) {
    try {
      const rcContent = fs.readFileSync(rcPath, "utf8");
      const rawJson = JSON.parse(rcContent) as unknown;
      const parsed = PropcheckRcSchema.safeParse(rawJson);
      if (parsed.success) {
        const rc = parsed.data;
        if (rc.model !== undefined) {
          config = setField(config, sources, "model", rc.model, "rc", ".propcheckrc");
        }
        if (rc.provider !== undefined) {
          config = setField(config, sources, "provider", rc.provider, "rc", ".propcheckrc");
        }
        if (rc.baseURL !== undefined) {
          config = setField(config, sources, "baseURL", rc.baseURL, "rc", ".propcheckrc");
        }
        if (rc.maxPropertiesPerFunction !== undefined) {
          config = setField(config, sources, "maxPropertiesPerFunction", rc.maxPropertiesPerFunction, "rc", ".propcheckrc");
        }
        if (rc.minScore !== undefined) {
          config = setField(config, sources, "minScore", rc.minScore, "rc", ".propcheckrc");
        }
        if (rc.defaultMode !== undefined) {
          config = setField(config, sources, "defaultMode", rc.defaultMode, "rc", ".propcheckrc");
        }
        if (rc.timeout !== undefined) {
          config = setField(config, sources, "timeout", rc.timeout, "rc", ".propcheckrc");
        }
        if (rc.storeDir !== undefined) {
          config = setField(config, sources, "storeDir", rc.storeDir, "rc", ".propcheckrc");
        }
        if (rc.mock !== undefined) {
          config = setField(config, sources, "mock", rc.mock, "rc", ".propcheckrc");
        }
        if (rc.cliCommand !== undefined) {
          config = setField(config, sources, "cliCommand", rc.cliCommand, "rc", ".propcheckrc");
        }
        if (rc.cliArgs !== undefined) {
          config = setField(config, sources, "cliArgs", rc.cliArgs, "rc", ".propcheckrc");
        }
      } else {
        warnings.push(`.propcheckrc has invalid entries (using defaults): ${parsed.error.issues.map((i) => i.message).join(", ")}`);
      }
    } catch (err: unknown) {
      warnings.push(`Failed to parse .propcheckrc (using defaults): ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Layer 3: Environment variables
  // API key: PROPCHECK_API_KEY > ANTHROPIC_API_KEY > OPENAI_API_KEY
  const envApiKey = firstDefinedEnv(["PROPCHECK_API_KEY", "ANTHROPIC_API_KEY", "OPENAI_API_KEY"]);
  const envBaseURL = firstDefinedEnv(["PROPCHECK_BASE_URL", "ANTHROPIC_BASE_URL", "OPENAI_BASE_URL"]);
  const envMock = process.env["PROPCHECK_MOCK"];
  const envProvider = process.env["PROPCHECK_PROVIDER"];

  if (envApiKey.value) {
    config = setField(config, sources, "apiKey", envApiKey.value, "env", envApiKey.name);
  }
  if (envMock === "true" || envMock === "1") {
    config = setField(config, sources, "mock", true, "env", "PROPCHECK_MOCK");
  }
  if (envBaseURL.value) {
    const urlResult = z.string().url().safeParse(envBaseURL.value);
    if (urlResult.success) {
      config = setField(config, sources, "baseURL", urlResult.data, "env", envBaseURL.name);
    } else {
      warnings.push(`${envBaseURL.name ?? "PROPCHECK_BASE_URL"} is not a valid URL — ignored.`);
    }
  }
  if (envProvider !== undefined) {
    if (envProvider === "anthropic" || envProvider === "openai-compatible" || envProvider === "cli") {
      config = setField(config, sources, "provider", envProvider, "env", "PROPCHECK_PROVIDER");
    } else {
      warnings.push(`PROPCHECK_PROVIDER has invalid value "${envProvider}" — expected "anthropic", "openai-compatible", or "cli"; ignoring.`);
    }
  }

  // CLI provider env vars
  const envCliCommand = process.env["PROPCHECK_CLI_COMMAND"];
  if (envCliCommand) {
    config = setField(config, sources, "cliCommand", envCliCommand, "env", "PROPCHECK_CLI_COMMAND");
  }
  const envCliArgs = process.env["PROPCHECK_CLI_ARGS"];
  if (envCliArgs) {
    config = setField(config, sources, "cliArgs", envCliArgs.split(",").map((s) => s.trim()), "env", "PROPCHECK_CLI_ARGS");
  }

  // Auto-detect provider from baseURL if provider is still defaulted.
  if (config.baseURL && sources.provider.source === "default") {
    const url = config.baseURL.toLowerCase();
    if (url.includes("openrouter.ai") || url.includes("openai.com")) {
      config = setField(config, sources, "provider", "openai-compatible", "auto", "inferred from baseURL");
    }
  }

  // Layer 4: CLI overrides (highest priority)
  if (overrides.apiKey !== undefined) {
    config = setField(config, sources, "apiKey", overrides.apiKey, "cli", "--api-key");
  }
  if (overrides.model !== undefined) {
    config = setField(config, sources, "model", overrides.model, "cli", "--model");
  }
  if (overrides.provider !== undefined) {
    config = setField(config, sources, "provider", overrides.provider, "cli", "--provider");
  }
  if (overrides.baseURL !== undefined) {
    config = setField(config, sources, "baseURL", overrides.baseURL, "cli", "--base-url");
  }
  if (overrides.mock !== undefined) {
    config = setField(config, sources, "mock", overrides.mock, "cli", "--mock");
  }
  if (overrides.cliCommand !== undefined) {
    config = setField(config, sources, "cliCommand", overrides.cliCommand, "cli", "--cli-command");
  }
  if (overrides.cliArgs !== undefined) {
    config = setField(config, sources, "cliArgs", [...overrides.cliArgs], "cli", "--cli-args");
  }
  if (overrides.mode !== undefined) {
    config = setField(config, sources, "defaultMode", overrides.mode, "cli", "mode override");
  }

  const frozenConfig = Object.freeze(config);
  const fields = {
    apiKey: { value: frozenConfig.apiKey, ...sources.apiKey },
    model: { value: frozenConfig.model, ...sources.model },
    provider: { value: frozenConfig.provider, ...sources.provider },
    baseURL: { value: frozenConfig.baseURL, ...sources.baseURL },
    cliCommand: { value: frozenConfig.cliCommand, ...sources.cliCommand },
    cliArgs: { value: frozenConfig.cliArgs, ...sources.cliArgs },
    maxPropertiesPerFunction: { value: frozenConfig.maxPropertiesPerFunction, ...sources.maxPropertiesPerFunction },
    minScore: { value: frozenConfig.minScore, ...sources.minScore },
    defaultMode: { value: frozenConfig.defaultMode, ...sources.defaultMode },
    timeout: { value: frozenConfig.timeout, ...sources.timeout },
    languages: { value: frozenConfig.languages, ...sources.languages },
    storeDir: { value: frozenConfig.storeDir, ...sources.storeDir },
    mock: { value: frozenConfig.mock, ...sources.mock },
  } satisfies ConfigInspection["fields"];

  return {
    config: frozenConfig,
    fields,
    warnings: Object.freeze([...warnings]),
  };
}

/**
 * Load propcheck configuration by merging all sources.
 *
 * Returns a new immutable config object — never mutates inputs.
 */
export function loadConfig(
  projectRoot: string,
  overrides: ConfigOverrides = {},
): PropcheckConfig {
  return inspectConfig(projectRoot, overrides).config;
}

/**
 * Validate that required config is present for a given command.
 *
 * Returns an array of error messages (empty = valid).
 */
export function validateConfig(
  config: PropcheckConfig,
  command: "infer" | "run" | "init" | "fix",
): readonly string[] {
  const errors: string[] = [];

  if ((command === "infer" || command === "fix") && !config.mock) {
    if (config.provider === "cli") {
      if (!config.cliCommand) {
        errors.push(
          "CLI provider requires a command.\n" +
          "Set it via one of:\n" +
          "  --cli-command codebuddy\n" +
          "  export PROPCHECK_CLI_COMMAND=codebuddy\n" +
          '  Add "cliCommand": "codebuddy" to .propcheckrc',
        );
      }
    } else if (!config.apiKey) {
      errors.push(
        "API key is required for property inference.\n" +
        "Set it via one of:\n" +
        "  export PROPCHECK_API_KEY=sk-...      # any provider\n" +
        "  export ANTHROPIC_API_KEY=sk-ant-...  # Anthropic direct\n" +
        "  export OPENAI_API_KEY=sk-or-...      # OpenRouter / OpenAI-compatible\n" +
        "Or use --provider cli --cli-command codebuddy for CLI-based inference.\n" +
        "Or use --mock for offline testing with demo data.",
      );
    }
  }

  return errors;
}
