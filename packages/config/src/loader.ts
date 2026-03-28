/**
 * Configuration loader for propcheck.
 *
 * Priority (highest to lowest):
 * 1. CLI flags (--mock, --model, etc.)
 * 2. Environment variables (ANTHROPIC_API_KEY, PROPCHECK_MOCK)
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
  apiKey: z.string().optional(),
  model: z.string().optional(),
  maxPropertiesPerFunction: z.number().int().min(1).max(20).optional(),
  minScore: z.number().int().min(0).max(13).optional(),
  defaultMode: z.enum(["quick", "default", "thorough"]).optional(),
  timeout: z.number().int().min(1000).max(300_000).optional(),
  storeDir: z.string().regex(/^[a-zA-Z0-9._-]+(?:\/[a-zA-Z0-9._-]+)*$/, "storeDir must be a relative path without traversal").optional(),
  mock: z.boolean().optional(),
}).strict();

/** CLI overrides that can be passed from commander. */
export interface ConfigOverrides {
  readonly apiKey?: string;
  readonly model?: string;
  readonly mock?: boolean;
  readonly mode?: "quick" | "default" | "thorough";
  readonly verbose?: boolean;
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
  // Layer 1: Start with defaults
  let config: PropcheckConfig = { ...DEFAULTS };

  // Layer 2: Load .propcheckrc if it exists (validated with Zod)
  const rcPath = path.join(projectRoot, ".propcheckrc");
  if (fs.existsSync(rcPath)) {
    try {
      const rcContent = fs.readFileSync(rcPath, "utf8");
      const rawJson = JSON.parse(rcContent) as unknown;
      const parsed = PropcheckRcSchema.safeParse(rawJson);
      if (parsed.success) {
        config = { ...config, ...parsed.data };
      } else {
        console.warn(`  Warning: .propcheckrc has invalid entries (using defaults): ${parsed.error.issues.map((i) => i.message).join(", ")}`);
      }
    } catch (err: unknown) {
      console.warn(`  Warning: Failed to parse .propcheckrc (using defaults): ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Layer 3: Environment variables
  const envApiKey = process.env["ANTHROPIC_API_KEY"];
  const envMock = process.env["PROPCHECK_MOCK"];

  if (envApiKey) {
    config = { ...config, apiKey: envApiKey };
  }
  if (envMock === "true" || envMock === "1") {
    config = { ...config, mock: true };
  }

  // Layer 4: CLI overrides (highest priority)
  if (overrides.apiKey !== undefined) {
    config = { ...config, apiKey: overrides.apiKey };
  }
  if (overrides.model !== undefined) {
    config = { ...config, model: overrides.model };
  }
  if (overrides.mock !== undefined) {
    config = { ...config, mock: overrides.mock };
  }
  if (overrides.mode !== undefined) {
    config = { ...config, defaultMode: overrides.mode };
  }

  return Object.freeze(config);
}

/**
 * Validate that required config is present for a given command.
 *
 * Returns an array of error messages (empty = valid).
 */
export function validateConfig(
  config: PropcheckConfig,
  command: "infer" | "run" | "init",
): readonly string[] {
  const errors: string[] = [];

  if (command === "infer" && !config.mock && !config.apiKey) {
    errors.push(
      "ANTHROPIC_API_KEY is required for property inference.\n" +
      "Set it via: export ANTHROPIC_API_KEY=sk-ant-...\n" +
      "Or use --mock for offline testing with canned responses.",
    );
  }

  return errors;
}
