/**
 * Response parser — validate and transform LLM output to PropertyDefinition[].
 */

import { z } from "zod";
import type { PropertyDefinition, PropertyCategory, GeneratorSpec, SeedInput } from "@propcheck/common";
import { hashContent, validateAssertion, validateGeneratorKey } from "@propcheck/common";

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
  type: z.string().max(50),
  constraints: z.object({
    min: z.number().finite().optional(),
    max: z.number().finite().optional(),
    maxLength: z.number().int().nonnegative().optional(),
    element: z.string().max(50).regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/).optional(),
  }).passthrough().optional(),
});

const RawPropertySchema = z.object({
  targetFunction: z.string().max(200),
  description: z.string().max(500),
  category: z.string().max(50),
  assertion: z.string().max(500),
  generators: z.record(GeneratorSpecSchema),
  seedInputs: z.array(SeedInputSchema).min(1).max(20),
  evidence: z.string().max(500),
  confidence: z.number().min(0).max(1),
});

const ResponseSchema = z.object({
  properties: z.array(RawPropertySchema),
});

/**
 * Parse a string-format generator spec (e.g. "float(0, 10000)") into a
 * structured GeneratorSpec object.
 *
 * Real LLMs often return generators as shorthand strings instead of the
 * structured object format described in the tool schema.  This normalizer
 * bridges the gap so both forms are accepted.
 */
function parseStringGenerator(s: string): { type: string; constraints?: Record<string, unknown> } {
  // Match patterns like: float(0, 10000), integer(-100, 100), array(float(0, 1000), 0, 10), string(50)
  const funcMatch = s.match(/^([a-zA-Z_]+)\((.*)\)$/);
  if (!funcMatch) {
    return { type: s.replace(/[^a-zA-Z0-9_]/g, "") || "any" };
  }

  const typeName = funcMatch[1];
  const argsStr = funcMatch[2];

  if (typeName === "array") {
    // array(float(0, 1000), 0, 10) → element type + length constraints
    const innerMatch = argsStr.match(/^([a-zA-Z_]+(?:\([^)]*\))?),\s*(\d+),\s*(\d+)$/);
    if (innerMatch) {
      const elementStr = innerMatch[1];
      const elementParsed = parseStringGenerator(elementStr);
      return {
        type: "array",
        constraints: {
          element: elementParsed.type,
          maxLength: Number(innerMatch[3]),
        },
      };
    }
    // array(float(0, 1000))
    const simpleInner = argsStr.match(/^([a-zA-Z_]+(?:\([^)]*\))?)$/);
    if (simpleInner) {
      const elementParsed = parseStringGenerator(simpleInner[1]);
      return { type: "array", constraints: { element: elementParsed.type } };
    }
    return { type: "array" };
  }

  // Simple: float(0, 10000) → { type: "float", constraints: { min: 0, max: 10000 } }
  const numArgs = argsStr.split(",").map((a) => a.trim()).filter(Boolean);
  if (numArgs.length === 2 && !isNaN(Number(numArgs[0])) && !isNaN(Number(numArgs[1]))) {
    return { type: typeName, constraints: { min: Number(numArgs[0]), max: Number(numArgs[1]) } };
  }
  if (numArgs.length === 1 && !isNaN(Number(numArgs[0]))) {
    return { type: typeName, constraints: { maxLength: Number(numArgs[0]) } };
  }

  return { type: typeName };
}

/**
 * Normalize a raw property's generators field: convert string-format
 * specs to structured objects so they pass Zod validation.
 */
function normalizeGenerators(raw: Record<string, unknown>): Record<string, unknown> {
  if (!raw || typeof raw !== "object") return raw;
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(raw)) {
    if (typeof val === "string") {
      result[key] = parseStringGenerator(val);
    } else {
      result[key] = val;
    }
  }
  return result;
}

/**
 * Pre-process a raw property item from the LLM before Zod validation.
 * Handles format differences between what the tool schema requests and
 * what real LLMs actually return.
 */
function normalizeRawProperty(item: unknown): unknown {
  if (!item || typeof item !== "object") return item;
  const obj = item as Record<string, unknown>;

  // Normalize generators from string format to object format
  if (obj.generators && typeof obj.generators === "object") {
    obj.generators = normalizeGenerators(obj.generators as Record<string, unknown>);
  }

  return obj;
}

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
    const normalized = normalizeRawProperty(item);
    const parsed = RawPropertySchema.safeParse(normalized);
    if (!parsed.success) {
      continue; // Skip malformed entries
    }

    const raw = parsed.data;

    // Validate assertion safety
    const assertionCheck = validateAssertion(raw.assertion);
    if (!assertionCheck.valid) {
      console.warn(`[propcheck] Dropped unsafe property "${raw.targetFunction}": ${assertionCheck.reason}`);
      continue;
    }

    // Validate generator keys are safe identifiers and count is bounded
    const generatorKeys = Object.keys(raw.generators);
    if (generatorKeys.length > 20) {
      console.warn(`[propcheck] Dropped property "${raw.targetFunction}": too many generators (${generatorKeys.length})`);
      continue;
    }
    const hasUnsafeKey = generatorKeys.some((k) => !validateGeneratorKey(k));
    if (hasUnsafeKey) {
      console.warn(`[propcheck] Dropped property "${raw.targetFunction}": unsafe generator key`);
      continue;
    }

    // Validate targetFunction is a safe qualified identifier
    if (!/^[a-zA-Z_$][a-zA-Z0-9_$.]*$/.test(raw.targetFunction)) {
      continue; // Skip entries with unsafe target function names
    }

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
