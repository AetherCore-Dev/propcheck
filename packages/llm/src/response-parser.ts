/**
 * Response parser — validate and transform LLM output to PropertyDefinition[].
 */

import { z } from "zod";
import type { PropertyDefinition, PropertyCategory, GeneratorSpec, SeedInput } from "@propcheck/common";
import { hashContent } from "@propcheck/common";

const VALID_CATEGORIES: PropertyCategory[] = [
  "roundtrip", "idempotent", "conservation", "monotonic",
  "equivalence", "type-preservation", "cross-function",
  "boundary", "metamorphic",
];

const SeedInputSchema = z.object({
  label: z.enum(["normal", "boundary", "extreme"]),
  value: z.unknown(),
});

const GeneratorSpecSchema = z.object({
  type: z.string(),
  constraints: z.record(z.unknown()).optional(),
});

const RawPropertySchema = z.object({
  targetFunction: z.string(),
  description: z.string(),
  category: z.string(),
  assertion: z.string(),
  generators: z.record(GeneratorSpecSchema),
  seedInputs: z.array(SeedInputSchema).min(1),
  evidence: z.string(),
  confidence: z.number().min(0).max(1),
});

const ResponseSchema = z.object({
  properties: z.array(RawPropertySchema),
});

export interface ParseOptions {
  readonly sourceHash: string;
  readonly modelId: string;
}

/**
 * Parse raw LLM tool_use response into PropertyDefinition[].
 *
 * Gracefully handles partial/malformed responses — skips bad entries.
 */
export function parseInferResponse(
  raw: unknown,
  options: ParseOptions,
): readonly PropertyDefinition[] {
  if (!raw || typeof raw !== "object") {
    return [];
  }

  const parsed = ResponseSchema.safeParse(raw);
  if (!parsed.success) {
    // Try to extract properties array directly
    const asRecord = raw as Record<string, unknown>;
    if (Array.isArray(asRecord.properties)) {
      return parsePropertyArray(asRecord.properties, options);
    }
    return [];
  }

  return parsePropertyArray(parsed.data.properties, options);
}

function parsePropertyArray(
  items: unknown[],
  options: ParseOptions,
): readonly PropertyDefinition[] {
  const results: PropertyDefinition[] = [];
  let counter = 1;

  for (const item of items) {
    const parsed = RawPropertySchema.safeParse(item);
    if (!parsed.success) {
      continue; // Skip malformed entries
    }

    const raw = parsed.data;
    const category = VALID_CATEGORIES.includes(raw.category as PropertyCategory)
      ? (raw.category as PropertyCategory)
      : "boundary";

    const generators: Record<string, GeneratorSpec> = {};
    for (const [key, val] of Object.entries(raw.generators)) {
      generators[key] = {
        type: val.type,
        ...(val.constraints ? { constraints: val.constraints } : {}),
      };
    }

    const seedInputs: SeedInput[] = raw.seedInputs.map((s) => ({
      label: s.label,
      value: s.value,
    }));

    const id = `prop_${String(counter).padStart(3, "0")}`;
    counter++;

    results.push({
      id,
      targetFunction: raw.targetFunction,
      description: raw.description,
      category,
      assertion: raw.assertion,
      generators: Object.freeze(generators),
      seedInputs: Object.freeze(seedInputs),
      score: 0, // Will be set by scoring
      confidence: raw.confidence,
      evidence: raw.evidence,
      sourceHash: options.sourceHash,
      inferredAt: new Date().toISOString(),
      modelId: options.modelId,
    });
  }

  return results;
}
