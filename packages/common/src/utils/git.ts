/**
 * Git diff utilities — detect changed functions for --changed mode.
 *
 * Parses `git diff` output to identify which files and line ranges changed,
 * then maps those to function names via the parser.
 */

import { spawnSync } from "node:child_process";
import type { FunctionSignature } from "../types/analysis";

/** A file changed in git diff with its modified line ranges. */
export interface ChangedFile {
  readonly filePath: string;
  readonly changedLines: readonly { start: number; end: number }[];
}

/** Result of getChangedFiles — distinguishes "no changes" from "git unavailable". */
export interface ChangedFilesResult {
  readonly status: "ok" | "git_error";
  readonly files: readonly ChangedFile[];
  readonly errorMessage?: string;
}

/**
 * Get list of changed files from git diff.
 * Compares working tree against HEAD (unstaged + staged changes).
 */
export function getChangedFiles(cwd: string): ChangedFilesResult {
  let diffOutput: string;
  try {
    const diffResult = spawnSync(
      "git",
      ["diff", "HEAD", "--unified=0", "--diff-filter=ACMR", "--name-only"],
      { cwd, encoding: "utf8", timeout: 10_000 },
    );
    if (diffResult.status !== 0) {
      return {
        status: "git_error",
        files: [],
        errorMessage: diffResult.stderr?.trim() || `git diff exited with code ${diffResult.status}`,
      };
    }
    diffOutput = diffResult.stdout;
  } catch (err) {
    // Not a git repo or git not available
    return {
      status: "git_error",
      files: [],
      errorMessage: err instanceof Error ? err.message : "git not available",
    };
  }

  const files = diffOutput.trim().split("\n").filter(Boolean);
  const result: ChangedFile[] = [];

  for (const filePath of files) {
    // Get detailed diff for this file to extract line ranges
    let fileDiff: string;
    try {
      const diffResult = spawnSync(
        "git",
        ["diff", "HEAD", "--unified=0", "--", filePath],
        { cwd, encoding: "utf8", timeout: 10_000 },
      );
      if (diffResult.status !== 0) {
        result.push({ filePath, changedLines: [] });
        continue;
      }
      fileDiff = diffResult.stdout;
    } catch {
      result.push({ filePath, changedLines: [] });
      continue;
    }

    const changedLines: { start: number; end: number }[] = [];
    // Parse @@ -a,b +c,d @@ hunk headers
    const hunkRegex = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/gm;
    let match: RegExpExecArray | null;

    while ((match = hunkRegex.exec(fileDiff)) !== null) {
      const start = parseInt(match[1], 10);
      const count = match[2] ? parseInt(match[2], 10) : 1;
      changedLines.push({ start, end: start + count - 1 });
    }

    result.push({ filePath, changedLines });
  }

  return { status: "ok", files: result };
}

/**
 * Determine which functions were affected by changes.
 * A function is "changed" if any changed line falls within its source location.
 */
export function getChangedFunctions(
  functions: readonly FunctionSignature[],
  changedLines: readonly { start: number; end: number }[],
): readonly FunctionSignature[] {
  if (changedLines.length === 0) {
    // If we can't determine specific lines, consider all functions changed
    return functions;
  }

  return functions.filter((fn) =>
    changedLines.some(
      (range) =>
        range.start <= fn.loc.endLine && range.end >= fn.loc.startLine,
    ),
  );
}
