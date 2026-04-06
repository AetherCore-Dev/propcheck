/**
 * Canary validation and trial-run execution for inferred properties.
 *
 * Extracted from infer.ts for maintainability.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import {
  generateFastCheckTest,
  runFastCheckTest,
  generateHypothesisTest,
  runHypothesisTest,
} from "@propcheck/engines";
import type {
  PropertyDefinition,
  GeneratorSpec,
  RunConfig,
  ExecutionResult,
  ValidationEvidence,
} from "@propcheck/common";
import type { LlmClient } from "@propcheck/llm";
import { autoWeakenProperty, isNumericSpec, getNumericBounds } from "./weakening";
import { repairProperty, mockRepairProperty } from "@propcheck/llm";

export type TrialRunLanguage = "typescript" | "javascript" | "python";

export const MAX_CANARY_CASES = 8;
export const MAX_REPAIR_ROUNDS = 3;

export async function ensureTestsDir(storeDir: string): Promise<string> {
  const testsDir = path.join(storeDir, "tests");
  await fs.mkdir(testsDir, { recursive: true });
  return testsDir;
}

export function buildValidationEvidence(smokePasses: number, canaryPasses: number): ValidationEvidence {
  return { smokePasses, canaryPasses, seedsTested: [], lastValidatedAt: new Date().toISOString() };
}

export function buildCandidateValues(spec: GeneratorSpec): readonly unknown[] {
  const c = spec.constraints ?? {};

  if (spec.type === "boolean") return [false, true];

  if (spec.type === "string") {
    const maxSize = typeof c.maxLength === "number" ? Math.max(1, c.maxLength) : 1;
    return ["", "x", "0".slice(0, maxSize)];
  }

  if (isNumericSpec(spec)) {
    const defaults = spec.type === "integer" || spec.type === "int"
      ? [0, 1, -1, 42, -42, Number.MAX_SAFE_INTEGER - 1]
      : [0, Number.EPSILON, 0.1, 0.2, 0.3, 1e-12, 1e6];
    const { min, max } = getNumericBounds(spec);
    const filtered = defaults.filter((v) => {
      if (!Number.isFinite(v)) return false;
      if (min !== undefined && v < min) return false;
      if (max !== undefined && v > max) return false;
      return true;
    });
    if (filtered.length > 0) {
      return [...new Set(filtered.map((v) => (spec.type === "integer" || spec.type === "int") ? Math.trunc(v) : v))];
    }
    const fallback: number[] = [];
    if (min !== undefined) fallback.push(spec.type === "integer" || spec.type === "int" ? Math.trunc(min) : min);
    if (max !== undefined) fallback.push(spec.type === "integer" || spec.type === "int" ? Math.trunc(max) : max);
    return fallback.length > 0 ? [...new Set(fallback)] : [spec.type === "integer" || spec.type === "int" ? 0 : 0.0];
  }

  if (spec.type === "array") {
    const elementType = c.element ?? c.elementType;
    const nestedSpec: GeneratorSpec = {
      type: typeof elementType === "string" ? elementType : "integer",
      constraints: {
        ...((c.elementMin ?? c.min) !== undefined ? { min: c.elementMin ?? c.min } : {}),
        ...((c.elementMax ?? c.max) !== undefined ? { max: c.elementMax ?? c.max } : {}),
        ...(c.elementMaxLength !== undefined ? { maxLength: c.elementMaxLength } : {}),
      },
    };
    const elementValues = buildCandidateValues(nestedSpec);
    const singleton = elementValues[0] ?? 0;
    const second = elementValues[1] ?? singleton;
    const maxLength = typeof c.maxLength === "number" ? c.maxLength : undefined;
    const arrays: unknown[] = [];
    if (maxLength === undefined || maxLength >= 0) arrays.push([]);
    if (maxLength === undefined || maxLength >= 1) arrays.push([singleton]);
    if (maxLength === undefined || maxLength >= 2) arrays.push([singleton, singleton]);
    if (maxLength === undefined || maxLength >= 2) arrays.push([singleton, second]);
    return arrays;
  }

  if (spec.type === "object") {
    const fields = c.fields;
    if (fields && typeof fields === "object") {
      const entries = Object.entries(fields as Record<string, unknown>);
      const obj: Record<string, unknown> = {};
      for (const [name, fieldSpec] of entries) {
        const fSpec = fieldSpec as { type: string; constraints?: Record<string, unknown> };
        const vals = buildCandidateValues({ type: fSpec.type, constraints: fSpec.constraints });
        obj[name] = vals[0] ?? null;
      }
      return [obj];
    }
    return [{}];
  }

  if (spec.type === "optional") {
    const inner = c.inner as { type: string; constraints?: Record<string, unknown> } | undefined;
    if (inner && typeof inner === "object" && typeof inner.type === "string") {
      const vals = buildCandidateValues({ type: inner.type, constraints: inner.constraints });
      return [undefined, vals[0] ?? null];
    }
    return [undefined, null];
  }

  if (spec.type === "enum") {
    const values = c.values;
    if (Array.isArray(values) && values.length > 0) return values as readonly unknown[];
    return [];
  }

  return [];
}

function buildCanaryCases(property: PropertyDefinition): readonly Record<string, unknown>[] {
  const entries = Object.entries(property.generators);
  if (entries.length === 0) return [{}];

  const candidates = entries.map(([name, spec]) => [name, buildCandidateValues(spec)] as const);
  if (candidates.some(([, values]) => values.length === 0)) return [];

  const baseline = Object.fromEntries(candidates.map(([name, values]) => [name, values[0]]));
  const cases: Record<string, unknown>[] = [baseline];
  const seen = new Set([JSON.stringify(baseline)]);

  for (const [name, values] of candidates) {
    for (const value of values.slice(1)) {
      const nextCase = { ...baseline, [name]: value };
      const key = JSON.stringify(nextCase);
      if (!seen.has(key)) { seen.add(key); cases.push(nextCase); }
      if (cases.length >= MAX_CANARY_CASES) return cases;
    }
  }
  return cases;
}

function buildConstantGenerators(input: Readonly<Record<string, unknown>>): Readonly<Record<string, GeneratorSpec>> {
  return Object.freeze(Object.fromEntries(
    Object.entries(input).map(([name, value]) => [name, { type: "constant", constraints: { value } }]),
  ));
}

export async function executeTrialRun(
  properties: readonly PropertyDefinition[],
  targetPath: string,
  testsDir: string,
  config: RunConfig,
  language: TrialRunLanguage,
): Promise<ExecutionResult> {
  const generated = language === "python"
    ? generateHypothesisTest(properties, targetPath, testsDir, config)
    : generateFastCheckTest(properties, targetPath, testsDir, config);

  const testFilePath = path.join(testsDir, generated.fileName);
  await fs.writeFile(testFilePath, generated.content, "utf8");

  try {
    const fcGenerated = language !== "python" ? generated as { needsMtsCopy?: boolean } : null;
    return language === "python"
      ? await runHypothesisTest(testFilePath, properties, config)
      : await runFastCheckTest(testFilePath, properties, config, {
          targetFile: targetPath,
          needsMtsCopy: fcGenerated?.needsMtsCopy,
        });
  } finally {
    try { await fs.unlink(testFilePath); } catch { /* ignore cleanup failures */ }
  }
}

