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
import { analyzeFile, detectLanguage, analyzePythonFile } from "@propcheck/parser";
import {
  inferProperties,
  createClient,
  classifyProperties,
  buildFeedbackSummary,
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

interface InferOptions {
  mock?: boolean;
  model?: string;
  provider?: string;
  baseUrl?: string;
  maxProperties?: string;
  minScore?: string;
  skipValidation?: boolean;
  refine?: boolean;
  function?: string;
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
      if (fn.returnType?.includes(typeName)) {
        referenced.add(typeName);
      }
      for (const param of fn.parameters) {
        if (param.type?.includes(typeName)) {
          referenced.add(typeName);
        }
      }
      if (fn.docstring?.includes(typeName)) {
        referenced.add(typeName);
      }
    }
  }

  return referenced;
}

/**
 * Trim source code to only include import lines, matched function bodies,
 * and referenced type definitions. Non-contiguous blocks are separated
 * by `// ... (trimmed)` markers.
 */
function trimSourceCode(
  fullSource: string,
  matchedFunctions: readonly FunctionSignature[],
  referencedTypes: readonly TypeDefinition[],
): string {
  const lines = fullSource.split("\n");

  // Collect all line ranges to include (1-indexed)
  const ranges: Array<[number, number]> = [];

  // Import block: lines from 1 up to the first function/type startLine
  const allStarts = [
    ...matchedFunctions.map((f) => f.loc.startLine),
    ...referencedTypes.map((t) => t.loc.startLine),
  ];
  if (allStarts.length > 0) {
    const firstDeclLine = Math.min(...allStarts);
    if (firstDeclLine > 1) {
      ranges.push([1, firstDeclLine - 1]);
    }
  }

  // Function bodies
  for (const fn of matchedFunctions) {
    ranges.push([fn.loc.startLine, fn.loc.endLine]);
  }

  // Referenced type definitions
  for (const t of referencedTypes) {
    ranges.push([t.loc.startLine, t.loc.endLine]);
  }

  if (ranges.length === 0) return fullSource;

  // Sort by startLine, merge overlapping/adjacent ranges
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [ranges[0]];
  for (let i = 1; i < ranges.length; i++) {
    const prev = merged[merged.length - 1];
    const curr = ranges[i];
    if (curr[0] <= prev[1] + 1) {
      prev[1] = Math.max(prev[1], curr[1]);
    } else {
      merged.push(curr);
    }
  }

  // Extract lines and join with separator
  const parts: string[] = [];
  for (const [start, end] of merged) {
    const s = Math.max(0, start - 1); // convert to 0-indexed
    const e = Math.min(lines.length, end); // exclusive upper bound
    parts.push(lines.slice(s, e).join("\n"));
  }

  return parts.join("\n\n// ... (trimmed)\n\n");
}

/** Match a user-provided function name against a FunctionSignature. */
function matchesFunctionName(fn: FunctionSignature, name: string): boolean {
  return (
    fn.name === name ||
    fn.qualifiedName === name ||
    fn.qualifiedName.endsWith("." + name)
  );
}

/**
 * Filter an AnalysisContext to only include the specified functions,
 * their referenced types, and trimmed source code.
 */
function filterContextByFunctions(
  context: AnalysisContext,
  functionNames: string[],
): AnalysisContext {
  // 1. Match functions
  const matchedFunctions = context.functions.filter((fn) =>
    functionNames.some((name) => matchesFunctionName(fn, name)),
  );

  // 2. Find referenced types
  const refTypeNames = findReferencedTypeNames(matchedFunctions, context.types);
  const matchedTypes = context.types.filter((t) => refTypeNames.has(t.name));

  // 3. Trim source code
  const trimmedSource = trimSourceCode(
    context.sourceCode,
    matchedFunctions,
    matchedTypes,
  );

  // 4. Filter signals
  const matchedQualNames = new Set(matchedFunctions.map((f) => f.qualifiedName));
  const matchedNames = new Set(matchedFunctions.map((f) => f.name));

  const filteredDoc = context.signals.doc.filter(
    (d) => matchedQualNames.has(d.functionName) || matchedNames.has(d.functionName),
  );
  const filteredType = context.signals.type.filter(
    (t) => matchedQualNames.has(t.functionName) || matchedNames.has(t.functionName),
  );

  return {
    filePath: context.filePath,
    language: context.language,
    sourceCode: trimmedSource,
    functions: matchedFunctions,
    types: matchedTypes,
    imports: context.imports,
    signals: {
      ast: context.signals.ast,
      type: filteredType,
      doc: filteredDoc,
    },
  };
}

