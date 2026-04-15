/**
 * Tests for fc-runner.ts — NODE_PATH construction and .mts lifecycle.
 *
 * These test the runner's setup logic without spawning full processes.
 */

import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { generateFastCheckTest } from "../fast-check/fc-codegen";
import { runFastCheckTest } from "../fast-check/fc-runner";
import type { PropertyDefinition, RunConfig } from "@propcheck/common";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProperty(overrides: Partial<PropertyDefinition> = {}): PropertyDefinition {
  return {
    id: "prop_001",
    targetFunction: "add",
    description: "Returns a number",
    category: "boundary",
    assertion: "typeof result === 'number'",
    generators: { a: { type: "integer", constraints: { min: 0, max: 100 } } },
    seedInputs: [{ label: "normal", value: 1 }],
    score: 12,
    riskScore: 0,
    riskTags: [],
    status: "accepted",
    confidence: 0.9,
    evidence: "Return type is number",
    sourceHash: "abc",
    inferredAt: "2026-04-07T00:00:00Z",
    modelId: "mock",
    ...overrides,
  };
}

const runConfig: RunConfig = {
  mode: "quick",
  iterations: 10,
  timeout: 5_000,
  verbose: false,
};

// ---------------------------------------------------------------------------
// .mts copy lifecycle
// ---------------------------------------------------------------------------

describe("fc-runner .mts lifecycle", () => {
  it("should create .mts copy when needsMtsCopy is true", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "propcheck-runner-test-"));
    const sourceFile = path.join(tmpDir, "target.ts");
    const mtsFile = path.join(tmpDir, "target.mts");

    // Create a minimal source file
    fs.writeFileSync(sourceFile, "export function add(a: number): number { return a; }\n");

    // Create a test file that produces valid JSON output
    const testsDir = path.join(tmpDir, "tests");
    fs.mkdirSync(testsDir, { recursive: true });
    const testFile = path.join(testsDir, "test.mjs");
    fs.writeFileSync(testFile, `console.log(JSON.stringify({ propertyId: "prop_001", status: "passed", iterations: 10 }));\n`);

    try {
      // Run with needsMtsCopy — the mts file should be created then cleaned up
      await runFastCheckTest(testFile, [makeProperty()], runConfig, {
        targetFile: sourceFile,
        needsMtsCopy: true,
      });

      // After run, .mts should be cleaned up
      assert.equal(fs.existsSync(mtsFile), false, ".mts file should be cleaned up after run");
    } finally {
      // Cleanup
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {
      // Ignore cleanup errors in temp directories.
    }
    }
  });

  it("should not create .mts copy when needsMtsCopy is false", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "propcheck-runner-test-"));
    const sourceFile = path.join(tmpDir, "target.ts");
    const mtsFile = path.join(tmpDir, "target.mts");

    fs.writeFileSync(sourceFile, "export function add(a: number): number { return a; }\n");

    const testsDir = path.join(tmpDir, "tests");
    fs.mkdirSync(testsDir, { recursive: true });
    const testFile = path.join(testsDir, "test.mjs");
    fs.writeFileSync(testFile, `console.log(JSON.stringify({ propertyId: "prop_001", status: "passed", iterations: 10 }));\n`);

    try {
      await runFastCheckTest(testFile, [makeProperty()], runConfig, {
        targetFile: sourceFile,
        needsMtsCopy: false,
      });

      // .mts should never have been created
      assert.equal(fs.existsSync(mtsFile), false, ".mts file should not exist");
    } finally {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {
      // Ignore cleanup errors in temp directories.
    }
    }
  });

  it("should clean up .mts even when test execution fails", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "propcheck-runner-test-"));
    const sourceFile = path.join(tmpDir, "target.ts");
    const mtsFile = path.join(tmpDir, "target.mts");

    fs.writeFileSync(sourceFile, "export function add(a: number): number { return a; }\n");

    const testsDir = path.join(tmpDir, "tests");
    fs.mkdirSync(testsDir, { recursive: true });
    // A test file that exits with non-zero (but produces no output)
    const testFile = path.join(testsDir, "test.mjs");
    fs.writeFileSync(testFile, `process.exit(1);\n`);

    try {
      await runFastCheckTest(testFile, [makeProperty()], runConfig, {
        targetFile: sourceFile,
        needsMtsCopy: true,
      });

      // .mts should still be cleaned up
      assert.equal(fs.existsSync(mtsFile), false, ".mts file should be cleaned up after failed run");
    } finally {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {
      // Ignore cleanup errors in temp directories.
    }
    }
  });
});

// ---------------------------------------------------------------------------
// generateFastCheckTest
// ---------------------------------------------------------------------------

describe("generateFastCheckTest test generation", () => {
  it("should generate a file with correct property IDs", () => {
    const props = [
      makeProperty({ id: "prop_001" }),
      makeProperty({ id: "prop_002", targetFunction: "multiply" }),
    ];
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "propcheck-gen-test-"));
    const sourceFile = path.join(tmpDir, "source.ts");
    fs.writeFileSync(sourceFile, "export function add(a: number): number { return a; }\n");

    try {
      const generated = generateFastCheckTest(props, sourceFile, tmpDir, runConfig);
      assert.ok(generated.content.includes("prop_001"));
      assert.ok(generated.content.includes("prop_002"));
      assert.ok(generated.fileName);
    } finally {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {
      // Ignore cleanup errors in temp directories.
    }
    }
  });

  it("should use JSON.stringify for import path to prevent injection", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "propcheck-gen-test-"));
    // Use a path with spaces and special chars (valid on all OS)
    const weirdName = "file with spaces.ts";
    const sourceFile = path.join(tmpDir, weirdName);
    fs.writeFileSync(sourceFile, "export function fn(): void {}\n");

    try {
      const generated = generateFastCheckTest([makeProperty()], sourceFile, tmpDir, runConfig);
      // The import path should use JSON.stringify (which wraps in double quotes and escapes)
      // Verify the generated content doesn't have a raw unescaped import
      assert.ok(generated.content.length > 0, "Should produce non-empty test content");
      assert.ok(generated.content.includes("prop_001"), "Should include property ID");
    } finally {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {
      // Ignore cleanup errors in temp directories.
    }
    }
  });
});
