/**
 * Content hashing for source change detection.
 *
 * Used to detect when source code has changed since properties were last inferred,
 * triggering staleness warnings.
 */

import { createHash } from "node:crypto";

/** Compute SHA-256 hash of source content. */
export function hashContent(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}
