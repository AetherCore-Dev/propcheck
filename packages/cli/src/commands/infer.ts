/**
 * propcheck infer — parse code and infer properties using LLM.
 *
 * Pipeline:
 * 1. Load config (API key check)
 * 2. Parse target file(s) → AnalysisContext
 * 3. LLM.inferProperties(context)
 * 4. Trial-run validation — quick run 100x to filter false positives
 * 5. Store.setProperties(module, propertySet)
 * 6. Reporter.reportInferResult(result)
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { loadConfig, validateConfig } from "@propcheck/config";
import { analyzeFile, detectLanguage, analyzePythonFile, parseSpecText } from "@propcheck/parser";
import {
  inferProperties,
  createClient,
  classifyProperties,
  buildFeedbackSummary,
  shouldAutoRefine,
  mockRefineProperties,
  refineProperties,
} from "@propcheck/llm";
import type { LlmClient } from "@propcheck/llm";
import { setProperties, initStore } from "@propcheck/store";
import { reportInferResult } from "@propcheck/reporter";
import { hashContent, toForwardSlash, findSourceFiles } from "@propcheck/common";
import { applyRiskMetadata } from "./infer/weakening";
import {
  ensureTestsDir,
  executeTrialRun,
  canaryValidateProperties,
  trialRunValidation,
} from "./infer/validation";
import type { TrialRunLanguage } from "./infer/validation";
import { confirmProperties } from "./infer/confirm";
import { expandGeneratorRanges, hasExpandableRanges } from "@propcheck/llm";
// Re-export for external consumers (tests, other commands)
export { autoWeakenProperty } from "./infer/weakening";
export { canaryValidateProperties } from "./infer/validation";
import type {
  PropertyDefinition,
  PropertySet,
  AnalysisContext,
  FunctionSignature,
  TypeDefinition,
  RunConfig,
} from "@propcheck/common";
import type { InferResult } from "@propcheck/llm";

interface InferOptions {
  mock?: boolean;
  model?: string;
  provider?: string;
  baseUrl?: string;
  cliCommand?: string;
  cliArgs?: string;
  maxProperties?: string;
  minScore?: string;
  skipValidation?: boolean;
  refine?: boolean;
  function?: string;
  spec?: string;
  confirm?: boolean;
}

/** Parsed and validated numeric options. */
interface ParsedNumericOptions {
  readonly maxProperties: number;
  readonly minScore: number;
}

function isSupportedLanguage(lang: string | null): lang is TrialRunLanguage {
  return lang === "typescript" || lang === "javascript" || lang === "python";
}

// ---------------------------------------------------------------------------
// --function helpers: filter AnalysisContext to specific functions
// ---------------------------------------------------------------------------

/**
 * Detect which type names are referenced by the given functions
 * (in parameter types, return type, or docstrings).
 */
function findReferencedTypeNames(
  functions: readonly FunctionSignature[],
  allTypes: readonly TypeDefinition[],
): Set<string> {
  const typeNames = new Set(allTypes.map((t) => t.name));
  const referenced = new Set<string>();

  for (const fn of functions) {
    for (const typeName of typeNames) {
      if (fn.returnType?.includes(typeName)) referenced.add(typeName);
      for (const param of fn.parameters) {
        if (param.type?.includes(typeName)) referenced.add(typeName);
      }
      if (fn.docstring?.includes(typeName)) referenced.add(typeName);
    }
  }

  return referenced;
}

/**
 * Trim source code to only include import lines, matched function bodies,
 * and referenced type definitions.
 */
function trimSourceCode(
  fullSource: string,
  matchedFunctions: readonly FunctionSignature[],
  referencedTypes: readonly TypeDefinition[],
): string {
  const lines = fullSource.split("\n");
  const ranges: Array<[number, number]> = [];

  const allStarts = [
    ...matchedFunctions.map((f) => f.loc.startLine),
    ...referencedTypes.map((t) => t.loc.startLine),
  ];
  if (allStarts.length > 0) {
    const firstDeclLine = Math.min(...allStarts);
    if (firstDeclLine > 1) ranges.push([1, firstDeclLine - 1]);
  }

  for (const fn of matchedFunctions) ranges.push([fn.loc.startLine, fn.loc.endLine]);
  for (const t of referencedTypes) ranges.push([t.loc.startLine, t.loc.endLine]);

  if (ranges.length === 0) return fullSource;

  ranges.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [ranges[0]];
  for (let i = 1; i < ranges.length; i++) {
    const last = merged[merged.length - 1];
    const curr = ranges[i];
    if (curr[0] <= last[1] + 1) {
      merged[merged.length - 1] = [last[0], Math.max(last[1], curr[1])];
    } else {
      merged.push(curr);
    }
  }

  const parts: string[] = [];
  for (const [start, end] of merged) {
    const s = Math.max(0, start - 1);
    const e = Math.min(lines.length, end);
    parts.push(lines.slice(s, e).join("\n"));
  }

  return parts.join("\n\n// ... (trimmed)\n\n");
}

