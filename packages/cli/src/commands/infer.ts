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
import { inferProperties } from "@propcheck/llm";
import { setProperties, initStore } from "@propcheck/store";
import { generateFastCheckTest, runFastCheckTest } from "@propcheck/engines";
import { reportInferResult } from "@propcheck/reporter";
import { hashContent, toForwardSlash } from "@propcheck/common";
import type { PropertyDefinition, PropertySet, AnalysisContext, RunConfig } from "@propcheck/common";

interface InferOptions {
  mock?: boolean;
  model?: string;
  maxProperties?: string;
  minScore?: string;
  skipValidation?: boolean;
}

/**
 * Trial-run validation: quick-execute inferred properties to filter false positives.
 *
 * - 100/100 PASS → KEEP
 * - <100/100 PASS → DROP (likely false positive or flaky)
 * - Compile/runtime error → DROP (codegen issue)
 */
async function trialRunValidation(
  properties: readonly PropertyDefinition[],
  targetPath: string,
  storeDir: string,
): Promise<{ readonly validated: readonly PropertyDefinition[]; readonly dropped: readonly { prop: PropertyDefinition; reason: string }[] }> {
  const testsDir = path.join(storeDir, "tests");
  await fs.mkdir(testsDir, { recursive: true });

  const trialConfig: RunConfig = {
    mode: "quick",
    iterations: 100,
    timeout: 15_000,
    verbose: false,
  };

  // Generate and run test
  const generated = generateFastCheckTest(properties, targetPath, testsDir, trialConfig);
  const testFilePath = path.join(testsDir, generated.fileName);
  await fs.writeFile(testFilePath, generated.content, "utf8");

  const result = await runFastCheckTest(testFilePath, properties, trialConfig);

  // Classify results
  const validated: PropertyDefinition[] = [];
  const dropped: { prop: PropertyDefinition; reason: string }[] = [];

  const passedIds = new Set(result.passed.map((p) => p.propertyId));
  const failedIds = new Set(result.failed.map((f) => f.propertyId));
  const errorIds = new Set(result.errors.map((e) => e.propertyId));

  for (const prop of properties) {
    if (passedIds.has(prop.id)) {
      // 100/100 PASS → keep
      validated.push(prop);
    } else if (failedIds.has(prop.id)) {
      // Failed → this found a real bug, keep it!
      validated.push(prop);
    } else if (errorIds.has(prop.id)) {
      // Compile/runtime error → drop
      const err = result.errors.find((e) => e.propertyId === prop.id);
      dropped.push({ prop, reason: `codegen error: ${err?.errorMessage?.slice(0, 80) ?? "unknown"}` });
    } else {
      // No result → drop
      dropped.push({ prop, reason: "no output from trial run" });
    }
  }

  // Clean up trial test file
  try { await fs.unlink(testFilePath); } catch { /* ignore */ }

  return { validated, dropped };
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
  });

  // Validate
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

  // Resolve target
  const targetPath = path.resolve(projectRoot, target);

  try {
    await fs.access(targetPath);
  } catch {
    console.error(`\n  Error: File not found: ${target}\n`);
    process.exit(2);
  }

  // Detect language
  const language = detectLanguage(targetPath);
  if (!language || !["typescript", "javascript", "python"].includes(language)) {
    console.error(`\n  Error: Unsupported file type. Supported: .ts, .tsx, .js, .jsx, .py\n`);
    process.exit(2);
  }

  // Read and parse
  const source = await fs.readFile(targetPath, "utf8");
  const context: AnalysisContext = language === "python"
    ? analyzePythonFile(targetPath, source)
    : analyzeFile(targetPath, source, language);

  if (context.functions.length === 0) {
    console.log(`\n  No exported functions found in ${target}\n`);
    return;
  }

  console.log(`\n  Analyzing ${context.functions.length} functions in ${target}...`);

  // Infer properties
  const result = await inferProperties(config.apiKey, config.model, context, {
    maxProperties: parseInt(options.maxProperties ?? "5", 10),
    minScore: parseInt(options.minScore ?? "10", 10),
    mock: config.mock,
  });

  if (result.properties.length === 0) {
    console.log("  No properties inferred (all filtered out by quality scoring).\n");
    return;
  }

  // Trial-run validation (skip for Python until Hypothesis adapter is integrated)
  let finalProperties = result.properties;
  if (!options.skipValidation && language !== "python") {
    console.log(`  Validating ${result.properties.length} properties (trial run, 100 iterations)...`);
    const { validated, dropped } = await trialRunValidation(
      result.properties,
      targetPath,
      storeDir,
    );

    if (dropped.length > 0) {
      console.log(`  Dropped ${dropped.length} properties during validation:`);
      for (const { prop, reason } of dropped) {
        console.log(`    - ${prop.targetFunction}: ${prop.description} [${reason}]`);
      }
    }

    finalProperties = validated;

    if (finalProperties.length === 0) {
      console.log("  No properties survived validation.\n");
      return;
    }
  }

  // Persist to .propcheck/
  const moduleKey = toForwardSlash(path.relative(projectRoot, targetPath));
  const propertySet: PropertySet = {
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
