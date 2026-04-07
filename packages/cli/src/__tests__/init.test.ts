/**
 * Tests for propcheck init command — .gitignore integration.
 */

import { describe, it, afterEach } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { initCommand } from "../commands/init";

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "propcheck-init-test-"));
}

describe("init — .gitignore integration", () => {
  const tmpDirs: string[] = [];

  afterEach(() => {
    for (const dir of tmpDirs) {
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
    tmpDirs.length = 0;
  });

  it("should create .gitignore with propcheck entries when none exists", async () => {
    const tmpDir = makeTmpDir();
    tmpDirs.push(tmpDir);
    const originalCwd = process.cwd();
    process.chdir(tmpDir);
    try {
      // Suppress console output
      const origLog = console.log;
      console.log = () => {};
      await initCommand();
      console.log = origLog;

      const gitignore = fs.readFileSync(path.join(tmpDir, ".gitignore"), "utf-8");
      assert.ok(gitignore.includes(".propcheck/tests/"), "should include tests dir");
      assert.ok(gitignore.includes(".propcheck/corpus/"), "should include corpus dir");
      assert.ok(gitignore.includes(".propcheck/reports/"), "should include reports dir");
    } finally {
      process.chdir(originalCwd);
    }
  });

  it("should append to existing .gitignore without duplicating", async () => {
    const tmpDir = makeTmpDir();
    tmpDirs.push(tmpDir);
    const originalCwd = process.cwd();
    process.chdir(tmpDir);
    try {
      // Create existing .gitignore
      fs.writeFileSync(path.join(tmpDir, ".gitignore"), "node_modules/\ndist/\n");

      const origLog = console.log;
      console.log = () => {};
      await initCommand();
      console.log = origLog;

      const gitignore = fs.readFileSync(path.join(tmpDir, ".gitignore"), "utf-8");
      assert.ok(gitignore.includes("node_modules/"), "should keep existing entries");
      assert.ok(gitignore.includes(".propcheck/tests/"), "should add propcheck entries");
    } finally {
      process.chdir(originalCwd);
    }
  });

  it("should not duplicate entries on second init", async () => {
    const tmpDir = makeTmpDir();
    tmpDirs.push(tmpDir);
    const originalCwd = process.cwd();
    process.chdir(tmpDir);
    try {
      const origLog = console.log;
      console.log = () => {};
      await initCommand();
      await initCommand(); // second run
      console.log = origLog;

      const gitignore = fs.readFileSync(path.join(tmpDir, ".gitignore"), "utf-8");
      const matches = gitignore.match(/\.propcheck\/tests\//g);
      assert.equal(matches?.length, 1, "should appear exactly once");
    } finally {
      process.chdir(originalCwd);
    }
  });

  it("should detect existing propcheck entries and skip update", async () => {
    const tmpDir = makeTmpDir();
    tmpDirs.push(tmpDir);
    const originalCwd = process.cwd();
    process.chdir(tmpDir);
    try {
      // Pre-populate with propcheck marker
      fs.writeFileSync(path.join(tmpDir, ".gitignore"), ".propcheck/tests/\n");

      const origLog = console.log;
      console.log = () => {};
      await initCommand();
      console.log = origLog;

      const gitignore = fs.readFileSync(path.join(tmpDir, ".gitignore"), "utf-8");
      // Should NOT have added the full block again
      const matches = gitignore.match(/\.propcheck\/tests\//g);
      assert.equal(matches?.length, 1, "should not duplicate");
    } finally {
      process.chdir(originalCwd);
    }
  });
});