/** Match a user-provided function name against a FunctionSignature. */
function matchesFunctionName(fn: FunctionSignature, name: string): boolean {
  return fn.name === name || fn.qualifiedName === name || fn.qualifiedName.endsWith("." + name);
}

/** Filter an AnalysisContext to only the specified functions. */
function filterContextByFunctions(
  context: AnalysisContext,
  functionNames: string[],
): AnalysisContext {
  const matchedFunctions = context.functions.filter((fn) =>
    functionNames.some((name) => matchesFunctionName(fn, name)),
  );
  const refTypeNames = findReferencedTypeNames(matchedFunctions, context.types);
  const matchedTypes = context.types.filter((t) => refTypeNames.has(t.name));
  const trimmedSource = trimSourceCode(context.sourceCode, matchedFunctions, matchedTypes);

  const matchedQualNames = new Set(matchedFunctions.map((f) => f.qualifiedName));
  const matchedNames = new Set(matchedFunctions.map((f) => f.name));

  return {
    filePath: context.filePath,
    language: context.language,
    sourceCode: trimmedSource,
    functions: matchedFunctions,
    types: matchedTypes,
    imports: context.imports,
    ...(context.spec
      ? {
          spec: {
            ...context.spec,
            functions: context.spec.functions.filter(
              (signal) => matchedQualNames.has(signal.functionName) || matchedNames.has(signal.functionName),
            ),
          },
        }
      : {}),
    signals: {
      ast: context.signals.ast,
      type: context.signals.type.filter(
        (t) => matchedQualNames.has(t.functionName) || matchedNames.has(t.functionName),
      ),
      doc: context.signals.doc.filter(
        (d) => matchedQualNames.has(d.functionName) || matchedNames.has(d.functionName),
      ),
    },
  };
}

function findSiblingFunctions(
  context: AnalysisContext,
  inferContext: AnalysisContext,
): readonly FunctionSignature[] {
  const inferredFunctions = new Set(inferContext.functions.map((fn) => fn.qualifiedName));
  return context.functions.filter((fn) => !inferredFunctions.has(fn.qualifiedName));
}

// ---------------------------------------------------------------------------
// Decomposed pipeline stages
// ---------------------------------------------------------------------------

/** Resolve and validate the target path; handle directory recursion. */
async function resolveTarget(
  target: string,
  projectRoot: string,
  options: InferOptions,
): Promise<{ targetPath: string; language: TrialRunLanguage } | null> {
  const targetPath = path.resolve(projectRoot, target);
  const relToRoot = path.relative(projectRoot, targetPath);
  if (relToRoot.startsWith("..") || path.isAbsolute(relToRoot)) {
    console.error(`\n  Error: Target file must be within the project root.\n`);
    process.exit(2);
  }

  let targetStat: import("node:fs").Stats;
  try {
    targetStat = await fs.stat(targetPath);
  } catch {
    console.error(`\n  Error: File not found: ${target}\n`);
    process.exit(2);
  }

  if (targetStat.isDirectory()) {
    const sourceFiles = findSourceFiles(targetPath);
    if (sourceFiles.length === 0) {
      console.error(`\n  No source files found in ${target}/\n`);
      process.exit(2);
    }
    console.log(`\n  Found ${sourceFiles.length} source file(s) in ${target}/\n`);
    for (const filePath of sourceFiles) {
      await inferCommand(path.relative(projectRoot, filePath), options);
    }
    return null; // directory handled via recursion
  }

  // Guard against excessively large files (before reading into memory)
  const MAX_SOURCE_BYTES = 500_000;
  if (targetStat.size > MAX_SOURCE_BYTES) {
    console.error(`\n  Error: File too large (${targetStat.size} bytes). Max: ${MAX_SOURCE_BYTES} bytes.\n`);
    process.exit(2);
  }

  const language = detectLanguage(targetPath);
  if (!isSupportedLanguage(language)) {
    console.error(`\n  Error: Unsupported file type. Supported: .ts, .tsx, .js, .jsx, .py\n`);
    process.exit(2);
  }

  return { targetPath, language };
}

