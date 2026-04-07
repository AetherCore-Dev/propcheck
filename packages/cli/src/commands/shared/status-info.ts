/**
 * Shared property status metadata — descriptions and validation.
 *
 * Single source of truth for status lifecycle used by `props` and `property` commands.
 */

import type { PropertyStatus } from "@propcheck/common";

/** Status lifecycle in order, with user-facing descriptions. */
export const STATUS_INFO: ReadonlyArray<{ readonly status: PropertyStatus; readonly description: string }> = [
  { status: "accepted", description: "Verified and active — runs on every test" },
  { status: "risky", description: "Active but flagged for fragility (e.g. float ===)" },
  { status: "refined", description: "Auto-weakened to pass edge cases" },
  { status: "quarantined", description: "Skipped by default — too fragile for CI" },
  { status: "dropped", description: "Permanently disabled — never runs" },
];

/** Set of valid status values. */
export const VALID_STATUSES = new Set<PropertyStatus>(STATUS_INFO.map((s) => s.status));

/** Record form for O(1) description lookup. */
export const STATUS_DESCRIPTIONS: Readonly<Record<PropertyStatus, string>> = Object.fromEntries(
  STATUS_INFO.map((s) => [s.status, s.description]),
) as Record<PropertyStatus, string>;

/** Format an error message listing valid status options with descriptions. */
export function formatStatusError(invalidValue: string): string {
  const lines = [`\n  Error: Invalid status "${invalidValue}". Valid options:`];
  for (const { status, description } of STATUS_INFO) {
    lines.push(`    • ${status.padEnd(13)} ${description}`);
  }
  lines.push("");
  return lines.join("\n");
}