export async function inferCommand(
  target: string,
  options: InferOptions,
): Promise<void> {
  const projectRoot = process.cwd();

  // Load config
  const config = loadConfig(projectRoot, {
    mock: options.mock,
    model: options.model,
    provider: options.provider as "anthropic" | "openai-compatible" | undefined,
    baseURL: options.baseUrl,
  });

  // Resolve target with path traversal protection — BEFORE config validation
  // so "file not found" is shown instead of "API key missing"
  const targetPath = path.resolve(projectRoot, target);
  if (!targetPath.startsWith(projectRoot + path.sep) && targetPath !== projectRoot) {
    console.error(`\n  Error: Target file must be within the project root.\n`);
    process.exit(2);
  }

  // Check if target is a directory — recurse into source files
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
      const relPath = path.relative(projectRoot, filePath);
      await inferCommand(relPath, options);
    }
    return;
  }

  // Detect language early — before config validation
  const language = detectLanguage(targetPath);
  if (!isSupportedLanguage(language)) {
    console.error(`\n  Error: Unsupported file type. Supported: .ts, .tsx, .js, .jsx, .py\n`);
    process.exit(2);
  }

  // Validate config (API key etc.) — after file checks pass
  const errors = validateConfig(config, "infer");
  if (errors.length > 0) {
    for (const err of errors) {
      console.error(`\n  Error: ${err}\n`);
    }
    process.exit(2);
  }

  // Ensure .propcheck/ exists
  await initStore(projectRoot, config.storeDir);
  const storeDir = path.join(projectRoot, config.storeDir);

  // Guard against excessively large files (prevent unbounded API spend)
  const MAX_SOURCE_BYTES = 500_000;
  const stat = await fs.stat(targetPath);
  if (stat.size > MAX_SOURCE_BYTES) {
    console.error(`\n  Error: File too large (${stat.size} bytes). Max: ${MAX_SOURCE_BYTES} bytes.\n`);
    process.exit(2);
  }

  // Read and parse
  const source = await fs.readFile(targetPath, "utf8");
  const context: AnalysisContext = language === "python"
    ? analyzePythonFile(targetPath, source)
    : analyzeFile(targetPath, source, language);

  // Filter to specific functions if --function provided
  let inferContext = context;
  if (options.function) {
    const names = options.function.split(",").map((n) => n.trim()).filter(Boolean);

    // Validate all names exist
    const missing = names.filter(
      (name) => !context.functions.some((fn) => matchesFunctionName(fn, name)),
    );
    if (missing.length > 0) {
      const available = context.functions.map((fn) => fn.qualifiedName).join(", ");
      console.error(`\n  Error: Function(s) not found: ${missing.join(", ")}`);
      console.error(`  Available: ${available}\n`);
      process.exit(2);
    }

    inferContext = filterContextByFunctions(context, names);
  }

  if (inferContext.functions.length === 0) {
    console.log(`\n  No exported functions found in ${target}\n`);
    return;
  }

  console.log(`\n  Analyzing ${inferContext.functions.length} function${inferContext.functions.length === 1 ? "" : "s"} in ${target}...`);

  // Parse and validate numeric options
  const maxPropsRaw = parseInt(options.maxProperties ?? "5", 10);
  if (options.maxProperties !== undefined && isNaN(maxPropsRaw)) {
    console.error(`\n  Error: --max-properties must be a number, got "${options.maxProperties}"\n`);
    process.exit(2);
  }
  const maxProperties = Math.min(Math.max(1, maxPropsRaw || 5), 20);

  const minScoreRaw = parseInt(options.minScore ?? "10", 10);
  if (options.minScore !== undefined && isNaN(minScoreRaw)) {
    console.error(`\n  Error: --min-score must be a number, got "${options.minScore}"\n`);
    process.exit(2);
  }
  const minScore = Math.min(Math.max(0, minScoreRaw || 10), 15);

  // Infer properties
  let result;
  try {
    result = await inferProperties(config.apiKey, config.model, inferContext, {
      maxProperties,
      minScore,
      mock: config.mock,
      provider: config.provider,
      baseURL: config.baseURL,
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

  result = {
    ...result,
    properties: applyRiskMetadata(result.properties, inferContext),
  };

  if (result.properties.length === 0) {
    console.log("  No properties inferred (all filtered out by quality scoring).\n");
    return;
  }

  // Trial-run validation with self-repair
  let finalProperties = result.properties;
  if (!options.skipValidation) {
    const testsDir = await ensureTestsDir(storeDir);

    console.log(`  Validating ${result.properties.length} rules (quick test, 100 random inputs each)...`);

    // Create LLM client for self-repair (reuse same config)
    const llmClient = config.mock
      ? null
      : config.apiKey
        ? createClient(config.apiKey, config.model, config.provider, config.baseURL)
        : null;

    const { validated, dropped, repaired } = await trialRunValidation(
      result.properties,
      targetPath,
      storeDir,
      source,
      llmClient,
      config.mock,
      language,
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
      validated,
      targetPath,
      storeDir,
      language,
    );

    if (quarantined.length > 0) {
      console.log(`  Quarantined ${quarantined.length} fragile propert${quarantined.length === 1 ? "y" : "ies"} after edge-case validation:`);
      for (const { prop, reason } of quarantined) {
        console.log(`    - ${prop.targetFunction}: ${prop.description} [${reason.length > 80 ? reason.slice(0, 77) + "..." : reason}]`);
      }
    }

    finalProperties = [...canaryValidated, ...quarantined.map(({ prop }) => prop)];

    if (finalProperties.length === 0) {
      console.log("  No properties survived validation.\n");
      return;
    }

    const activeProperties = finalProperties.filter((property) => property.status !== "quarantined");

    // Refinement loop (Round 2) — strengthen weak properties, explore bug areas
    if (options.refine && activeProperties.length > 0) {
      console.log(`\n  Refinement Round 2: analyzing ${activeProperties.length} properties...`);

      // Run a full execution to classify
      const fullConfig: RunConfig = { mode: "quick", iterations: 100, timeout: 15_000, verbose: false };
      const execResult = await executeTrialRun(
        activeProperties,
        targetPath,
        testsDir,
        fullConfig,
        language,
      );

      // Classify results
      const classifications = classifyProperties(activeProperties, execResult);
      const functionNames = inferContext.functions.map((f) => f.qualifiedName);
      const feedback = buildFeedbackSummary(classifications, functionNames);

      const strong = classifications.filter((c) => c.kind === "strong");
      const weak = classifications.filter((c) => c.kind === "weak");
      const bugs = classifications.filter((c) => c.kind === "bug_found");

      console.log(`    Strong: ${strong.length} | Weak: ${weak.length} | Bugs: ${bugs.length}`);

      // Generate improved properties for weak/bug cases
      if (weak.length > 0 || bugs.length > 0) {
        let improvedProperties: readonly PropertyDefinition[];

        if (config.mock) {
          improvedProperties = applyRiskMetadata(mockRefineProperties(classifications), inferContext);
        } else if (llmClient) {
          const refineResult = await refineProperties(config.apiKey, config.model, inferContext, feedback, {
            maxProperties,
            minScore,
            mock: false,
            provider: config.provider,
            baseURL: config.baseURL,
          });
          improvedProperties = applyRiskMetadata(refineResult.properties, inferContext);
        } else {
          improvedProperties = [];
        }

        if (improvedProperties.length > 0) {
          console.log(`    Generated ${improvedProperties.length} improved properties`);

          // Validate improved properties with trial-run
          const { validated: improvedValidated } = await trialRunValidation(
            improvedProperties,
            targetPath,
            storeDir,
            source,
            llmClient,
            config.mock,
            language,
          );
          const { validated: improvedCanaryValidated, quarantined: improvedQuarantined } = await canaryValidateProperties(
            improvedValidated,
            targetPath,
            storeDir,
            language,
          );

          // Merge: keep strong originals + replace weak with improved + keep bug-finders
          const strongProps = classifications
            .filter((c) => c.kind === "strong" || c.kind === "bug_found")
            .map((c) => c.property);

          const quarantinedProps = finalProperties.filter((property) => property.status === "quarantined");

          // Deduplicate by assertion
          const existingAssertions = new Set(strongProps.map((p) => p.assertion));
          const improvedCombined = [...improvedCanaryValidated, ...improvedQuarantined.map(({ prop }) => prop)];
          const newUnique = improvedCombined.filter((p) => !existingAssertions.has(p.assertion));

          finalProperties = [...strongProps, ...newUnique, ...quarantinedProps];
          console.log(`    Final: ${finalProperties.length} properties after refinement`);
        }
      } else {
        console.log(`    All properties are strong — no refinement needed`);
      }
    }
  }

  // Persist to .propcheck/
  const moduleKey = toForwardSlash(path.relative(projectRoot, targetPath));
  const propertySet: PropertySet = {
    schemaVersion: 2,
    module: moduleKey,
    filePath: moduleKey,
    properties: finalProperties,
    sourceHash: hashContent(source),
    inferredAt: new Date().toISOString(),
  };

  await setProperties(storeDir, moduleKey, propertySet);

  // Report (use finalProperties count, not original)
  const finalResult = { ...result, properties: finalProperties };
  reportInferResult(finalResult, moduleKey);
}
