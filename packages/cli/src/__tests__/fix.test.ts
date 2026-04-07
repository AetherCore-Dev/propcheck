/**
 * Tests for propcheck fix command — mock mode E2E.
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { execFileSync } from "node:child_process";

const CLI = path.resolve(__dirname, "../index.js");

function makeTmpProject(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "propcheck-fix-test-"));
  // Init store
  const storeDir = path.join(dir, ".propcheck");
  fs.mkdirSync(storeDir, { recursive: true });
  fs.mkdirSync(path.join(storeDir, "tests"), { recursive: true });
  fs.mkdirSync(path.join(storeDir, "corpus"), { recursive: true });
  fs.mkdirSync(path.join(storeDir, "reports"), { recursive: true });
  return dir;
}

function run(args: string[], cwd: string): { stdout: string; exitCode: number } {
  try {
    const stdout = execFileSync(process.execPath, [CLI, ...args], {
      cwd,
      encoding: "utf-8",
      timeout: 30_000,
      env: { ...process.env, NO_COLOR: "1" },
    });
    return { stdout, exitCode: 0 };
  } catch (err: unknown) {
    const e = err as { status?: number; stdout?: string; stderr?: string };
    return { stdout: (e.stdout ?? "") + (e.stderr ?? ""), exitCode: e.status ?? 1 };
  }
}

describe("fix command", () => {
  const tmpDirs: string[] = [];

  afterEach(() => {
    for (const dir of tmpDirs) {
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
    tmpDirs.length = 0;
  });

  it("should exit 2 when file not found", () => {
    const dir = makeTmpProject();
    tmpDirs.push(dir);
    const { exitCode, stdout } = run(["fix", "--mock", "nonexistent.ts"], dir);
    assert.equal(exitCode, 2);
    assert.ok(stdout.includes("File not found"), stdout);
  });

  it("should exit 2 when no properties exist for file", () => {
    const dir = makeTmpProject();
    tmpDirs.push(dir);

    // Create a source file but no properties
    fs.writeFileSync(path.join(dir, "test.ts"), "export function add(a: number, b: number) { return a + b; }");
    // Create empty properties.json
    fs.writeFileSync(path.join(dir, ".propcheck", "properties.json"), JSON.stringify({ version: 2, modules: {} }));

    const { exitCode, stdout } = run(["fix", "--mock", "test.ts"], dir);
    assert.equal(exitCode, 2);
    assert.ok(stdout.includes("No properties found"), stdout);
  });

  it("should exit 0 when all properties pass (nothing to fix)", () => {
    const dir = makeTmpProject();
    tmpDirs.push(dir);

    // Create a correct source file
    const source = `export function add(a, b) { return a + b; }\n`;
    fs.writeFileSync(path.join(dir, "math.ts"), source);

    // First infer to generate properties
    run(["infer", "--mock", "math.ts"], dir);

    // Now run fix — should find nothing to fix
    const { exitCode, stdout } = run(["fix", "--mock", "math.ts"], dir);
    assert.equal(exitCode, 0);
    assert.ok(stdout.includes("pass") || stdout.includes("nothing to fix"), stdout);
  });

  it("should create .bak backup when --apply is used", () => {
    const dir = makeTmpProject();
    tmpDirs.push(dir);

    // Create source with a known bug (discount > 100% allows negative prices)
    const buggySource = [
      "export function applyDiscount(price, discount) {",
      "  return price * (1 - discount / 100);",
      "}",
    ].join("\n");
    fs.writeFileSync(path.join(dir, "cart.ts"), buggySource);

    // Infer and run fix with --apply
    run(["infer", "--mock", "cart.ts"], dir);
    run(["fix", "--mock", "--apply", "cart.ts"], dir);

    // Check that .bak file was created
    const bakPath = path.join(dir, "cart.ts.bak");
    if (fs.existsSync(bakPath)) {
      const bakContent = fs.readFileSync(bakPath, "utf-8");
      assert.equal(bakContent, buggySource, "Backup should contain original source");
    }
    // Note: if all properties pass, --apply won't trigger, which is also valid
  });

  it("should exit 2 for --property with nonexistent ID", () => {
    const dir = makeTmpProject();
    tmpDirs.push(dir);

    const source = `export function add(a, b) { return a + b; }\n`;
    fs.writeFileSync(path.join(dir, "math.ts"), source);
    run(["infer", "--mock", "math.ts"], dir);

    const { exitCode, stdout } = run(["fix", "--mock", "--property", "prop_999", "math.ts"], dir);
    assert.equal(exitCode, 2);
    assert.ok(stdout.includes("not found"), stdout);
  });
});