export async function canaryValidateProperties(
  properties: readonly PropertyDefinition[],
  targetPath: string,
  storeDir: string,
  language: TrialRunLanguage,
): Promise<{ readonly validated: readonly PropertyDefinition[]; readonly quarantined: readonly { prop: PropertyDefinition; reason: string }[] }> {
  const testsDir = await ensureTestsDir(storeDir);

  const canaryConfig: RunConfig = { mode: "quick", iterations: 1, timeout: 15_000, verbose: false };
  const validated: PropertyDefinition[] = [];
  const quarantined: { prop: PropertyDefinition; reason: string }[] = [];

  for (const property of properties) {
    if (property.riskTags.length === 0) {
      validated.push({ ...property, validation: buildValidationEvidence(100, 0) });
      continue;
    }

    const canaryCases = buildCanaryCases(property);
    if (canaryCases.length === 0) {
      validated.push({ ...property, status: property.status === "refined" ? "refined" : "risky", validation: buildValidationEvidence(100, 0) });
      continue;
    }

    let canaryPasses = 0;
    let failureReason: string | null = null;

    for (const input of canaryCases) {
      const canaryProperty: PropertyDefinition = { ...property, generators: buildConstantGenerators(input) };
      const result = await executeTrialRun([canaryProperty], targetPath, testsDir, canaryConfig, language);
      const failed = result.failed[0];
      const error = result.errors[0];
      if (failed || error) {
        failureReason = failed?.errorMessage ?? error?.errorMessage ?? `canary failed for ${JSON.stringify(input)}`;
        break;
      }
      canaryPasses++;
    }

    if (failureReason) {
      const weakened = autoWeakenProperty(property);
      if (weakened) {
        const rerun = await canaryValidateProperties([weakened], targetPath, storeDir, language);
        if (rerun.validated.length > 0) { validated.push(rerun.validated[0]); continue; }
        if (rerun.quarantined.length > 0) { quarantined.push(rerun.quarantined[0]); continue; }
      }
      quarantined.push({ prop: { ...property, status: "quarantined", validation: buildValidationEvidence(100, canaryPasses) }, reason: failureReason });
      continue;
    }

    validated.push({ ...property, status: property.status === "refined" ? "refined" : "risky", validation: buildValidationEvidence(100, canaryPasses) });
  }

  return { validated, quarantined };
}

