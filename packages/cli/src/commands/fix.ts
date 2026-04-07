/**
 * propcheck fix — auto-fix property violations using dual-agent LLM architecture.
 *
 * Flow:
 * 1. Load properties and run them to find violations
 * 2. Diagnose each violation (Tester Agent): is it a real bug or false positive?
 * 3. Generate fix (Generator Agent): minimal source code change
 * 4. Verify: re-run ALL properties against fixed source
 * 5. Present diff for review (or apply with --apply)
 */

import * as fs from "node:fs";
import * as fsPromises from "node:fs/promises";
import * as crypto from "node:crypto";
import * as path from "node:path";
import { loadConfig, validateConfig } from "@propcheck/config";
import { getProperties } from "@propcheck/store";
import {
  generateFastCheckTest,
  runFastCheckTest,
} from "@propcheck/engines";
import {
  hashContent,
  toForwardSlash,
  RUN_MODE_ITERATIONS,
} from "@propcheck/common";
import type {
  PropertyDefinition,
  PropertyFailure,
  Diagnosis,
  RunConfig,
  ExecutionResult,
} from "@propcheck/common";
import {
  createClient,
  diagnoseViolation,
  generateFix,
  mockDiagnoseViolation,
  mockGenerateFix,
} from "@propcheck/llm";
import type { LlmClient, FixResult } from "@propcheck/llm";

interface FixOptions {
  mock?: boolean;
  model?: string;
  provider?: string;
  baseUrl?: string;
  apply?: boolean;
  property?: string;
  maxAttempts?: string;
  json?: boolean;
}

// ---------------------------------------------------------------------------
// Diff generation (inline, no external dependency)
// ---------------------------------------------------------------------------

interface DiffLine {
  type: "add" | "remove" | "context";
  content: string;
  oldLine?: number;
  newLine?: number;
}

function computeDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  const result: DiffLine[] = [];

  // Simple LCS-based diff
  const m = oldLines.length;
  const n = newLines.length;

  // Build LCS table
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to produce diff
  const ops: Array<{ type: "equal" | "delete" | "insert"; oldIdx?: number; newIdx?: number }> = [];
  let i = m;
  let j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      ops.unshift({ type: "equal", oldIdx: i - 1, newIdx: j - 1 });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.unshift({ type: "insert", newIdx: j - 1 });
      j--;
    } else {
      ops.unshift({ type: "delete", oldIdx: i - 1 });
      i--;
    }
  }

  // Convert ops to DiffLines with line numbers
  let oldLineNum = 1;
  let newLineNum = 1;
  for (const op of ops) {
    switch (op.type) {
      case "equal":
        result.push({ type: "context", content: oldLines[op.oldIdx!], oldLine: oldLineNum, newLine: newLineNum });
        oldLineNum++;
        newLineNum++;
        break;
      case "delete":
        result.push({ type: "remove", content: oldLines[op.oldIdx!], oldLine: oldLineNum });
        oldLineNum++;
        break;
      case "insert":
        result.push({ type: "add", content: newLines[op.newIdx!], newLine: newLineNum });
        newLineNum++;
        break;
    }
  }

  return result;
}

