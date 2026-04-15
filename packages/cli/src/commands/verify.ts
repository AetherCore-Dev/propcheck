import * as fs from "node:fs/promises";
import * as path from "node:path";
import { loadConfig } from "@propcheck/config";
import { getProperties } from "@propcheck/store";
import {
  generateFastCheckTest,
  generateHypothesisTest,
  runFastCheckTest,
  runHypothesisTest,
  runMutationTesting,
} from "@propcheck/engines";
import { RUN_MODE_ITERATIONS, toForwardSlash } from "@propcheck/common";
import type { ExecutionResult, PropertyDefinition, PropertySkip, RunConfig } from "@propcheck/common";
import type { MutationReport } from "@propcheck/engines";
import type { ConfidenceReport } from "@propcheck/reporter";
import chalk from "chalk";
import { buildConfidenceReport, exitCodeForConfidenceReport } from "./confidence";

export interface VerifyOptions {
  quick?: boolean;
  thorough?: boolean;
  seed?: string;
  json?: boolean;
}

interface VerifyRunSummary {
  readonly totalProperties: number;
  readonly passedProperties: number;
  readonly failedProperties: number;
  readonly errorProperties: number;
  readonly skippedProperties: number;
  readonly failedPropertyIds: readonly string[];
  readonly errorPropertyIds: readonly string[];
  readonly skippedPropertyIds: readonly string[];
  readonly totalIterations: number;
  readonly duration: number;
}

interface VerifyQualitySummary {
  readonly supported: boolean;
  readonly totalMutants: number;
  readonly killed: number;
  readonly survived: number;
  readonly errors: number;
  readonly mutationScore: number;
  readonly survivingMutants: readonly string[];
  readonly duration: number;
  readonly note?: string;
}

export interface VerifyReport {
  readonly target: string;
  readonly mode: RunConfig["mode"];
  readonly status: "verified" | "needs_attention" | "failed";
  readonly ok: boolean;
  readonly formalVerification: {
    readonly available: false;
    readonly status: "not_attempted";
    readonly reason: string;
  };
  readonly run: VerifyRunSummary;
  readonly quality: VerifyQualitySummary;
  readonly confidence: ConfidenceReport;
  readonly recommendations: readonly string[];
}

function resolveMode(options: VerifyOptions): RunConfig["mode"] {
  if (options.quick) {
    return "quick";
  }
  if (options.thorough) {
    return "thorough";
  }
  return "thorough";
}

