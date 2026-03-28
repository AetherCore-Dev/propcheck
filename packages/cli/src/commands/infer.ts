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
import { inferProperties, createLlmClient, createMockClient, repairProperty, mockRepairProperty, classifyProperties, buildFeedbackSummary, mockRefineProperties } from "@propcheck/llm";
import type { LlmClient } from "@propcheck/llm";
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
  refine?: boolean;
}

/**
 * Trial-run validation with self-repair: quick-execute inferred properties,
 * and attempt to fix compile/runtime errors up to 3 times.
 *
 * Flow per property:
 *   100/100 PASS → KEEP
 *   FAIL (counterexample found) → KEEP (found a bug!)
 *   ERROR (compile/runtime) → REPAIR up to 3 rounds → KEEP if fixed, DROP if not
 */
const MAX_REPAIR_ROUNDS = 3;

async function trialRunValidation(
  properties: readonly PropertyDefinition[],
  targetPath: string,
  storeDir: string,
  sourceCode: string,
  llmClient: LlmClient | null,
  isMock: boolean,
): Promise<{ readonly validated: readonly PropertyDefinition[]; readonly dropped: readonly { prop: PropertyDefinition; reason: string }[]; readonly repaired: number }> {
  const testsDir = path.join(storeDir, "tests");
  await fs.mkdir(testsDir, { recursive: true });

  const trialConfig: RunConfig = {
    mode: "quick",
    iterations: 100,
    timeout: 15_000,
    verbose: false,
  };

  // Mutable working set — properties that may be repaired across rounds
  let currentProperties = [...properties];
  const validated: PropertyDefinition[] = [];
  const dropped: { prop: PropertyDefinition; reason: string }[] = [];
  let totalRepaired = 0;

  for (let round = 0; round <= MAX_REPAIR_ROUNDS; round++) {
    if (currentProperties.length === 0) break;

    // Generate and run tests for current batch
    const generated = generateFastCheckTest(currentProperties, targetPath, testsDir, trialConfig);
    const testFilePath = path.join(testsDir, generated.fileName);
    await fs.writeFile(testFilePath, generated.content, "utf8");

    const result = await runFastCheckTest(testFilePath, currentProperties, trialConfig);

    // Clean up trial test file
    try { await fs.unlink(testFilePath); } catch { /* ignore */ }

    // Classify results
    const passedIds = new Set(result.passed.map((p) => p.propertyId));
    const failedIds = new Set(result.failed.map((f) => f.propertyId));
    const errorIds = new Set(result.errors.map((e) => e.propertyId));

    const needsRepair: PropertyDefinition[] = [];

    for (const prop of currentProperties) {
      if (passedIds.has(prop.id)) {
        validated.push(prop);
      } else if (failedIds.has(prop.id)) {
        // Found a real bug — keep it
        validated.push(prop);
      } else if (errorIds.has(prop.id)) {
        const err = result.errors.find((e) => e.propertyId === prop.id);
        const errorMsg = err?.errorMessage ?? "unknown error";

        if (round < MAX_REPAIR_ROUNDS) {
          // Attempt repair
          const funcSig = `${prop.targetFunction}(...)`;

          let repaired: PropertyDefinition | null = null;

          if (isMock) {
            repaired = mockRepairProperty(prop, errorMsg);
          } else if (llmClient) {
            repaired = await repairProperty(llmClient, prop, errorMsg, sourceCode, funcSig);
          }

          if (repaired) {
            // Use repaired version for next round
            needsRepair.push(repaired);
            totalRepaired++;
            console.log(`    ↻ Repairing: ${prop.targetFunction}: ${prop.description} (round ${round + 1})`);
          } else {
            // Repair failed — drop
            dropped.push({ prop, reason: `codegen error (repair failed round ${round + 1}): ${errorMsg.slice(0, 60)}` });
          }
        } else {
          // Max rounds reached — drop
          dropped.push({ prop, reason: `codegen error (max ${MAX_REPAIR_ROUNDS} repairs): ${errorMsg.slice(0, 60)}` });
        }
      } else {
        // No result at all
        dropped.push({ prop, reason: "no output from trial run" });
      }
    }

    // Next round only processes properties that needed repair
    currentProperties = needsRepair;
  }

  return { validated, dropped, repaired: totalRepaired };
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

  // Resolve target with path traversal protection
  const targetPath = path.resolve(projectRoot, target);
  if (!targetPath.startsWith(projectRoot + path.sep) && targetPath !== projectRoot) {
    console.error(`\n  Error: Target file must be within the project root.\n`);
    process.exit(2);
  }

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

  if (context.functions.length === 0) {
    console.log(`\n  No exported functions found in ${target}\n`);
    return;
  }

  console.log(`\n  Analyzing ${context.functions.length} functions in ${target}...`);

  // Parse options once with clamped bounds
  const maxProperties = Math.min(Math.max(1, parseInt(options.maxProperties ?? "5", 10) || 5), 20);
  const minScore = Math.min(Math.max(0, parseInt(options.minScore ?? "10", 10) || 10), 15);

  // Infer properties
  const result = await inferProperties(config.apiKey, config.model, context, {
    maxProperties,
    minScore,
    mock: config.mock,
  });

  if (result.properties.length === 0) {
    console.log("  No properties inferred (all filtered out by quality scoring).\n");
    return;
  }

  // Trial-run validation with self-repair (skip for Python until Hypothesis adapter is integrated)
  let finalProperties = result.properties;
  if (!options.skipValidation && language !== "python") {
    const testsDir = path.join(storeDir, "tests");
    await fs.mkdir(testsDir, { recursive: true });

    console.log(`  Validating ${result.properties.length} properties (trial run, 100 iterations)...`);

    // Create LLM client for self-repair (reuse same config)
    const llmClient = config.mock
      ? null
      : config.apiKey
        ? createLlmClient(config.apiKey, config.model)
        : null;

    const { validated, dropped, repaired } = await trialRunValidation(
      result.properties,
      targetPath,
      storeDir,
      source,
      llmClient,
      config.mock,
    );

    if (repaired > 0) {
      console.log(`  Self-repaired ${repaired} properties.`);
    }

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

    // Refinement loop (Round 2) — strengthen weak properties, explore bug areas
    if (options.refine && finalProperties.length > 0) {
      console.log(`\n  Refinement Round 2: analyzing ${finalProperties.length} properties...`);

      // Run a full execution to classify
      const fullConfig: RunConfig = { mode: "quick", iterations: 100, timeout: 15_000, verbose: false };
      const execGenerated = generateFastCheckTest(finalProperties, targetPath, testsDir, fullConfig);
      const execTestPath = path.join(testsDir, execGenerated.fileName);
      await fs.writeFile(execTestPath, execGenerated.content, "utf8");
      const execResult = await runFastCheckTest(execTestPath, finalProperties, fullConfig);
      try { await fs.unlink(execTestPath); } catch { /* ignore */ }

      // Classify results
      const classifications = classifyProperties(finalProperties, execResult);
      const functionNames = context.functions.map((f) => f.qualifiedName);
      const feedback = buildFeedbackSummary(classifications, functionNames);

      const strong = classifications.filter((c) => c.kind === "strong");
      const weak = classifications.filter((c) => c.kind === "weak");
      const bugs = classifications.filter((c) => c.kind === "bug_found");

      console.log(`    Strong: ${strong.length} | Weak: ${weak.length} | Bugs: ${bugs.length}`);

      // Generate improved properties for weak/bug cases
      if (weak.length > 0 || bugs.length > 0) {
        let improvedProperties: readonly PropertyDefinition[];

        if (config.mock) {
          improvedProperties = mockRefineProperties(classifications);
        } else if (llmClient) {
          // Real LLM refinement: re-infer with feedback context
          const refineResult = await inferProperties(config.apiKey, config.model, context, {
            maxProperties,
            minScore,
            mock: false,
          });
          improvedProperties = refineResult.properties;
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
          );

          // Merge: keep strong originals + replace weak with improved + keep bug-finders
          const strongProps = classifications
            .filter((c) => c.kind === "strong" || c.kind === "bug_found")
            .map((c) => c.property);

          // Deduplicate by assertion
          const existingAssertions = new Set(strongProps.map((p) => p.assertion));
          const newUnique = improvedValidated.filter((p) => !existingAssertions.has(p.assertion));

          finalProperties = [...strongProps, ...newUnique];
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
