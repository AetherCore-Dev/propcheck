/**
 * Configuration types for propcheck.
 */

import type { SupportedLanguage } from "./analysis";

/** Top-level propcheck configuration. */
export interface PropcheckConfig {
  /** API key (Anthropic, OpenRouter, or any compatible provider). */
  readonly apiKey: string | null;

  /** LLM model to use for property inference. */
  readonly model: string;

  /** LLM provider: "anthropic" for native API, "openai-compatible" for OpenRouter/one-api, "cli" for external CLI tool. */
  readonly provider: "anthropic" | "openai-compatible" | "cli";

  /** Base URL for the LLM API. null = use provider default. */
  readonly baseURL: string | null;

  /** CLI command for provider="cli" (e.g. "codebuddy"). */
  readonly cliCommand: string | null;

  /** CLI arguments for provider="cli". */
  readonly cliArgs: readonly string[] | null;

  /** Maximum properties to infer per function. */
  readonly maxPropertiesPerFunction: number;

  /** Minimum quality score (0-13) to keep a property. */
  readonly minScore: number;

  /** Default run mode. */
  readonly defaultMode: "quick" | "default" | "thorough";

  /** Per-property timeout in milliseconds. */
  readonly timeout: number;

  /** Languages to analyze. */
  readonly languages: readonly SupportedLanguage[];

  /** Path to .propcheck/ directory relative to project root. */
  readonly storeDir: string;

  /** Use mock LLM client for offline testing. */
  readonly mock: boolean;
}

/** Default configuration values. */
export const DEFAULT_CONFIG: PropcheckConfig = {
  apiKey: null,
  model: "claude-sonnet-4-20250514",
  provider: "anthropic",
  baseURL: null,
  cliCommand: null,
  cliArgs: null,
  maxPropertiesPerFunction: 5,
  minScore: 10,
  defaultMode: "default",
  timeout: 30_000,
  languages: ["typescript", "javascript"],
  storeDir: ".propcheck",
  mock: false,
};