export async function trialRunValidation(
  properties: readonly PropertyDefinition[],
  targetPath: string,
  storeDir: string,
  sourceCode: string,
  llmClient: LlmClient | null,
  isMock: boolean,
  language: TrialRunLanguage,
): Promise<{ readonly validated: readonly PropertyDefinition[]; readonly dropped: readonly { prop: PropertyDefinition; reason: string }[]; readonly repaired: number }> {
  const testsDir = await ensureTestsDir(storeDir);
  const trialConfig: RunConfig = { mode: "quick", iterations: 100, timeout: 15_000, verbose: false };

  let currentProperties = [...properties];
  const validated: PropertyDefinition[] = [];
  const dropped: { prop: PropertyDefinition; reason: string }[] = [];
  let totalRepaired = 0;

  for (let round = 0; round <= MAX_REPAIR_ROUNDS; round++) {
    if (currentProperties.length === 0) break;

    const result = await executeTrialRun(currentProperties, targetPath, testsDir, trialConfig, language);
    const passedIds = new Set(result.passed.map((p) => p.propertyId));
    const failedIds = new Set(result.failed.map((f) => f.propertyId));
    const errorIds = new Set(result.errors.map((e) => e.propertyId));
    const needsRepair: PropertyDefinition[] = [];

    for (const prop of currentProperties) {
      if (passedIds.has(prop.id)) {
        validated.push(prop);
      } else if (failedIds.has(prop.id)) {
        if (round < MAX_REPAIR_ROUNDS) {
          const weakened = autoWeakenProperty(prop);
          if (weakened) {
            needsRepair.push(weakened);
            totalRepaired++;
            console.log(`    ↻ Adjusting: ${prop.targetFunction}: ${prop.description} — too strict, relaxing... (attempt ${round + 1})`);
            continue;
          }
        }
        validated.push(prop);
      } else if (errorIds.has(prop.id)) {
        const err = result.errors.find((e) => e.propertyId === prop.id);
        const errorMsg = err?.errorMessage ?? "unknown error";
        if (round < MAX_REPAIR_ROUNDS) {
          const funcSig = `${prop.targetFunction}(...)`;
          let repaired: PropertyDefinition | null = null;
          if (isMock) { repaired = mockRepairProperty(prop, errorMsg); }
          else if (llmClient) { repaired = await repairProperty(llmClient, prop, errorMsg, sourceCode, funcSig); }
          if (repaired) {
            needsRepair.push(repaired);
            totalRepaired++;
            console.log(`    ↻ Repairing: ${prop.targetFunction}: ${prop.description} (round ${round + 1})`);
          } else {
            dropped.push({ prop, reason: `codegen error (repair failed round ${round + 1}): ${errorMsg}` });
          }
        } else {
          dropped.push({ prop, reason: `codegen error (max ${MAX_REPAIR_ROUNDS} repairs): ${errorMsg}` });
        }
      } else {
        dropped.push({ prop, reason: "no output from trial run" });
      }
    }
    currentProperties = needsRepair;
  }

  return { validated, dropped, repaired: totalRepaired };
}