async function loadSpecContext(
  projectRoot: string,
  options: InferOptions,
  context: AnalysisContext,
): Promise<AnalysisContext> {
  if (!options.spec) {
    return context;
  }

  const specPath = path.resolve(projectRoot, options.spec);
  let rawText: string;
  try {
    rawText = await fs.readFile(specPath, "utf8");
  } catch {
    console.error(`\n  Error: Spec file not found: ${options.spec}\n`);
    process.exit(2);
  }

  const spec = parseSpecText(
    specPath,
    rawText,
    [...new Set(context.functions.flatMap((fn) => [fn.qualifiedName, fn.name]))],
  );

  return {
    ...context,
    spec,
  };
}

/** Parse numeric CLI options with validation. */
function parseNumericOptions(options: InferOptions): ParsedNumericOptions {
  const maxPropsRaw = Number(options.maxProperties ?? "5");
  if (options.maxProperties !== undefined && (!Number.isInteger(maxPropsRaw) || maxPropsRaw < 1)) {
    console.error(`\n  Error: --max-properties must be an integer (1-20), got "${options.maxProperties}"\n`);
    process.exit(2);
  }

  const minScoreRaw = Number(options.minScore ?? "10");
  if (options.minScore !== undefined && (!Number.isInteger(minScoreRaw) || minScoreRaw < 0)) {
    console.error(`\n  Error: --min-score must be an integer (0-13), got "${options.minScore}"\n`);
    process.exit(2);
  }

  return {
    maxProperties: Math.min(Math.max(1, maxPropsRaw), 20),
    minScore: Math.min(Math.max(0, minScoreRaw), 13),
  };
}

