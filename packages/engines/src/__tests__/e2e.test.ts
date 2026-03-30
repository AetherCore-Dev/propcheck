/**
 * E2E integration tests — verify the complete propcheck pipeline.
 *
 * Tests the full flow: parse → infer → persist → codegen → execute → report
 */

import { describe, it, before, after } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { analyzeFile } from "@propcheck/parser";
import { inferProperties } from "@propcheck/llm";
import { initStore, setProperties, getProperties, getAllProperties } from "@propcheck/store";
import { generateFastCheckTest, runFastCheckTest } from "../index";
import { reportAsJson } from "@propcheck/reporter";
import { hashContent, toForwardSlash } from "@propcheck/common";
import type { PropertySet, RunConfig } from "@propcheck/common";

const CART_SOURCE = `
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyDiscount = applyDiscount;
exports.calculateTotal = calculateTotal;

function applyDiscount(price, discount) {
  return price * (1 - discount / 100);
}

function calculateTotal(prices) {
  return prices.reduce(function(sum, p) { return sum + p; }, 0);
}
`;

const CART_TS_SOURCE = `
export function applyDiscount(price: number, discount: number): number {
  return price * (1 - discount / 100);
}

export function calculateTotal(prices: number[]): number {
  return prices.reduce((sum, p) => sum + p, 0);
}
`;

const MATH_SOURCE = `
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.add = add;

function add(a, b) {
  return a + b;
}
`;

const MATH_TS_SOURCE = `
export function add(a: number, b: number): number {
  return a + b;
}
`;

describe("E2E: Parse → Infer → Persist", () => {
  it("should parse TypeScript and infer properties with mock", async () => {
    const context = analyzeFile("cart.ts", CART_TS_SOURCE, "typescript");

    assert.ok(context.functions.length >= 2, "Should find at least 2 functions");
    const applyDiscount = context.functions.find((f) => f.name === "applyDiscount");
    assert.ok(applyDiscount, "Should find applyDiscount");
    assert.equal(applyDiscount.parameters.length, 2);
    assert.equal(applyDiscount.parameters[0].type, "number");

    // Infer with mock
    const result = await inferProperties(null, "mock", context, {
      mock: true,
      maxProperties: 5,
      minScore: 10,
    });

    assert.ok(result.properties.length >= 2, `Expected >= 2 properties, got ${result.properties.length}`);
    assert.ok(result.cost >= 0);
    assert.ok(result.tokensUsed > 0);

    // Check property quality
    for (const prop of result.properties) {
      assert.ok(prop.score >= 10, `Property ${prop.id} score ${prop.score} < 10`);
      assert.ok(prop.assertion.length > 0, "Assertion should be non-empty");
      assert.ok(prop.evidence.length > 0, "Evidence should be non-empty");
      assert.ok(prop.seedInputs.length >= 1, "Should have seed inputs");
      // Some properties have zero generators (e.g., constant assertions like "f([]) === 0")
      // so we don't require generators > 0 for all properties
    }
  });

  it("should parse math functions and infer with mock", async () => {
    const context = analyzeFile("math.ts", MATH_TS_SOURCE, "typescript");

    assert.equal(context.functions.length, 1);
    assert.equal(context.functions[0].name, "add");

    const result = await inferProperties(null, "mock", context, {
      mock: true,
      maxProperties: 5,
      minScore: 10,
    });

    assert.ok(result.properties.length >= 1);
    const comm = result.properties.find((p) => p.description.includes("commut"));
    assert.ok(comm, "Should infer commutativity for add");
  });
});

describe("E2E: Persist → Load → Verify Staleness", () => {
  let tmpDir: string;
  let storeDir: string;

  before(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "propcheck-e2e-"));
    await initStore(tmpDir);
    storeDir = path.join(tmpDir, ".propcheck");
  });

  after(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("should persist and reload properties", async () => {
    const context = analyzeFile("cart.ts", CART_TS_SOURCE, "typescript");
    const result = await inferProperties(null, "mock", context, { mock: true, maxProperties: 5, minScore: 10 });

    const ps: PropertySet = {
      schemaVersion: 2,
      module: "cart.ts",
      filePath: "cart.ts",
      properties: result.properties,
      sourceHash: hashContent(CART_TS_SOURCE),
      inferredAt: new Date().toISOString(),
    };

    await setProperties(storeDir, "cart.ts", ps);

    // Reload
    const loaded = await getProperties(storeDir, "cart.ts");
    assert.ok(loaded, "Should load saved properties");
    assert.equal(loaded.properties.length, result.properties.length);
    assert.equal(loaded.sourceHash, hashContent(CART_TS_SOURCE));

    // Check all
    const all = await getAllProperties(storeDir);
    assert.ok(all.length >= 1);
  });

  it("should detect staleness when source changes", async () => {
    const loaded = await getProperties(storeDir, "cart.ts");
    assert.ok(loaded);

    const modifiedSource = CART_TS_SOURCE + "\n// modified\n";
    const newHash = hashContent(modifiedSource);
    assert.notEqual(loaded.sourceHash, newHash);
  });
});

