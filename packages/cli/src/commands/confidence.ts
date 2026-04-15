import * as fs from "node:fs/promises";
import * as path from "node:path";
import { inspectConfig, validateConfig } from "@propcheck/config";
import { getAllProperties, getProperties } from "@propcheck/store";
import { findSourceFiles, hashContent, toForwardSlash } from "@propcheck/common";
import { reportConfidence, reportConfidenceAsJson } from "@propcheck/reporter";
import type { PropertyDefinition, PropertySet } from "@propcheck/common";
import type { ConfidenceReport } from "@propcheck/reporter";

export interface ConfidenceOptions {
  json?: boolean;
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function isActiveProperty(property: PropertyDefinition): boolean {
  return property.status !== "quarantined" && property.status !== "dropped";
}

async function resolvePropertySets(
  projectRoot: string,
  storeDir: string,
  target: string | undefined,
): Promise<{ readonly targetLabel: string | null; readonly propertySets: readonly PropertySet[] }> {
  if (!target) {
    const propertySets = await getAllProperties(storeDir);
    return { targetLabel: null, propertySets };
  }

  const targetPath = path.resolve(projectRoot, target);
  let stat;
  try {
    stat = await fs.stat(targetPath);
  } catch {
    throw new Error(`Error: File or directory not found: ${target}`);
  }

  if (stat.isDirectory()) {
    const allSets = await getAllProperties(storeDir);
    const sourceFiles = findSourceFiles(targetPath);
    const sourceKeys = new Set(sourceFiles.map((filePath) => toForwardSlash(path.relative(projectRoot, filePath))));
    return {
      targetLabel: target,
      propertySets: allSets.filter((propertySet) => sourceKeys.has(propertySet.filePath)),
    };
  }

  const moduleKey = toForwardSlash(path.relative(projectRoot, targetPath));
  const propertySet = await getProperties(storeDir, moduleKey);
  return {
    targetLabel: target,
    propertySets: propertySet ? [propertySet] : [],
  };
}

async function collectModuleHealth(
  projectRoot: string,
  propertySets: readonly PropertySet[],
): Promise<{ readonly staleModules: number; readonly missingModules: number }> {
  let staleModules = 0;
  let missingModules = 0;

  for (const propertySet of propertySets) {
    const filePath = path.resolve(projectRoot, propertySet.filePath);
    try {
      const source = await fs.readFile(filePath, "utf8");
      if (hashContent(source) !== propertySet.sourceHash) {
        staleModules++;
      }
    } catch {
      staleModules++;
      missingModules++;
    }
  }

  return { staleModules, missingModules };
}

function buildRecommendations(report: ConfidenceReport): readonly string[] {
  const recommendations: string[] = [];
  const targetHint = report.target ?? "<file>";

  if (!report.readiness.overallOk) {
    recommendations.push("Run: propcheck doctor");
  }
  if (report.summary.activeProperties === 0) {
    recommendations.push(`Run: propcheck infer ${targetHint}`);
  }
  if (report.summary.staleModules > 0) {
    recommendations.push("Re-run inference for changed files before trusting this score.");
  }
  if (report.summary.validatedProperties < report.summary.activeProperties) {
    recommendations.push(`Run: propcheck run --thorough ${targetHint}`);
  }
  if (report.summary.riskyProperties > 0) {
    recommendations.push(`Review risky properties with: propcheck props ${targetHint}`);
  }
  if (report.summary.humanVerifiedProperties < report.summary.activeProperties) {
    recommendations.push("Human-verify the highest-value accepted properties.");
  }
  if (report.summary.specBackedProperties === 0 && report.summary.activeProperties > 0) {
    recommendations.push("Use propcheck infer --spec <file> for stronger intent alignment.");
  }

  return recommendations.slice(0, 4);
}

function determineTier(report: Omit<ConfidenceReport, "tier" | "recommendations">): ConfidenceReport["tier"] {
  const active = report.summary.activeProperties;
  const validationRatio = active === 0 ? 0 : report.summary.validatedProperties / active;
  const verificationRatio = active === 0 ? 0 : report.summary.humanVerifiedProperties / active;

  if (
    report.score >= 75 &&
    active > 0 &&
    validationRatio >= 0.75 &&
    verificationRatio >= 0.25 &&
    report.summary.riskyProperties === 0 &&
    report.summary.staleModules === 0 &&
    report.readiness.overallOk
  ) {
    return 3;
  }

  if (report.score >= 40 && active > 0 && validationRatio > 0) {
    return 2;
  }

  return 1;
}

export function exitCodeForConfidenceReport(report: ConfidenceReport): number {
  return report.tier >= 2 && report.summary.riskyProperties === 0 && report.summary.staleModules === 0 && report.readiness.overallOk
    ? 0
    : 1;
}

export async function buildConfidenceReport(target: string | undefined): Promise<ConfidenceReport> {
  const projectRoot = process.cwd();
  const inspection = inspectConfig(projectRoot);
  const config = inspection.config;
  const storeDir = path.join(projectRoot, config.storeDir);

  const { targetLabel, propertySets } = await resolvePropertySets(projectRoot, storeDir, target);
  if (propertySets.length === 0) {
    const scope = targetLabel ? ` for ${targetLabel}` : "";
    throw new Error(`No properties found${scope}. Run: propcheck infer ${targetLabel ?? "<file>"}`);
  }

  const { staleModules, missingModules } = await collectModuleHealth(projectRoot, propertySets);
  const properties = propertySets.flatMap((propertySet) => propertySet.properties);
  const activeProperties = properties.filter(isActiveProperty);

  const acceptedProperties = activeProperties.filter((property) => property.status === "accepted").length;
  const refinedProperties = activeProperties.filter((property) => property.status === "refined").length;
  const riskyProperties = activeProperties.filter((property) => property.status === "risky").length;
  const quarantinedProperties = properties.filter((property) => property.status === "quarantined").length;
  const droppedProperties = properties.filter((property) => property.status === "dropped").length;
  const validatedProperties = activeProperties.filter((property) => property.validation !== undefined).length;
  const humanVerifiedProperties = activeProperties.filter((property) => property.humanVerified === true).length;
  const specBackedProperties = activeProperties.filter((property) => property.evidenceSource === "spec" || property.evidenceSource === "mixed").length;

  const activeCount = activeProperties.length;
  const validationRatio = activeCount === 0 ? 0 : validatedProperties / activeCount;
  const verificationRatio = activeCount === 0 ? 0 : humanVerifiedProperties / activeCount;
  const stableRatio = activeCount === 0 ? 0 : (acceptedProperties + refinedProperties) / activeCount;
  const riskyRatio = activeCount === 0 ? 0 : riskyProperties / activeCount;
  const specRatio = activeCount === 0 ? 0 : specBackedProperties / activeCount;
  const staleRatio = propertySets.length === 0 ? 0 : staleModules / propertySets.length;

  const inferReady = validateConfig(config, "infer").length === 0;
  const fixReady = validateConfig(config, "fix").length === 0;
  const readiness = {
    overallOk: inferReady && fixReady,
    inferReady,
    fixReady,
    warnings: inspection.warnings.length,
    mockMode: config.mock,
  };

  const score = clampScore(
    (activeCount > 0 ? 20 : 0) +
    validationRatio * 25 +
    verificationRatio * 20 +
    stableRatio * 15 +
    specRatio * 10 +
    (readiness.overallOk ? 10 : (readiness.inferReady || readiness.fixReady ? 5 : 0)) -
    riskyRatio * 15 -
    staleRatio * 10,
  );

  const baseReport = {
    target: targetLabel,
    score,
    readiness,
    summary: {
      modules: propertySets.length,
      staleModules,
      missingModules,
      totalProperties: properties.length,
      activeProperties: activeCount,
      acceptedProperties,
      refinedProperties,
      riskyProperties,
      quarantinedProperties,
      droppedProperties,
      validatedProperties,
      humanVerifiedProperties,
      specBackedProperties,
    },
  };

  const report: ConfidenceReport = {
    ...baseReport,
    tier: determineTier(baseReport),
    recommendations: [],
  };
  return {
    ...report,
    recommendations: buildRecommendations(report),
  };
}

export async function confidenceCommand(
  target: string | undefined,
  options: ConfidenceOptions,
): Promise<void> {
  let report: ConfidenceReport;
  try {
    report = await buildConfidenceReport(target);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown confidence error.";
    console.error(`\n  ${message}\n`);
    process.exit(2);
  }

  if (options.json) {
    console.log(reportConfidenceAsJson(report));
  } else {
    reportConfidence(report);
  }

  process.exit(exitCodeForConfidenceReport(report));
}
