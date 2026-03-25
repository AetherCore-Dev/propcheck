/**
 * Default configuration values for propcheck.
 */

import type { PropcheckConfig } from "@propcheck/common";

/** Default configuration — used when no config file or overrides exist. */
export const DEFAULTS: PropcheckConfig = {
  apiKey: null,
  model: "claude-sonnet-4-20250514",
  maxPropertiesPerFunction: 5,
  minScore: 10,
  defaultMode: "default",
  timeout: 30_000,
  languages: ["typescript", "javascript"],
  storeDir: ".propcheck",
  mock: false,
};
