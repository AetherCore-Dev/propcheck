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
  findSourceFiles,
} from "@propcheck/common";
import type { PropertySkip, RunConfig, PropertySet } from "@propcheck/common";

interface RunOptions {
  quick?: boolean;
  thorough?: boolean;
  seed?: string;
  json?: boolean;
  changed?: boolean;
  skip?: string;
  only?: string;
  includeQuarantined?: boolean;
  ignoreStale?: boolean;
}

function parseIdList(input: string | undefined): ReadonlySet<string> {
  return new Set(
    (input ?? "")
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean),
  );
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
    const changedResult = getChangedFiles(projectRoot);

    if (changedResult.status === "git_error") {
      console.error(`\n  Error: git is not available or this is not a git repository.`);
      console.error("  --changed mode requires a git repository.\n");
      process.exit(2);
    }

    const changedPaths = new Set(
      changedResult.files
        .map((f) => toForwardSlash(f.filePath))
        .filter((p) =>
          // Exclude internal files, build artifacts, and non-source files
          !p.startsWith(".propcheck/") &&
          !p.startsWith("node_modules/") &&
          !p.includes("/dist/") &&
          !p.includes("/dist-bundle/") &&
          /\.(ts|tsx|js|jsx|py)$/.test(p)
        ),
    );

    if (changedPaths.size === 0) {
      console.log("\n  No changes detected (git diff is clean).\n");
      process.exit(0);
    }

    const allSets = await getAllProperties(storeDir);
    propertySets = allSets.filter((ps) => changedPaths.has(ps.filePath));

    if (propertySets.length === 0) {
      console.log(`\n  No properties found for changed files: ${[...changedPaths].join(", ")}`);
      console.log("  Run: propcheck infer <file> first.\n");
      process.exit(2);
    }

    console.log(`\n  Running properties for ${propertySets.length} changed file(s)...\n`);
  } else if (target) {
    const targetPath = path.resolve(projectRoot, target);

    // Check if target is a directory — scan for source files
    let stat: import("node:fs").Stats;
    try {
      stat = await fs.stat(targetPath);
    } catch {
      console.error(`\n  Error: File not found: ${target}\n`);
      process.exit(2);
    }

    if (stat.isDirectory()) {
      // Directory mode: find all source files, match against stored properties
      const allSets = await getAllProperties(storeDir);
      const sourceFiles = findSourceFiles(targetPath);
      const sourceKeys = new Set(sourceFiles.map((f) => toForwardSlash(path.relative(projectRoot, f))));
      propertySets = allSets.filter((ps) => sourceKeys.has(ps.filePath));

      if (propertySets.length === 0) {
        console.error(`\n  No properties found for files in ${target}/`);
        console.error(`  Run: propcheck infer <file> on source files first.\n`);
        process.exit(2);
      }

      console.log(`\n  Running properties for ${propertySets.length} file(s) in ${target}/...\n`);
    } else {
      // Single file mode
      const moduleKey = toForwardSlash(path.relative(projectRoot, targetPath));
      const ps = await getProperties(storeDir, moduleKey);

      if (!ps) {
        // Show available files with properties for context
        const allSets = await getAllProperties(storeDir);
        if (allSets.length > 0) {
          console.error(`\n  No properties found for ${target}`);
          console.error(`\n  Files with properties:`);
          for (const s of allSets.slice(0, 5)) {
            console.error(`    • ${s.filePath} (${s.properties.length} properties)`);
          }
          if (allSets.length > 5) console.error(`    ... and ${allSets.length - 5} more`);
          console.error(`\n  Run: propcheck infer ${target}\n`);
        } else {
          console.error(`\n  No properties found. Run: propcheck infer ${target}\n`);
        }
        process.exit(2);
      }
      propertySets = [ps];
    }
  } else {
    propertySets = await getAllProperties(storeDir);
    if (propertySets.length === 0) {
      console.error("\n  No properties found. Run: propcheck infer <file>\n");
      process.exit(2);
    }
  }

  const skipIds = parseIdList(options.skip);
  const onlyIds = parseIdList(options.only);
  const hasOnlyFilter = onlyIds.size > 0;
  let exitCode = 0;
  let ranAnyProperties = false;

  for (const ps of propertySets) {
    const filePath = path.resolve(projectRoot, ps.filePath);

    // Check staleness
    if (!options.ignoreStale) {
      try {
        const currentSource = await fs.readFile(filePath, "utf8");
        const currentHash = hashContent(currentSource);
        if (ps.sourceHash !== currentHash) {
          console.log(`\n  Warning: ${ps.filePath} has changed since properties were inferred.`);
          console.log("  Properties may be outdated. Run: propcheck infer " + ps.filePath);
          console.log("  Or use --ignore-stale to suppress this warning.\n");
        }
      } catch {
        console.error(`\n  Warning: Cannot read ${ps.filePath} — file may have been moved.\n`);
      }
    }

    const explicitSkipped = ps.properties.filter((prop) => {
      if (skipIds.has(prop.id)) return true;
      return hasOnlyFilter && !onlyIds.has(prop.id);
    });
    const droppedSkipped = ps.properties.filter((prop) => (
      !explicitSkipped.includes(prop) &&
      prop.status === "dropped"
    ));
    const quarantinedSkipped = ps.properties.filter((prop) => (
      !explicitSkipped.includes(prop) &&
      !droppedSkipped.includes(prop) &&
      prop.status === "quarantined" &&
      !options.includeQuarantined
    ));
    const skipped: PropertySkip[] = [
      ...explicitSkipped.map((prop) => ({ propertyId: prop.id, reason: "filter" as const, propertyStatus: prop.status })),
      ...droppedSkipped.map((prop) => ({ propertyId: prop.id, reason: "dropped" as const, propertyStatus: prop.status })),
      ...quarantinedSkipped.map((prop) => ({ propertyId: prop.id, reason: "quarantined" as const, propertyStatus: prop.status })),
    ];
    const runnableProperties = ps.properties.filter((prop) => (
      !explicitSkipped.includes(prop) &&
      !droppedSkipped.includes(prop) &&
      !(prop.status === "quarantined" && !options.includeQuarantined)
    ));

    if (!options.json && !hasOnlyFilter && quarantinedSkipped.length > 0) {
      console.log(`  Skipping ${quarantinedSkipped.length} quarantined propert${quarantinedSkipped.length === 1 ? "y" : "ies"} in ${ps.filePath}. Use --include-quarantined to run them.`);
    }
    if (!options.json && !hasOnlyFilter && droppedSkipped.length > 0) {
      console.log(`  Skipping ${droppedSkipped.length} dropped propert${droppedSkipped.length === 1 ? "y" : "ies"} in ${ps.filePath}.`);
    }
    if (!options.json && !hasOnlyFilter && explicitSkipped.length > 0) {
      console.log(`  Skipping ${explicitSkipped.length} propert${explicitSkipped.length === 1 ? "y" : "ies"} in ${ps.filePath} due to --skip/--only filters.`);
    }

    if (runnableProperties.length === 0) {
      if (options.json) {
        console.log(reportAsJson({
          passed: [],
          failed: [],
          errors: [],
          skipped,
          duration: 0,
          totalIterations: 0,
          properties: [],
        }));
      }
      continue;
    }

    ranAnyProperties = true;

    // Generate test file — select engine based on file extension
    const testsDir = path.join(storeDir, "tests");
    await fs.mkdir(testsDir, { recursive: true });

    const isPython = ps.filePath.endsWith(".py");

    const generated = isPython
      ? generateHypothesisTest(runnableProperties, filePath, testsDir, runConfig)
      : generateFastCheckTest(runnableProperties, filePath, testsDir, runConfig);

    const testFilePath = path.join(testsDir, generated.fileName);
    await fs.writeFile(testFilePath, generated.content, "utf8");

    // Run tests
    const fcGenerated = !isPython ? generated as { needsMtsCopy?: boolean } : null;
    const result = isPython
      ? await runHypothesisTest(testFilePath, runnableProperties, runConfig)
      : await runFastCheckTest(testFilePath, runnableProperties, runConfig, {
          targetFile: filePath,
          needsMtsCopy: fcGenerated?.needsMtsCopy,
        });
    const enrichedResult = {
      ...result,
      skipped,
    };

    // Report
    if (options.json) {
      console.log(reportAsJson(enrichedResult, ps.filePath));
    } else {
      reportRunSummary(enrichedResult, ps.filePath);
    }

    if (result.failed.length > 0 || result.errors.length > 0) {
      exitCode = 1;
    }
  }

  if (!ranAnyProperties) {
    if (hasOnlyFilter) {
      // --only filter matched nothing — likely a typo, exit 2 to signal CI
      const requested = [...onlyIds].join(", ");
      if (!options.json) {
        console.error(`\n  No properties matched --only filter: ${requested}`);
        console.error("  Check property IDs with: propcheck props\n");
      }
      process.exit(2);
    }
    if (!options.json) {
      console.log("\n  No runnable properties remain after applying status and CLI filters.\n");
    }
  }

  process.exit(exitCode);
}
