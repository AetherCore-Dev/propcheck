/**
 * propcheck run — load properties and execute PBT.
 *
 * Pipeline:
 * 1. Load properties from .propcheck/properties.json
 * 2. Check staleness (warn if source changed)
 * 3. Generate fast-check test file
 * 4. Execute via Node.js
 * 5. Report results
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { loadConfig } from "@propcheck/config";
import {
  getProperties,
  getAllProperties,
} from "@propcheck/store";
import { generateFastCheckTest, runFastCheckTest, generateHypothesisTest, runHypothesisTest } from "@propcheck/engines";
import { reportRunSummary, reportAsJson } from "@propcheck/reporter";
import {
  hashContent,
  toForwardSlash,
  RUN_MODE_ITERATIONS,
  getChangedFiles,
} from "@propcheck/common";
import type { RunConfig, PropertySet } from "@propcheck/common";

interface RunOptions {
  quick?: boolean;
  thorough?: boolean;
  seed?: string;
  json?: boolean;
  changed?: boolean;
}

export async function runCommand(
  target: string | undefined,
  options: RunOptions,
): Promise<void> {
  const projectRoot = process.cwd();
  const config = loadConfig(projectRoot);
  const storeDir = path.join(projectRoot, config.storeDir);

  // Determine run mode
  const mode = options.quick ? "quick" : options.thorough ? "thorough" : "default";
  const runConfig: RunConfig = {
    mode,
    iterations: RUN_MODE_ITERATIONS[mode],
    timeout: config.timeout,
    seed: options.seed ? (Number.isNaN(parseInt(options.seed, 10)) ? undefined : parseInt(options.seed, 10)) : undefined,
    verbose: false,
  };

  // Load properties
  let propertySets: readonly PropertySet[];

  if (options.changed) {
    // --changed mode: only run properties for git-changed files
    const changedFiles = getChangedFiles(projectRoot);
    const changedPaths = new Set(changedFiles.map((f) => toForwardSlash(f.filePath)));

    if (changedPaths.size === 0) {
      console.log("\n  No changes detected (git diff is clean).\n");
      process.exit(0);
    }

    const allSets = await getAllProperties(storeDir);
    propertySets = allSets.filter((ps) => changedPaths.has(ps.filePath));

    if (propertySets.length === 0) {
      console.log(`\n  No properties found for changed files: ${[...changedPaths].join(", ")}`);
      console.log("  Run: propcheck infer <file> first.\n");
      process.exit(0);
    }

    console.log(`\n  Running properties for ${propertySets.length} changed file(s)...\n`);
  } else if (target) {
    const targetPath = path.resolve(projectRoot, target);
    const moduleKey = toForwardSlash(path.relative(projectRoot, targetPath));
    const ps = await getProperties(storeDir, moduleKey);

    if (!ps) {
      console.error(`\n  No properties found for ${target}`);
      console.error("  Run: propcheck infer " + target + "\n");
      process.exit(2);
    }
    propertySets = [ps];
  } else {
    propertySets = await getAllProperties(storeDir);
    if (propertySets.length === 0) {
      console.error("\n  No properties found. Run: propcheck infer <file>\n");
      process.exit(2);
    }
  }

  let exitCode = 0;

  for (const ps of propertySets) {
    const filePath = path.resolve(projectRoot, ps.filePath);

    // Check staleness
    try {
      const currentSource = await fs.readFile(filePath, "utf8");
      const currentHash = hashContent(currentSource);
      if (ps.sourceHash !== currentHash) {
        console.log(`\n  Warning: ${ps.filePath} has changed since properties were inferred.`);
        console.log("  Run: propcheck infer " + ps.filePath + " to re-infer.\n");
      }
    } catch {
      console.error(`\n  Warning: Cannot read ${ps.filePath} — file may have been moved.\n`);
    }

    // Generate test file — select engine based on file extension
    const testsDir = path.join(storeDir, "tests");
    await fs.mkdir(testsDir, { recursive: true });

    const isPython = ps.filePath.endsWith(".py");

    const generated = isPython
      ? generateHypothesisTest(ps.properties, filePath, testsDir, runConfig)
      : generateFastCheckTest(ps.properties, filePath, testsDir, runConfig);

    const testFilePath = path.join(testsDir, generated.fileName);
    await fs.writeFile(testFilePath, generated.content, "utf8");

    // Run tests
    const result = isPython
      ? await runHypothesisTest(testFilePath, ps.properties, runConfig)
      : await runFastCheckTest(testFilePath, ps.properties, runConfig);

    // Report
    if (options.json) {
      console.log(reportAsJson(result));
    } else {
      reportRunSummary(result, ps.filePath);
    }

    if (result.failed.length > 0 || result.errors.length > 0) {
      exitCode = 1;
    }
  }

  process.exit(exitCode);
}
