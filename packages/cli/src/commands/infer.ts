/**
 * propcheck infer — parse code and infer properties using LLM.
 *
 * Pipeline:
 * 1. Load config (API key check)
 * 2. Parse target file(s) → AnalysisContext
 * 3. LLM.inferProperties(context)
 * 4. Store.setProperties(module, propertySet)
 * 5. Reporter.reportInferResult(result)
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { loadConfig, validateConfig } from "@propcheck/config";
import { analyzeFile, detectLanguage, analyzePythonFile } from "@propcheck/parser";
import { inferProperties } from "@propcheck/llm";
import { setProperties, initStore } from "@propcheck/store";
import { reportInferResult } from "@propcheck/reporter";
import { hashContent, toForwardSlash } from "@propcheck/common";
import type { PropertySet, AnalysisContext } from "@propcheck/common";

interface InferOptions {
  mock?: boolean;
  model?: string;
  maxProperties?: string;
  minScore?: string;
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

  // Persist to .propcheck/
  const moduleKey = toForwardSlash(path.relative(projectRoot, targetPath));
  const propertySet: PropertySet = {
    module: moduleKey,
    filePath: moduleKey,
    properties: result.properties,
    sourceHash: hashContent(source),
    inferredAt: new Date().toISOString(),
  };

  await setProperties(storeDir, moduleKey, propertySet);

  // Report
  reportInferResult(result, moduleKey);
}