function parseSeed(seed: string | undefined): number | undefined {
  if (seed === undefined) {
    return undefined;
  }
  const parsed = parseInt(seed, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

async function loadTargetContext(target: string): Promise<{
  readonly projectRoot: string;
  readonly storeDir: string;
  readonly targetPath: string;
  readonly source: string;
  readonly properties: readonly PropertyDefinition[];
}> {
  const projectRoot = process.cwd();
  const config = loadConfig(projectRoot);
  const storeDir = path.join(projectRoot, config.storeDir);
  const targetPath = path.resolve(projectRoot, target);

  let stat: import("node:fs").Stats;
  try {
    stat = await fs.stat(targetPath);
  } catch {
    throw new Error(`Error: File not found: ${target}`);
  }

  if (stat.isDirectory()) {
    throw new Error(`Error: verify currently supports a single file target: ${target}`);
  }

  const moduleKey = toForwardSlash(path.relative(projectRoot, targetPath));
  const propertySet = await getProperties(storeDir, moduleKey);
  if (!propertySet || propertySet.properties.length === 0) {
    throw new Error(`No properties found for ${target}. Run: propcheck infer ${target}`);
  }

  const source = await fs.readFile(targetPath, "utf8");
  return {
    projectRoot,
    storeDir,
    targetPath,
    source,
    properties: propertySet.properties,
  };
}

function splitRunnableProperties(properties: readonly PropertyDefinition[]): {
  readonly runnable: readonly PropertyDefinition[];
  readonly skipped: readonly PropertySkip[];
} {
  const skipped: PropertySkip[] = [];
  const runnable: PropertyDefinition[] = [];

  for (const property of properties) {
    if (property.status === "dropped") {
      skipped.push({ propertyId: property.id, reason: "dropped", propertyStatus: property.status });
      continue;
    }
    if (property.status === "quarantined") {
      skipped.push({ propertyId: property.id, reason: "quarantined", propertyStatus: property.status });
      continue;
    }
    runnable.push(property);
  }

  return {
    runnable: runnable.sort((left, right) => left.id.localeCompare(right.id, undefined, { numeric: true })),
    skipped,
  };
}

async function runVerificationExecution(
  targetPath: string,
  storeDir: string,
  properties: readonly PropertyDefinition[],
  options: VerifyOptions,
): Promise<ExecutionResult> {
  const { runnable, skipped } = splitRunnableProperties(properties);
  if (runnable.length === 0) {
    throw new Error("No runnable properties remain after excluding quarantined and dropped rules.");
  }

  const config = loadConfig(process.cwd());
  const mode = resolveMode(options);
  const runConfig: RunConfig = {
    mode,
    iterations: RUN_MODE_ITERATIONS[mode],
    timeout: config.timeout,
    seed: parseSeed(options.seed),
    verbose: false,
  };

  const testsDir = path.join(storeDir, "tests");
  await fs.mkdir(testsDir, { recursive: true });

  const isPython = targetPath.endsWith(".py");
  const generated = isPython
    ? generateHypothesisTest(runnable, targetPath, testsDir, runConfig)
    : generateFastCheckTest(runnable, targetPath, testsDir, runConfig);

  const testFilePath = path.join(testsDir, generated.fileName);
  await fs.writeFile(testFilePath, generated.content, "utf8");

  const fastCheckGenerated = !isPython ? generated as { needsMtsCopy?: boolean; copyExt?: string } : null;
  const result = isPython
    ? await runHypothesisTest(testFilePath, runnable, runConfig)
    : await runFastCheckTest(testFilePath, runnable, runConfig, {
        targetFile: targetPath,
        needsMtsCopy: fastCheckGenerated?.needsMtsCopy,
        copyExt: fastCheckGenerated?.copyExt,
      });

  return {
    ...result,
    skipped,
  };
}

async function buildQualitySummary(
  targetPath: string,
  source: string,
  properties: readonly PropertyDefinition[],
  storeDir: string,
): Promise<VerifyQualitySummary> {
  if (targetPath.endsWith(".py")) {
    return {
      supported: false,
      totalMutants: 0,
      killed: 0,
      survived: 0,
      errors: 0,
      mutationScore: 0,
      survivingMutants: [],
      duration: 0,
      note: "Mutation testing is currently JavaScript/TypeScript-only.",
    };
  }

  const report: MutationReport = await runMutationTesting(targetPath, source, properties, storeDir);
  return {
    supported: true,
    totalMutants: report.totalMutants,
    killed: report.killed,
    survived: report.survived,
    errors: report.errors,
    mutationScore: report.mutationScore,
    survivingMutants: report.survivingMutants.map((mutant) => mutant.description),
    duration: report.duration,
    note: report.totalMutants === 0 ? "No mutants generated for this file." : undefined,
  };
}

function buildRunSummary(result: ExecutionResult): VerifyRunSummary {
  return {
    totalProperties: result.properties.length,
    passedProperties: result.passed.length,
    failedProperties: result.failed.length,
    errorProperties: result.errors.length,
    skippedProperties: result.skipped.length,
    failedPropertyIds: result.failed.map((failure) => failure.propertyId),
    errorPropertyIds: result.errors.map((error) => error.propertyId),
    skippedPropertyIds: result.skipped.map((skip) => skip.propertyId),
    totalIterations: result.totalIterations,
    duration: result.duration,
  };
}

function buildRecommendations(report: VerifyReport): readonly string[] {
  const recommendations: string[] = [];

  if (report.run.failedProperties > 0 || report.run.errorProperties > 0) {
    recommendations.push(`Inspect failing properties with: propcheck run ${report.target}`);
  }
  if (report.quality.supported && report.quality.mutationScore < 0.8) {
    recommendations.push(`Strengthen properties with: propcheck quality ${report.target}`);
  }
  if (!report.quality.supported && report.quality.note) {
    recommendations.push(report.quality.note);
  }

  recommendations.push(...report.confidence.recommendations);

  return [...new Set(recommendations)].slice(0, 6);
}

function buildVerifyReport(
  target: string,
  options: VerifyOptions,
  execution: ExecutionResult,
  quality: VerifyQualitySummary,
  confidence: ConfidenceReport,
): VerifyReport {
  const runSummary = buildRunSummary(execution);
  const runOk = runSummary.failedProperties === 0 && runSummary.errorProperties === 0;
  const qualityOk = !quality.supported || quality.totalMutants === 0 || quality.mutationScore >= 0.8;
  const confidenceOk = exitCodeForConfidenceReport(confidence) === 0;
  const ok = runOk && qualityOk && confidenceOk;

  const status: VerifyReport["status"] = !runOk
    ? "failed"
    : ok
      ? "verified"
      : "needs_attention";

  const baseReport: VerifyReport = {
    target,
    mode: resolveMode(options),
    status,
    ok,
    formalVerification: {
      available: false,
      status: "not_attempted",
      reason: "SMT proofs are not implemented yet; verify v1 combines execution, mutation testing, and confidence signals.",
    },
    run: runSummary,
    quality,
    confidence,
    recommendations: [],
  };

  return {
    ...baseReport,
    recommendations: buildRecommendations(baseReport),
  };
}

function colorizeStatus(status: VerifyReport["status"]): (text: string) => string {
  switch (status) {
    case "verified":
      return chalk.green;
    case "failed":
      return chalk.red;
    default:
      return chalk.yellow;
  }
}

function printVerifyReport(report: VerifyReport): void {
  const statusColor = colorizeStatus(report.status);
  const qualityLabel = report.quality.supported
    ? `${(report.quality.mutationScore * 100).toFixed(1)}% mutation score | ${report.quality.killed}/${report.quality.totalMutants} killed`
    : `not available (${report.quality.note ?? "unsupported target"})`;

  console.log("");
  console.log(chalk.bold("  propcheck verify"));
  console.log("");
  console.log(`  Target      : ${report.target}`);
  console.log(`  Status      : ${statusColor(report.status.replaceAll("_", " ").toUpperCase())}`);
  console.log(`  Mode        : ${report.mode}`);
  console.log(`  Run         : ${report.run.passedProperties}/${report.run.totalProperties} passed | ${report.run.failedProperties} failed | ${report.run.errorProperties} errors | ${report.run.skippedProperties} skipped`);
  console.log(`  Quality     : ${report.quality.supported ? qualityLabel : chalk.yellow(qualityLabel)}`);
  console.log(`  Confidence  : Tier ${report.confidence.tier} | ${report.confidence.score}/100`);
  console.log(`  Coverage    : ${report.confidence.summary.modules} module(s) | ${report.confidence.summary.staleModules} stale | ${report.confidence.summary.riskyProperties} risky | ${report.confidence.summary.missingModules} missing`);
  console.log(`  Formal      : ${chalk.dim(report.formalVerification.reason)}`);

  if (report.recommendations.length > 0) {
    console.log("");
    console.log(chalk.bold("  Next steps"));
    for (const recommendation of report.recommendations) {
      console.log(`    • ${recommendation}`);
    }
  }

  console.log("");
}

function exitCodeForVerifyReport(report: VerifyReport): number {
  return report.ok ? 0 : 1;
}

export async function verifyCommand(target: string, options: VerifyOptions): Promise<void> {
  if (options.quick && options.thorough) {
    console.error("\n  Error: --quick and --thorough cannot be used together.\n");
    process.exit(2);
  }

  let storeDir: string;
  let targetPath: string;
  let source: string;
  let properties: readonly PropertyDefinition[];
  let confidence: ConfidenceReport;

  try {
    [{ storeDir, targetPath, source, properties }, confidence] = await Promise.all([
      loadTargetContext(target),
      buildConfidenceReport(target),
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown verify error.";
    console.error(`\n  ${message}\n`);
    process.exit(2);
  }

  const execution = await runVerificationExecution(targetPath, storeDir, properties, options);
  const quality = await buildQualitySummary(targetPath, source, splitRunnableProperties(properties).runnable, storeDir);
  const report = buildVerifyReport(target, options, execution, quality, confidence);

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printVerifyReport(report);
  }

  process.exit(exitCodeForVerifyReport(report));
}
