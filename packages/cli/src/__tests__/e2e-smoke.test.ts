/**
 * E2E smoke test — verify the full infer --mock → run pipeline works end-to-end.
 *
 * This test exercises the real CLI pipeline (not mocked internals) to catch
 * integration issues at the seams between packages.
 */

import { describe, it, before, after } from "node:test";
import * as assert from "node:assert/strict";
import { execSync, type ExecSyncOptionsWithStringEncoding } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

// When compiled, __dirname = packages/cli/dist/__tests__
const CLI = path.resolve(__dirname, "../index.js");
const PROJECT_ROOT = path.resolve(__dirname, "../../../..");
const EXAMPLES_DIR = path.join(PROJECT_ROOT, "examples");
const TARGET = path.join(EXAMPLES_DIR, "price-utils.ts");
const PROPCHECK_DIR = path.join(PROJECT_ROOT, ".propcheck");

const EXEC_OPTS: ExecSyncOptionsWithStringEncoding = {
  encoding: "utf8",
  timeout: 60_000,
  cwd: PROJECT_ROOT,
};

/** Run a command, return { stdout, exitCode }. Does not throw on non-zero exit. */
function run(cmd: string): { stdout: string; exitCode: number } {
  try {
    const stdout = execSync(cmd, EXEC_OPTS);
    return { stdout, exitCode: 0 };
  } catch (err: unknown) {
    const e = err as { stdout?: string; status?: number };
    return { stdout: e.stdout ?? "", exitCode: e.status ?? 1 };
  }
}

describe("E2E smoke test: infer --mock → run", () => {
  let originalProperties: string | null = null;

  before(() => {
    // Backup existing properties if present
    const propsFile = path.join(PROPCHECK_DIR, "properties.json");
    if (fs.existsSync(propsFile)) {
      originalProperties = fs.readFileSync(propsFile, "utf8");
    }
  });

  after(() => {
    // Restore original properties
    if (originalProperties !== null) {
      const propsFile = path.join(PROPCHECK_DIR, "properties.json");
      fs.writeFileSync(propsFile, originalProperties, "utf8");
    }
  });

  it("infer --mock generates properties for price-utils.ts", () => {
    const { stdout, exitCode } = run(`node "${CLI}" infer --mock "${TARGET}"`);
    assert.equal(exitCode, 0, `infer should exit 0, got ${exitCode}`);
    assert.ok(stdout.includes("Discovered"), `Expected 'Discovered' in output:\n${stdout}`);
    assert.ok(stdout.includes("rules for"), `Expected 'rules for' in output:\n${stdout}`);

    // Verify properties.json was created/updated
    const propsFile = path.join(PROPCHECK_DIR, "properties.json");
    assert.ok(fs.existsSync(propsFile), "properties.json should exist after infer");

    const props = JSON.parse(fs.readFileSync(propsFile, "utf8"));
    assert.ok(props.modules, "properties.json should have modules key");
    const moduleKey = Object.keys(props.modules).find((k) => k.includes("price-utils"));
    assert.ok(moduleKey, "Should have price-utils module");

    const mod = props.modules[moduleKey];
    assert.ok(mod.properties.length > 0, "Should have at least 1 property");
  });

  it("run executes properties and produces output", () => {
    // infer first to ensure properties exist
    run(`node "${CLI}" infer --mock "${TARGET}"`);

    const { stdout, exitCode } = run(`node "${CLI}" run "${TARGET}"`);
    // Exit 0 (all pass) or 1 (some fail) are both valid for this test
    assert.ok(exitCode === 0 || exitCode === 1, `run should exit 0 or 1, got ${exitCode}`);
    assert.ok(stdout.includes("Properties:"), `Expected summary line in output:\n${stdout}`);
    assert.ok(stdout.includes("Passed:"), `Expected 'Passed:' in output:\n${stdout}`);
  });

  it("run --json produces valid JSON output", () => {
    run(`node "${CLI}" infer --mock "${TARGET}"`);

    const { stdout, exitCode } = run(`node "${CLI}" run --json "${TARGET}"`);
    assert.ok(exitCode === 0 || exitCode === 1, `run --json should exit 0 or 1, got ${exitCode}`);

    // The JSON output should be parseable
    const jsonStr = stdout.trim();
    assert.ok(jsonStr.startsWith("{"), "Output should be JSON object");

    const parsed = JSON.parse(jsonStr);
    assert.ok("summary" in parsed, "JSON should have summary field");
    assert.ok(parsed.summary.total > 0, "Should have tested at least 1 property");
  });

  it("check command runs full pipeline in one step", () => {
    const { stdout, exitCode } = run(`node "${CLI}" check --quick "${TARGET}"`);
    assert.ok(exitCode === 0 || exitCode === 1, `check should exit 0 or 1, got ${exitCode}`);

    // Should include both inference and run output
    assert.ok(
      stdout.includes("Discovered") || stdout.includes("rules for"),
      `Expected inference output:\n${stdout}`,
    );
    assert.ok(
      stdout.includes("Properties:") || stdout.includes("Passed:"),
      `Expected run output:\n${stdout}`,
    );
  });
});