/** Call the LLM to infer properties, with error handling. */
async function runLlmInference(
  config: ReturnType<typeof loadConfig>,
  inferContext: AnalysisContext,
  numericOpts: ParsedNumericOptions,
  siblingFunctions: readonly FunctionSignature[],
): Promise<InferResult> {
  try {
    return await inferProperties(config.apiKey, config.model, inferContext, {
      maxProperties: numericOpts.maxProperties,
      minScore: numericOpts.minScore,
      mock: config.mock,
      provider: config.provider,
      baseURL: config.baseURL,
      cliCommand: config.cliCommand,
      cliArgs: config.cliArgs,
      siblingFunctions,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("API key") || msg.includes("AUTH_ERROR")) {
      console.error(`\n  Error: Invalid API key. Check your PROPCHECK_API_KEY or ANTHROPIC_API_KEY.\n`);
    } else {
      console.error(`\n  Error: LLM API call failed: ${msg}\n`);
    }
    process.exit(1);
  }
}

/** Run trial-run, canary validation, and optional refinement. */
async function runValidationPipeline(
  properties: readonly PropertyDefinition[],
  targetPath: string,
  storeDir: string,
  source: string,
  language: TrialRunLanguage,
  config: ReturnType<typeof loadConfig>,
  inferContext: AnalysisContext,
  numericOpts: ParsedNumericOptions,
  options: InferOptions,
  siblingFunctions: readonly FunctionSignature[],
): Promise<readonly PropertyDefinition[]> {
  const testsDir = await ensureTestsDir(storeDir);

  console.log(`  Validating ${properties.length} rules (quick test, 100 random inputs each)...`);

  const llmClient = config.mock
    ? null
    : config.apiKey || config.provider === "cli"
      ? createClient(config.apiKey, config.model, config.provider, config.baseURL,
          config.provider === "cli" && config.cliCommand
            ? { command: config.cliCommand, args: config.cliArgs ?? undefined }
            : undefined)
      : null;

  const { validated, dropped, repaired } = await trialRunValidation(
    properties, targetPath, storeDir, source, llmClient, config.mock, language,
  );

  if (repaired > 0) {
    console.log(`  Fixed ${repaired} rule${repaired === 1 ? "" : "s"} that ${repaired === 1 ? "was" : "were"} too strict.`);
  }
  if (dropped.length > 0) {
    console.log(`  Dropped ${dropped.length} properties during validation:`);
    for (const { prop, reason } of dropped) {
      console.log(`    - ${prop.targetFunction}: ${prop.description} [${reason}]`);
    }
  }

  const { validated: canaryValidated, quarantined } = await canaryValidateProperties(
    validated, targetPath, storeDir, language,
  );

  if (quarantined.length > 0) {
    console.log(`  Quarantined ${quarantined.length} fragile propert${quarantined.length === 1 ? "y" : "ies"} after edge-case validation:`);
    for (const { prop, reason } of quarantined) {
      console.log(`    - ${prop.targetFunction}: ${prop.description} [${reason.length > 80 ? reason.slice(0, 77) + "..." : reason}]`);
    }
  }

  let finalProperties = [...canaryValidated, ...quarantined.map(({ prop }) => prop)];

  if (finalProperties.length === 0) return finalProperties;

  // Boundary expansion: test properties with wider generator ranges to find boundary-sensitive bugs
  const expandable = finalProperties.filter((p) => p.status !== "quarantined" && hasExpandableRanges(p));
  let boundaryBugs = 0;
  if (expandable.length > 0) {
    const expansionConfig: RunConfig = { mode: "quick", iterations: 100, timeout: 15_000, verbose: false };
    for (const prop of expandable) {
      const expanded = expandGeneratorRanges(prop);
      try {
        const result = await executeTrialRun([expanded], targetPath, testsDir, expansionConfig, language);
        if (result.failed.length > 0) {
          // Property fails with wider range — this is a boundary-sensitive finding!
          // Mark the property with expanded generators so `run` will use the wider range
          const idx = finalProperties.indexOf(prop);
          if (idx >= 0) {
            finalProperties[idx] = expanded;
            boundaryBugs++;
          }
        }
      } catch {
        // Engine error during expansion test — skip, keep original range
      }
    }
    if (boundaryBugs > 0) {
      console.log(`  Expanded generator ranges for ${boundaryBugs} propert${boundaryBugs === 1 ? "y" : "ies"} to test beyond documented boundaries.`);
    }
  }

  // Refinement Round 2 — auto-triggered when quality issues detected, or via --refine
  const shouldRefineAuto = !config.mock && llmClient && (() => {
    const active = finalProperties.filter((p) => p.status !== "quarantined");
    const weak = active.filter((p) => p.score < 12 || p.confidence < 0.7);
    const strong = active.filter((p) => !weak.includes(p));
    // Build classifications that match shouldAutoRefine's expected shape
    const classifications = [
      ...weak.map((p) => ({ kind: "weak" as const, property: p, reason: "low score or confidence" })),
      ...strong.map((p) => ({ kind: "strong" as const, property: p })),
    ];
    return shouldAutoRefine(classifications, dropped.length);
  })();
  const shouldRefine = options.refine || shouldRefineAuto;

  if (shouldRefine && llmClient) {
    console.log(`  Auto-triggering Round 2 refinement (quality issues detected)...`);
    finalProperties = [...await runRefinementLoop(
      finalProperties, targetPath, storeDir, testsDir, source,
      language, config, inferContext, numericOpts, llmClient, siblingFunctions,
      { filteredCount: dropped.length, boundaryFailures: boundaryBugs },
    )];
  } else if (options.refine) {
    finalProperties = [...await runRefinementLoop(
      finalProperties, targetPath, storeDir, testsDir, source,
      language, config, inferContext, numericOpts, llmClient, siblingFunctions,
      { filteredCount: dropped.length, boundaryFailures: boundaryBugs },
    )];
  }

  return finalProperties;
}

/** Run refinement Round 2 — strengthen weak properties. */
async function runRefinementLoop(
  finalProperties: readonly PropertyDefinition[],
  targetPath: string,
  storeDir: string,
  testsDir: string,
  source: string,
  language: TrialRunLanguage,
  config: ReturnType<typeof loadConfig>,
  inferContext: AnalysisContext,
  numericOpts: ParsedNumericOptions,
  llmClient: LlmClient | null,
  siblingFunctions: readonly FunctionSignature[],
  feedbackOpts: { filteredCount?: number; boundaryFailures?: number } = {},
): Promise<readonly PropertyDefinition[]> {
  const activeProperties = finalProperties.filter((p) => p.status !== "quarantined");
  if (activeProperties.length === 0) return finalProperties;

  console.log(`\n  Refinement Round 2: analyzing ${activeProperties.length} properties...`);

  const fullConfig: RunConfig = { mode: "quick", iterations: 100, timeout: 15_000, verbose: false };
  const execResult = await executeTrialRun(activeProperties, targetPath, testsDir, fullConfig, language);

  const classifications = classifyProperties(activeProperties, execResult);
  const functionNames = inferContext.functions.map((f) => f.qualifiedName);
  const feedback = buildFeedbackSummary(classifications, functionNames, feedbackOpts);

  const strong = classifications.filter((c) => c.kind === "strong");
  const weak = classifications.filter((c) => c.kind === "weak");
  const bugs = classifications.filter((c) => c.kind === "bug_found");

  console.log(`    Strong: ${strong.length} | Weak: ${weak.length} | Bugs: ${bugs.length}`);

  if (weak.length === 0 && bugs.length === 0) {
    console.log(`    All properties are strong — no refinement needed`);
    return finalProperties;
  }

  const improvedProperties = await generateImprovedProperties(
    classifications, config, inferContext, numericOpts, feedback, llmClient, siblingFunctions,
  );

  if (improvedProperties.length === 0) return finalProperties;

  console.log(`    Generated ${improvedProperties.length} improved properties`);

  // Validate improved properties
  const { validated: improvedValidated } = await trialRunValidation(
    improvedProperties, targetPath, storeDir, source, llmClient, config.mock, language,
  );
  const { validated: improvedCanaryValidated, quarantined: improvedQuarantined } = await canaryValidateProperties(
    improvedValidated, targetPath, storeDir, language,
  );

  // Merge: strong originals + unique improved + quarantined
  const strongProps = classifications
    .filter((c) => c.kind === "strong" || c.kind === "bug_found")
    .map((c) => c.property);
  const quarantinedProps = finalProperties.filter((p) => p.status === "quarantined");

  const existingAssertions = new Set(strongProps.map((p) => p.assertion));
  const improvedCombined = [...improvedCanaryValidated, ...improvedQuarantined.map(({ prop }) => prop)];
  const newUnique = improvedCombined.filter((p) => !existingAssertions.has(p.assertion));

  const merged = [...strongProps, ...newUnique, ...quarantinedProps];
  console.log(`    Final: ${merged.length} properties after refinement`);
  return merged;
}

/** Generate improved properties via mock or real LLM refinement. */
async function generateImprovedProperties(
  classifications: ReturnType<typeof classifyProperties>,
  config: ReturnType<typeof loadConfig>,
  inferContext: AnalysisContext,
  numericOpts: ParsedNumericOptions,
  feedback: string,
  llmClient: LlmClient | null,
  siblingFunctions: readonly FunctionSignature[],
): Promise<readonly PropertyDefinition[]> {
  if (config.mock) {
    return applyRiskMetadata(mockRefineProperties(classifications), inferContext);
  }
  if (llmClient) {
    const refineResult = await refineProperties(config.apiKey, config.model, inferContext, feedback, {
      maxProperties: numericOpts.maxProperties,
      minScore: numericOpts.minScore,
      mock: false,
      provider: config.provider,
      baseURL: config.baseURL,
      cliCommand: config.cliCommand,
      cliArgs: config.cliArgs,
      siblingFunctions,
    });
    return applyRiskMetadata(refineResult.properties, inferContext);
  }
  return [];
}

/** Apply interactive confirmation if --confirm is set. */
async function applyConfirmation(
  properties: readonly PropertyDefinition[],
  options: InferOptions,
): Promise<readonly PropertyDefinition[] | null> {
  if (!options.confirm || !process.stdin.isTTY) return properties;

  const { accepted, quarantined: userQuarantined, dropped } = await confirmProperties(properties);

  if (dropped.length > 0) {
    console.log(`  ${dropped.length} rule${dropped.length === 1 ? "" : "s"} dropped by user.`);
  }

  const merged = [...accepted, ...userQuarantined];
  if (merged.length === 0) {
    console.log("  All rules dropped. Nothing to save.\n");
    return null;
  }
  return merged;
}

/** Persist properties and print report. */
async function persistAndReport(
  properties: readonly PropertyDefinition[],
  result: InferResult,
  targetPath: string,
  storeDir: string,
  source: string,
  projectRoot: string,
): Promise<void> {
  const moduleKey = toForwardSlash(path.relative(projectRoot, targetPath));
  const propertySet: PropertySet = {
    schemaVersion: 2,
    module: moduleKey,
    filePath: moduleKey,
    properties,
    sourceHash: hashContent(source),
    inferredAt: new Date().toISOString(),
  };

  await setProperties(storeDir, moduleKey, propertySet);

  const finalResult = { ...result, properties };
  reportInferResult(finalResult, moduleKey);
}

// ---------------------------------------------------------------------------
// Main command
// ---------------------------------------------------------------------------

export async function inferCommand(
  target: string,
  options: InferOptions,
): Promise<void> {
  const projectRoot = process.cwd();

  // Load config
  const config = loadConfig(projectRoot, {
    mock: options.mock,
    model: options.model,
    provider: options.provider as "anthropic" | "openai-compatible" | "cli" | undefined,
    baseURL: options.baseUrl,
    cliCommand: options.cliCommand,
    cliArgs: options.cliArgs ? options.cliArgs.split(",").map(s => s.trim()) : undefined,
  });

  // Resolve target (handles directory recursion)
  const resolved = await resolveTarget(target, projectRoot, options);
  if (!resolved) return; // directory handled via recursion
  const { targetPath, language } = resolved;

  // Validate config (API key etc.)
  const errors = validateConfig(config, "infer");
  if (errors.length > 0) {
    for (const err of errors) console.error(`\n  Error: ${err}\n`);
    process.exit(2);
  }

  // Warn if --mock is used but a real API key is present
  if (config.mock && config.apiKey) {
    console.log("  Note: --mock mode active. API key is set but will not be used.\n");
  }

  // Ensure .propcheck/ exists
  await initStore(projectRoot, config.storeDir);
  const storeDir = path.join(projectRoot, config.storeDir);

  // Read and parse source
  const source = await fs.readFile(targetPath, "utf8");
  const parsedContext: AnalysisContext = language === "python"
    ? analyzePythonFile(targetPath, source)
    : analyzeFile(targetPath, source, language);
  const context = await loadSpecContext(projectRoot, options, parsedContext);

  // Filter to specific functions if --function provided
  const inferContext = applyFunctionFilter(context, options);
  if (!inferContext) return;
  const siblingFunctions = findSiblingFunctions(context, inferContext);

  console.log(`\n  Analyzing ${inferContext.functions.length} function${inferContext.functions.length === 1 ? "" : "s"} in ${target}...`);

  // Parse numeric options
  const numericOpts = parseNumericOptions(options);

  // Infer properties via LLM
  let result = await runLlmInference(config, inferContext, numericOpts, siblingFunctions);
  result = { ...result, properties: applyRiskMetadata(result.properties, inferContext) };

  if (result.properties.length === 0) {
    console.log("  No properties inferred (all filtered out by quality scoring).\n");
    return;
  }

  // Validate properties
  let finalProperties = options.skipValidation
    ? result.properties
    : await runValidationPipeline(
        result.properties, targetPath, storeDir, source, language,
        config, inferContext, numericOpts, options, siblingFunctions,
      );

  if (finalProperties.length === 0) {
    console.log("  No properties survived validation.\n");
    return;
  }

  // Interactive confirmation
  const confirmed = await applyConfirmation(finalProperties, options);
  if (!confirmed) return;
  finalProperties = confirmed;

  // Persist and report
  await persistAndReport(finalProperties, result, targetPath, storeDir, source, projectRoot);
}

/** Format a function signature for display (e.g. "add(a: number, b: number): number"). */
function formatFunctionSignature(fn: FunctionSignature): string {
  const params = fn.parameters
    .map((p) => {
      let s = p.isRest ? `...${p.name}` : p.name;
      if (p.isOptional && !p.isRest) s += "?";
      if (p.type) s += `: ${p.type}`;
      return s;
    })
    .join(", ");
  const ret = fn.returnType ? `: ${fn.returnType}` : "";
  const prefix = fn.isAsync ? "async " : "";
  return `${prefix}${fn.name}(${params})${ret}`;
}

/** Apply --function filter; returns null if no functions to analyze. */
function applyFunctionFilter(
  context: AnalysisContext,
  options: InferOptions,
): AnalysisContext | null {
  let inferContext = context;

  if (options.function) {
    const names = options.function.split(",").map((n) => n.trim()).filter(Boolean);
    const missing = names.filter(
      (name) => !context.functions.some((fn) => matchesFunctionName(fn, name)),
    );
    if (missing.length > 0) {
      console.error(`\n  Error: Function(s) not found: ${missing.join(", ")}`);
      console.error(`  Available exported functions:`);
      for (const fn of context.functions) {
        console.error(`    • ${formatFunctionSignature(fn)}`);
      }
      console.error();
      process.exit(2);
    }
    inferContext = filterContextByFunctions(context, names);
  }

  if (inferContext.functions.length === 0) {
    console.log(`\n  No exported functions found in ${context.filePath}\n`);
    return null;
  }

  return inferContext;
}
