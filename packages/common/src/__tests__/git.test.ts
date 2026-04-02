import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import * as os from "node:os";
import * as fs from "node:fs";
import * as path from "node:path";
import { getChangedFiles, getChangedFunctions } from "../utils/git";
import type { FunctionSignature } from "../types/analysis";

function makeFn(name: string, startLine: number, endLine: number): FunctionSignature {
  return {
    name,
    qualifiedName: name,
    parameters: [],
    returnType: "number",
    docstring: null,
    visibility: "public",
    isAsync: false,
    isGenerator: false,
    loc: { startLine, endLine, startColumn: 0, endColumn: 0 },
  };
}

describe("getChangedFiles", () => {
  it("should return git_error for non-git directory", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "propcheck-git-test-"));
    try {
      const result = getChangedFiles(tmpDir);
      assert.equal(result.status, "git_error");
      assert.equal(result.files.length, 0);
      assert.ok(result.errorMessage);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("should return ok with files for a real git repo", () => {
    // Use the propcheck repo itself — should have status "ok"
    const result = getChangedFiles(process.cwd());
    assert.equal(result.status, "ok");
    assert.ok(Array.isArray(result.files));
  });
});

describe("getChangedFunctions", () => {
  const functions: FunctionSignature[] = [
    makeFn("add", 1, 5),
    makeFn("subtract", 10, 20),
    makeFn("multiply", 25, 30),
  ];

  it("should return all functions when changedLines is empty", () => {
    const result = getChangedFunctions(functions, []);
    assert.equal(result.length, 3);
  });

  it("should return only functions overlapping changed lines", () => {
    const result = getChangedFunctions(functions, [{ start: 12, end: 15 }]);
    assert.equal(result.length, 1);
    assert.equal(result[0].name, "subtract");
  });

  it("should handle changes spanning multiple functions", () => {
    const result = getChangedFunctions(functions, [{ start: 4, end: 11 }]);
    assert.equal(result.length, 2);
    assert.equal(result[0].name, "add");
    assert.equal(result[1].name, "subtract");
  });

  it("should handle changes at exact function boundaries", () => {
    const result = getChangedFunctions(functions, [{ start: 5, end: 5 }]);
    assert.equal(result.length, 1);
    assert.equal(result[0].name, "add");
  });

  it("should return empty when no functions overlap", () => {
    const result = getChangedFunctions(functions, [{ start: 7, end: 8 }]);
    assert.equal(result.length, 0);
  });
});