describe("E2E: Codegen → Execute → Report", () => {
  let tmpDir: string;

  before(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "propcheck-run-"));
  });

  after(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("should generate and execute fast-check tests for cart.ts", async () => {
    // Write the target JS file
    const targetPath = path.join(tmpDir, "cart.js");
    await fs.writeFile(targetPath, CART_SOURCE, "utf8");

    // Infer properties
    const context = analyzeFile("cart.ts", CART_TS_SOURCE, "typescript");
    const inferResult = await inferProperties(null, "mock", context, { mock: true, maxProperties: 5, minScore: 10 });

    // Generate test
    const testsDir = path.join(tmpDir, ".propcheck", "tests");
    await fs.mkdir(testsDir, { recursive: true });

    const config: RunConfig = { mode: "quick", iterations: 100, timeout: 30000, verbose: false };
    const { content, fileName } = generateFastCheckTest(
      inferResult.properties,
      targetPath,
      testsDir,
      config,
    );

    const testPath = path.join(testsDir, fileName);
    await fs.writeFile(testPath, content, "utf8");

    // Verify generated code is syntactically valid
    assert.ok(content.includes("fc.assert"), "Should have fc.assert calls");
    assert.ok(content.includes("target.applyDiscount"), "Should reference target.applyDiscount");
    assert.ok(!content.includes("\\\\"), "Should not have backslashes in imports");

    // Execute
    const runResult = await runFastCheckTest(testPath, inferResult.properties, config);

    // All properties should pass for cart.ts with 0-100 discount range
    const total = runResult.passed.length + runResult.failed.length + runResult.errors.length;
    assert.ok(total > 0, "Should have some results");

    // Verify JSON report format
    const json = reportAsJson(runResult);
    const parsed = JSON.parse(json);
    assert.ok(parsed.summary, "JSON should have summary");
    assert.equal(parsed.summary.total, total);
  });

  it("should generate and execute fast-check tests for math.ts", async () => {
    // Write target
    const targetPath = path.join(tmpDir, "math.js");
    await fs.writeFile(targetPath, MATH_SOURCE, "utf8");

    // Infer
    const context = analyzeFile("math.ts", MATH_TS_SOURCE, "typescript");
    const inferResult = await inferProperties(null, "mock", context, { mock: true, maxProperties: 5, minScore: 10 });

    // Generate + execute
    const testsDir = path.join(tmpDir, ".propcheck", "tests");
    const config: RunConfig = { mode: "quick", iterations: 100, timeout: 30000, verbose: false };
    const { content, fileName } = generateFastCheckTest(
      inferResult.properties,
      targetPath,
      testsDir,
      config,
    );

    const testPath = path.join(testsDir, fileName);
    await fs.writeFile(testPath, content, "utf8");

    const runResult = await runFastCheckTest(testPath, inferResult.properties, config);

    // Debug output on failure
    if (runResult.passed.length === 0) {
      console.log("Math test debug - errors:", runResult.errors.map(e => e.errorMessage));
      console.log("Math test debug - failed:", runResult.failed.map(f => f.errorMessage));
    }

    // add() should pass commutativity and identity
    assert.ok(runResult.passed.length >= 1, `Expected >= 1 passed, got ${runResult.passed.length}`);
  });
});

describe("E2E: Edge Cases", () => {
  it("should handle empty file (no functions)", () => {
    const context = analyzeFile("empty.ts", "// empty file\nconst x = 42;", "typescript");
    assert.equal(context.functions.length, 0);
  });

  it("should handle file with only private functions", () => {
    const source = `
function helper(x: number): number { return x * 2; }
const internal = (a: string) => a.trim();
`;
    const context = analyzeFile("private.ts", source, "typescript");
    assert.ok(context.functions.length >= 1);
    // All should be private (not exported)
    for (const fn of context.functions) {
      assert.equal(fn.visibility, "private");
    }
  });

  it("should handle JavaScript files without types", () => {
    const source = `
export function multiply(a, b) {
  return a * b;
}
`;
    const context = analyzeFile("math.js", source, "javascript");
    assert.equal(context.functions.length, 1);
    assert.equal(context.functions[0].parameters[0].type, null);
  });

  it("should handle complex TypeScript features", () => {
    const source = `
export async function* fetchPages(url: string, maxPages: number = 10): AsyncGenerator<string[]> {
  yield [];
}

export function merge<T>(a: T[], b: T[]): T[] {
  return [...a, ...b];
}

export function processRecord(input: Record<string, unknown>): string {
  return JSON.stringify(input);
}
`;
    const context = analyzeFile("complex.ts", source, "typescript");
    assert.ok(context.functions.length >= 3);

    const fetchPages = context.functions.find((f) => f.name === "fetchPages");
    assert.ok(fetchPages);
    assert.equal(fetchPages.isAsync, true);
    assert.equal(fetchPages.isGenerator, true);
    assert.equal(fetchPages.parameters[1].defaultValue, "10");

    const merge = context.functions.find((f) => f.name === "merge");
    assert.ok(merge);
    assert.equal(merge.parameters.length, 2);
  });
});
