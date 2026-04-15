/**
 * Tests for propcheck fix command — mock mode E2E.
 */

import { describe, it, afterEach } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { spawnSync } from "node:child_process";

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

function run(args: string[], cwd: string): { stdout: string; stdoutRaw: string; stderr: string; exitCode: number } {
  const result = spawnSync(process.execPath, [CLI, ...args], {
    cwd,
    encoding: "utf-8",
    timeout: 30_000,
    env: { ...process.env, NO_COLOR: "1" },
  });

  const stdoutRaw = result.stdout ?? "";
  const stderr = `${result.stderr ?? ""}${result.error ? result.error.message : ""}`;
  return {
    stdout: `${stdoutRaw}${stderr}`,
    stdoutRaw,
    stderr,
    exitCode: result.status ?? 1,
  };
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
    const { exitCode, stdout } = run(["fix", "--mock", "nonexistent.js"], dir);
    assert.equal(exitCode, 2);
    assert.ok(stdout.includes("File not found"), stdout);
  });

  it("should exit 2 when no properties exist for file", () => {
    const dir = makeTmpProject();
    tmpDirs.push(dir);

    // Create a source file but no properties (plain JS — works on all Node versions)
    fs.writeFileSync(path.join(dir, "test.js"), "function add(a, b) { return a + b; }\nmodule.exports = { add };\n");
    // Create empty properties.json
    fs.writeFileSync(path.join(dir, ".propcheck", "properties.json"), JSON.stringify({ version: 2, modules: {} }));

    const { exitCode, stdout } = run(["fix", "--mock", "test.js"], dir);
    assert.equal(exitCode, 2);
    assert.ok(stdout.includes("No properties found"), stdout);
  });

  it("should exit 0 when all properties pass (nothing to fix)", () => {
    const dir = makeTmpProject();
    tmpDirs.push(dir);

    // Create a correct source file (plain JS — works on all Node versions)
    const source = `function add(a, b) { return a + b; }\nmodule.exports = { add };\n`;
    fs.writeFileSync(path.join(dir, "math.js"), source);

    // First infer to generate properties
    run(["infer", "--mock", "math.js"], dir);

    // Now run fix — should find nothing to fix
    const { exitCode, stdout } = run(["fix", "--mock", "math.js"], dir);
    assert.equal(exitCode, 0);
    assert.ok(stdout.includes("pass") || stdout.includes("nothing to fix"), stdout);
  });

  it("should apply a verified mock fix and create a backup when --apply is used", () => {
    const dir = makeTmpProject();
    tmpDirs.push(dir);

    // Create source with a known bug (discount > 100% allows negative prices)
    // Plain JS — works on all Node versions
    const buggySource = [
      "function applyDiscount(price, discount) {",
      "  return price * (1 - discount / 100);",
      "}",
      "module.exports = { applyDiscount };",
    ].join("\n");
    fs.writeFileSync(path.join(dir, "cart.js"), buggySource);

    // Infer and run fix with --apply
    const inferResult = run(["infer", "--mock", "cart.js"], dir);
    assert.equal(inferResult.exitCode, 0, inferResult.stdout);

    const fixResult = run(["fix", "--mock", "--apply", "cart.js"], dir);
    assert.equal(fixResult.exitCode, 0, fixResult.stdout);

    // Check that .bak file was created and the source was updated
    const bakPath = path.join(dir, "cart.js.bak");
    assert.ok(fs.existsSync(bakPath), "Backup should be created for applied fixes");
    const bakContent = fs.readFileSync(bakPath, "utf-8");
    assert.equal(bakContent, buggySource, "Backup should contain original source");

    const fixedSource = fs.readFileSync(path.join(dir, "cart.js"), "utf-8");
    assert.notEqual(fixedSource, buggySource, "Applied fix should update the target file");
    assert.match(fixedSource, /normalizedDiscount/);
  });

  it("should emit machine-readable JSON when nothing needs fixing", () => {
    const dir = makeTmpProject();
    tmpDirs.push(dir);

    const source = `function add(a, b) { return a + b; }\nmodule.exports = { add };\n`;
    fs.writeFileSync(path.join(dir, "math.js"), source);
    const inferResult = run(["infer", "--mock", "math.js"], dir);
    assert.equal(inferResult.exitCode, 0, inferResult.stdout);

    const result = run(["fix", "--mock", "--json", "math.js"], dir);
    assert.equal(result.exitCode, 0, result.stdout);
    const payload = JSON.parse(result.stdoutRaw) as { status: string; failureCount: number };
    assert.equal(payload.status, "nothing_to_fix");
    assert.equal(payload.failureCount, 0);
  });

  it("should emit machine-readable JSON for a verified fix", () => {
    const dir = makeTmpProject();
    tmpDirs.push(dir);

    const buggySource = [
      "function applyDiscount(price, discount) {",
      "  return price * (1 - discount / 100);",
      "}",
      "module.exports = { applyDiscount };",
    ].join("\n");
    fs.writeFileSync(path.join(dir, "cart.js"), buggySource);
    const inferResult = run(["infer", "--mock", "cart.js"], dir);
    assert.equal(inferResult.exitCode, 0, inferResult.stdout);

    const result = run(["fix", "--mock", "--json", "cart.js"], dir);
    assert.equal(result.exitCode, 0, result.stdout);
    const payload = JSON.parse(result.stdoutRaw) as {
      status: string;
      verification: { failed: number; errors: number } | null;
    };
    assert.equal(payload.status, "fixed");
    assert.notEqual(payload.verification, null);
    assert.equal(payload.verification!.failed, 0);
    assert.equal(payload.verification!.errors, 0);
  });

  it("should exit 2 for out-of-range --max-attempts", () => {
    const dir = makeTmpProject();
    tmpDirs.push(dir);

    fs.writeFileSync(path.join(dir, "test.js"), "function add(a, b) { return a + b; }\nmodule.exports = { add };\n");

    const { exitCode, stdout } = run(["fix", "--mock", "--max-attempts", "6", "test.js"], dir);
    assert.equal(exitCode, 2);
    assert.ok(stdout.includes("--max-attempts"), stdout);
  });

  it("should exit 2 for --property with nonexistent ID", () => {
    const dir = makeTmpProject();
    tmpDirs.push(dir);

    const source = `function add(a, b) { return a + b; }\nmodule.exports = { add };\n`;
    fs.writeFileSync(path.join(dir, "math.js"), source);
    run(["infer", "--mock", "math.js"], dir);

    const { exitCode, stdout } = run(["fix", "--mock", "--property", "prop_999", "math.js"], dir);
    assert.equal(exitCode, 2);
    assert.ok(stdout.includes("not found"), stdout);
  });
});