function formatDiff(diff: DiffLine[], filePath: string): string {
  // Only show changed regions with 3 lines of context
  const CONTEXT = 3;
  const lines: string[] = [];
  const changed = diff.map((d, i) => d.type !== "context" ? i : -1).filter((i) => i >= 0);

  if (changed.length === 0) return "  No changes.\n";

  lines.push(`  --- a/${filePath}`);
  lines.push(`  +++ b/${filePath}`);

  let lastEnd = -1;
  for (const idx of changed) {
    const start = Math.max(0, idx - CONTEXT);
    const end = Math.min(diff.length - 1, idx + CONTEXT);

    if (start <= lastEnd) continue; // Already covered in previous hunk

    // Find hunk boundaries
    let hunkStart = start;
    let hunkEnd = end;
    for (const other of changed) {
      if (other >= start && other <= end + CONTEXT) {
        hunkEnd = Math.min(diff.length - 1, other + CONTEXT);
      }
    }

    if (hunkStart > lastEnd + 1 && lastEnd >= 0) {
      lines.push("  ...");
    }

    for (let k = hunkStart; k <= hunkEnd; k++) {
      const d = diff[k];
      switch (d.type) {
        case "add":
          lines.push(`  + ${d.content}`);
          break;
        case "remove":
          lines.push(`  - ${d.content}`);
          break;
        case "context":
          lines.push(`    ${d.content}`);
          break;
      }
    }

    lastEnd = hunkEnd;
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Main fix command
// ---------------------------------------------------------------------------

export async function fixCommand(
  target: string,
  options: FixOptions,
): Promise<void> {
  const projectRoot = process.cwd();
  const config = loadConfig(projectRoot, {
    mock: options.mock ?? false,
    model: options.model,
    provider: options.provider as "anthropic" | "openai-compatible" | undefined,
    baseURL: options.baseUrl,
  });

  // Resolve target — BEFORE config validation so "file not found" is shown first
  const targetPath = path.resolve(projectRoot, target);
  if (!fs.existsSync(targetPath)) {
    console.error(`\n  Error: File not found: ${target}\n`);
    process.exit(2);
  }

  // Guard against excessively large files (prevent unbounded API spend)
  const MAX_SOURCE_BYTES = 500_000;
  const fileStat = fs.statSync(targetPath);
  if (fileStat.size > MAX_SOURCE_BYTES) {
    console.error(`\n  Error: File too large (${fileStat.size} bytes). Max: ${MAX_SOURCE_BYTES} bytes.\n`);
    process.exit(2);
  }

  // Validate config (API key etc.) — after file check passes
  const errors = validateConfig(config, "fix");
  if (errors.length > 0) {
    for (const err of errors) {
      console.error(`\n  Error: ${err}`);
    }
    console.error();
    process.exit(2);
  }

  // Validate numeric options early (before expensive work)
  const maxAttemptsRaw = Number(options.maxAttempts ?? "3");
  if (options.maxAttempts !== undefined && (!Number.isInteger(maxAttemptsRaw) || maxAttemptsRaw < 1)) {
    console.error(`\n  Error: --max-attempts must be an integer (1-5), got "${options.maxAttempts}"\n`);
    process.exit(2);
  }
  const maxAttempts = Math.min(Math.max(1, maxAttemptsRaw), 5);

  const moduleKey = toForwardSlash(path.relative(projectRoot, targetPath));
  const storeDir = path.join(projectRoot, config.storeDir);

  // Load properties
  const propertySet = await getProperties(storeDir, moduleKey);
  if (!propertySet || propertySet.properties.length === 0) {
    console.error(`\n  No properties found for ${target}`);
    console.error(`  Run: propcheck infer ${target}\n`);
    process.exit(2);
  }

  // Read source
  const sourceCode = await fsPromises.readFile(targetPath, "utf8");
  const language = targetPath.endsWith(".py") ? "python" : "typescript";

  // Filter to non-dropped/non-quarantined properties
  const activeProperties = propertySet.properties.filter(
    (p) => p.status !== "dropped" && p.status !== "quarantined",
  );

  if (activeProperties.length === 0) {
    console.error(`\n  No active properties for ${target} (all quarantined/dropped)\n`);
    process.exit(2);
  }

  // Step 1: Run properties to find failures
  console.log(`\n  Running ${activeProperties.length} properties for ${target}...`);

  const runConfig: RunConfig = {
    mode: "default",
    iterations: RUN_MODE_ITERATIONS.default,
    timeout: config.timeout,
    verbose: false,
  };

  const testsDir = path.join(storeDir, "tests");
  await fsPromises.mkdir(testsDir, { recursive: true });

  const generated = generateFastCheckTest(activeProperties, targetPath, testsDir, runConfig);
  const testFilePath = path.join(testsDir, generated.fileName);
  await fsPromises.writeFile(testFilePath, generated.content, "utf8");

  const execResult = await runFastCheckTest(testFilePath, activeProperties, runConfig, {
    targetFile: targetPath,
    needsMtsCopy: generated.needsMtsCopy,
  });

  // Filter to specific property if requested
  let failures = execResult.failed;
  if (options.property) {
    // First check if the property ID exists at all
    const propertyExists = activeProperties.some((p) => p.id === options.property);
    if (!propertyExists) {
      console.error(`\n  Property ${options.property} not found in ${target}`);
      console.error(`  Available properties: ${activeProperties.map((p) => p.id).join(", ")}\n`);
      process.exit(2);
    }

    failures = failures.filter((f) => f.propertyId === options.property);
    if (failures.length === 0) {
      console.log(`\n  Property ${options.property} is passing — nothing to fix.\n`);
      process.exit(0);
    }
  }

  if (failures.length === 0) {
    console.log(`\n  All ${activeProperties.length} properties pass — nothing to fix.\n`);
    process.exit(0);
  }

  console.log(`  Found ${failures.length} violation(s).\n`);

  // Step 2: Create LLM client
  const llmClient: LlmClient | null = config.mock
    ? null
    : createClient(config.apiKey!, config.model, config.provider, config.baseURL);

  // Step 3: Diagnose each violation
  console.log("  Diagnosing violations...");

  const diagnoses: Diagnosis[] = [];
  for (const failure of failures) {
    const property = activeProperties.find((p) => p.id === failure.propertyId);
    if (!property) continue;

    let diagnosis: Diagnosis | null;
    if (config.mock || !llmClient) {
      diagnosis = mockDiagnoseViolation(property, failure);
    } else {
      diagnosis = await diagnoseViolation(llmClient, sourceCode, property, failure, language);
    }

    if (diagnosis) {
      diagnoses.push(diagnosis);
      const icon = diagnosis.isBug ? "BUG" : "OK";
      console.log(`    [${icon}] ${failure.propertyId}: ${diagnosis.explanation.slice(0, 80)}`);
    } else {
      console.log(`    [???] ${failure.propertyId}: diagnosis failed`);
    }
  }

  const confirmedBugs = diagnoses.filter((d) => d.isBug);
  if (confirmedBugs.length === 0) {
    console.log(`\n  No real bugs found — all violations appear to be false positives.`);
    console.log("  Consider reviewing the property definitions.\n");

    if (options.json) {
      console.log(JSON.stringify({
        status: "no_bugs",
        diagnoses,
        failureCount: failures.length,
      }, null, 2));
    }
    process.exit(0);
  }

  console.log(`\n  ${confirmedBugs.length} confirmed bug(s). Generating fix...`);

  // Step 4 & 5: Generate fix with verification loop
  let bestFix: FixResult | null = null;
  let verificationResult: ExecutionResult | null = null;
  let retryFeedback: string | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (attempt > 1) {
      console.log(`  Retry attempt ${attempt}/${maxAttempts}...`);
    }

    // Generate fix
    let fix: FixResult | null;
    if (config.mock || !llmClient) {
      fix = mockGenerateFix(sourceCode, confirmedBugs);
    } else {
      fix = await generateFix(
        llmClient,
        sourceCode,
        confirmedBugs,
        activeProperties,
        failures,
        language,
        retryFeedback,
      );
    }

    if (!fix) {
      console.log(`  Fix generation failed (attempt ${attempt}/${maxAttempts})`);
      continue;
    }

    // Guard against oversized LLM responses
    const MAX_FIXED_SOURCE_BYTES = 1_000_000;
    if (Buffer.byteLength(fix.fixedSource, "utf8") > MAX_FIXED_SOURCE_BYTES) {
      console.error(`\n  Error: LLM fix response too large (${Buffer.byteLength(fix.fixedSource, "utf8")} bytes). Skipping.\n`);
      continue;
    }

    bestFix = fix;

    // Verify: write to temp, run all properties
    // Preserve original extension so codegen import paths resolve correctly
    const ext = path.extname(targetPath);                    // e.g. ".ts"
    const base = path.basename(targetPath, ext);             // e.g. "cart-buggy"
    const dir = path.dirname(targetPath);
    const tmpPath = path.join(dir, `${base}.fix.tmp.${crypto.randomBytes(4).toString("hex")}${ext}`);
    try {
      await fsPromises.writeFile(tmpPath, fix.fixedSource, "utf8");

      const verifyGenerated = generateFastCheckTest(
        activeProperties,
        tmpPath,
        testsDir,
        runConfig,
      );
      const verifyTestPath = path.join(testsDir, verifyGenerated.fileName);
      await fsPromises.writeFile(verifyTestPath, verifyGenerated.content, "utf8");

      verificationResult = await runFastCheckTest(
        verifyTestPath,
        activeProperties,
        runConfig,
        { targetFile: tmpPath, needsMtsCopy: verifyGenerated.needsMtsCopy },
      );

      // Clean up verify test file
      try { await fsPromises.unlink(verifyTestPath); } catch (e) {
        if (e instanceof Error && (e as NodeJS.ErrnoException).code !== "ENOENT") {
          console.warn(`  Warning: Failed to clean up ${verifyTestPath}: ${e.message}`);
        }
      }
    } finally {
      // Clean up temp source
      try { await fsPromises.unlink(tmpPath); } catch (e) {
        if (e instanceof Error && (e as NodeJS.ErrnoException).code !== "ENOENT") {
          console.warn(`  Warning: Failed to clean up ${tmpPath}: ${e.message}`);
        }
      }
    }

    if (verificationResult && verificationResult.failed.length === 0 && verificationResult.errors.length === 0) {
      console.log(`  Fix verified — all ${activeProperties.length} properties pass.\n`);
      break;
    }

    // Build retry feedback
    const newFailures = verificationResult.failed
      .map((f) => {
        const p = activeProperties.find((prop) => prop.id === f.propertyId);
        return `- ${f.propertyId} (${p?.targetFunction ?? "?"}): ${f.errorMessage.slice(0, 200)}`;
      })
      .join("\n");
    const newErrors = verificationResult.errors
      .map((e) => `- ${e.propertyId}: ${e.errorMessage.slice(0, 200)}`)
      .join("\n");

    retryFeedback = `Your fix broke ${verificationResult.failed.length} property/properties and caused ${verificationResult.errors.length} error(s):\n\n`;
    if (newFailures) retryFeedback += `Failures:\n${newFailures}\n\n`;
    if (newErrors) retryFeedback += `Errors:\n${newErrors}\n`;

    console.log(`  Verification failed: ${verificationResult.failed.length} failure(s), ${verificationResult.errors.length} error(s)`);
  }

  if (!bestFix) {
    console.error(`\n  Failed to generate a fix after ${maxAttempts} attempt(s).\n`);
    process.exit(1);
  }

  // Step 6: Present results
  const diff = computeDiff(sourceCode, bestFix.fixedSource);
  const hasChanges = diff.some((d) => d.type !== "context");

  if (!hasChanges) {
    console.log("  Generated fix is identical to the original — no changes needed.\n");
    process.exit(0);
  }

  const allPassed = verificationResult
    ? verificationResult.failed.length === 0 && verificationResult.errors.length === 0
    : false;

  if (options.json) {
    console.log(JSON.stringify({
      status: allPassed ? "fixed" : "partial",
      explanation: bestFix.explanation,
      changedFunctions: bestFix.changedFunctions,
      confidence: bestFix.confidence,
      diagnoses,
      verification: verificationResult
        ? {
            passed: verificationResult.passed.length,
            failed: verificationResult.failed.length,
            errors: verificationResult.errors.length,
          }
        : null,
      diff: formatDiff(diff, moduleKey),
    }, null, 2));
  } else {
    // Display diagnoses
    console.log("  Diagnoses:");
    for (const d of confirmedBugs) {
      const prop = activeProperties.find((p) => p.id === d.propertyId);
      console.log(`    [BUG] ${prop?.targetFunction ?? "?"}: ${d.explanation}`);
      if (d.suggestedFix) {
        console.log(`          Fix: ${d.suggestedFix}`);
      }
    }

    // Display diff
    console.log(`\n  Fix (${bestFix.changedFunctions.join(", ") || "source"}):\n`);
    console.log(formatDiff(diff, moduleKey));

    // Display explanation
    console.log(`\n  Explanation: ${bestFix.explanation}`);
    console.log(`  Confidence: ${(bestFix.confidence * 100).toFixed(0)}%`);

    // Verification status
    if (verificationResult) {
      const total = activeProperties.length;
      const passed = verificationResult.passed.length;
      if (allPassed) {
        console.log(`  Verification: ${passed}/${total} properties PASS`);
      } else {
        console.log(`  Verification: ${passed}/${total} pass, ${verificationResult.failed.length} fail, ${verificationResult.errors.length} error(s)`);
        console.log("  Warning: fix is partial — not all properties pass.");
      }
    }

    console.log();
  }

  // Apply if requested
  if (options.apply && allPassed) {
    // Create backup — don't overwrite existing .bak (preserve original)
    const baseBakPath = targetPath + ".bak";
    const backupPath = fs.existsSync(baseBakPath)
      ? `${targetPath}.bak.${Date.now()}`
      : baseBakPath;
    await fsPromises.writeFile(backupPath, sourceCode, "utf8");
    await fsPromises.writeFile(targetPath, bestFix.fixedSource, "utf8");
    if (!options.json) {
      console.log(`  Applied fix to ${target} (backup: ${path.basename(backupPath)})\n`);
    }
  } else if (!options.apply && allPassed && !options.json) {
    console.log(`  Run: propcheck fix ${target} --apply  to apply this fix\n`);
  }

  process.exit(allPassed ? 0 : 1);
}
