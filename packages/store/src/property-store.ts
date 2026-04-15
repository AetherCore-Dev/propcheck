/**
 * Property store — CRUD for .propcheck/properties.json
 *
 * File format:
 * {
 *   "version": 1,
 *   "modules": {
 *     "src/cart.ts": PropertySet,
 *     "src/auth.ts": PropertySet
 *   }
 * }
 *
 * All writes are atomic (temp file → rename) to prevent corruption.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as crypto from "node:crypto";
import type {
  PropertyDefinition,
  PropertySet,
  PropertyStatus,
  PropertyRiskTag,
  ValidationEvidence,
  PropertyEvidenceSource,
} from "@propcheck/common";

/** On-disk format of properties.json */
interface PropertiesFile {
  readonly version: number;
  readonly modules: Readonly<Record<string, PropertySet>>;
}

interface LegacyPropertyDefinition extends Omit<PropertyDefinition, "riskScore" | "riskTags" | "status" | "validation" | "humanVerified" | "evidenceSource"> {
  readonly riskScore?: number;
  readonly riskTags?: readonly PropertyRiskTag[];
  readonly status?: PropertyStatus;
  readonly validation?: ValidationEvidence;
  readonly humanVerified?: boolean;
  readonly evidenceSource?: PropertyEvidenceSource;
}

interface LegacyPropertySet extends Omit<PropertySet, "schemaVersion" | "properties"> {
  readonly schemaVersion?: number;
  readonly properties: readonly LegacyPropertyDefinition[];
}

const PROPERTIES_FILE = "properties.json";
const FILE_VERSION = 2;
const LEGACY_RISK_PENALTIES: Readonly<Record<PropertyRiskTag, number>> = {
  float_exact_equality: 3,
  tiny_abs_tolerance: 2,
  missing_precondition: 1,
  wide_numeric_domain: 2,
  doc_domain_mismatch: 2,
  spec_code_conflict: 3,
  roundtrip_numeric_fragility: 3,
  metamorphic_scale_risk: 1,
};

function propertiesPath(storeDir: string): string {
  return path.join(storeDir, PROPERTIES_FILE);
}

function computeLegacyRiskScore(score: number, riskTags: readonly PropertyRiskTag[]): number {
  const penalty = riskTags.reduce((sum, tag) => sum + LEGACY_RISK_PENALTIES[tag], 0);
  return Math.max(0, score - penalty);
}

function normalizeProperty(property: LegacyPropertyDefinition): PropertyDefinition {
  const riskTags = Object.freeze([...(property.riskTags ?? [])]);
  return {
    ...property,
    riskScore: property.riskScore ?? computeLegacyRiskScore(property.score, riskTags),
    riskTags,
    status: property.status ?? (riskTags.length > 0 ? "risky" : "accepted"),
    evidenceSource: property.evidenceSource ?? "code",
    ...(property.validation ? { validation: property.validation } : {}),
    ...(property.humanVerified !== undefined ? { humanVerified: property.humanVerified } : {}),
  };
}

function normalizePropertySet(propertySet: LegacyPropertySet): PropertySet {
  return {
    schemaVersion: 2,
    module: propertySet.module,
    filePath: propertySet.filePath,
    properties: Object.freeze(propertySet.properties.map(normalizeProperty)),
    sourceHash: propertySet.sourceHash,
    inferredAt: propertySet.inferredAt,
  };
}

function normalizePropertiesFile(file: { readonly version?: number; readonly modules?: Readonly<Record<string, LegacyPropertySet>> }): PropertiesFile {
  const version = file.version ?? 1;
  if (version > FILE_VERSION) {
    throw new Error(`Unsupported properties file version ${version}. Current CLI supports up to ${FILE_VERSION}.`);
  }

  return {
    version: FILE_VERSION,
    modules: Object.fromEntries(
      Object.entries(file.modules ?? {}).map(([module, propertySet]) => [module, normalizePropertySet(propertySet)]),
    ),
  };
}

async function readPropertiesFile(storeDir: string): Promise<PropertiesFile> {
  const filePath = propertiesPath(storeDir);
  try {
    const content = await fs.readFile(filePath, "utf8");
    return normalizePropertiesFile(JSON.parse(content) as { readonly version?: number; readonly modules?: Readonly<Record<string, LegacyPropertySet>> });
  } catch (err: unknown) {
    // Only return empty state for missing file; re-throw for corruption/permission errors
    if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
      return { version: FILE_VERSION, modules: {} };
    }
    // JSON parse errors or permission errors should surface
    throw new Error(`Failed to read properties file at ${filePath}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function writePropertiesFile(
  storeDir: string,
  data: PropertiesFile,
): Promise<void> {
  const filePath = propertiesPath(storeDir);
  const tmpName = `.tmp-${crypto.randomBytes(8).toString("hex")}.json`;
  const tmpPath = path.join(storeDir, tmpName);

  const content = JSON.stringify(data, null, 2);
  await fs.writeFile(tmpPath, content, "utf8");
  await fs.rename(tmpPath, filePath);
}

/** Get properties for a single module. */
export async function getProperties(
  storeDir: string,
  module: string,
): Promise<PropertySet | null> {
  const file = await readPropertiesFile(storeDir);
  return file.modules[module] ?? null;
}

/** Get all property sets across the project. */
export async function getAllProperties(
  storeDir: string,
): Promise<readonly PropertySet[]> {
  const file = await readPropertiesFile(storeDir);
  return Object.values(file.modules);
}

/** Write properties for a module (immutable replace). */
export async function setProperties(
  storeDir: string,
  module: string,
  propertySet: PropertySet,
): Promise<void> {
  const file = await readPropertiesFile(storeDir);
  const updated: PropertiesFile = {
    ...file,
    modules: { ...file.modules, [module]: propertySet },
  };
  await writePropertiesFile(storeDir, updated);
}

/** Check if a property set is stale (source has changed). */
export function isStale(
  propertySet: PropertySet,
  currentHash: string,
): boolean {
  return propertySet.sourceHash !== currentHash;
}

/** Remove properties for a module. */
export async function removeProperties(
  storeDir: string,
  module: string,
): Promise<void> {
  const file = await readPropertiesFile(storeDir);
  const remaining = { ...file.modules };
  delete remaining[module];
  const updated: PropertiesFile = {
    ...file,
    modules: remaining,
  };
  await writePropertiesFile(storeDir, updated);
}
