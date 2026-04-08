/**
 * fast-check test runner — spawns Node.js to execute generated test files.
 */

import * as fsPromises from "node:fs/promises";
import * as path from "node:path";
import type { PropertyDefinition, RunConfig, ExecutionResult } from "@propcheck/common";
import { supportsStripTypes } from "@propcheck/common";
import { runProcess } from "../shared/process-runner";
import { parseJsonLines, mapResults } from "../shared/result-parser";

/**
 * Strip TypeScript type annotations from source code using the TS compiler.
 * Falls back to returning the original source if typescript is not available.
 */
function stripTypeAnnotations(source: string): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ts = require("typescript") as typeof import("typescript");
    const result = ts.transpileModule(source, {
      compilerOptions: {
        target: ts.ScriptTarget.ESNext,
        module: ts.ModuleKind.ESNext,
        // Preserve ESM syntax, just strip types
        removeComments: false,
      },
    });
    return result.outputText;
  } catch {
    // typescript not available — return source as-is and hope for the best
    return source;
  }
}

/**
 * Run a generated fast-check test file and parse results.
 *
 * When the generated test needs a copy of the target with a different extension
 * (e.g. .mts for CJS+TS on Node 24+, or .mjs for TS on Node < 22.6),
 * this function creates and cleans up the temporary copy.
 */
export async function runFastCheckTest(
  testFilePath: string,
  properties: readonly PropertyDefinition[],
  config: RunConfig,
  options?: { readonly targetFile?: string; readonly needsMtsCopy?: boolean; readonly copyExt?: string },
): Promise<ExecutionResult> {
  const startTime = Date.now();
  const cwd = path.dirname(testFilePath);

  // Create copy with alternate extension if needed
  let copyPath: string | null = null;
  if (options?.needsMtsCopy && options.targetFile) {
    const ext = options.copyExt ?? ".mts";
    copyPath = options.targetFile.replace(/\.tsx?$/, ext);

    if (ext === ".mjs") {
      // For .mjs copies (Node < 22.6): strip TS type annotations since
      // Node 18/20 cannot parse TypeScript syntax in .mjs files
      const source = await fsPromises.readFile(options.targetFile, "utf8");
      await fsPromises.writeFile(copyPath, stripTypeAnnotations(source), "utf8");
    } else {
      // For .mts copies (CJS projects on Node 22.6+): direct copy
      await fsPromises.copyFile(options.targetFile, copyPath);
    }
  }

  try {
    const nodeArgs = [
      ...(supportsStripTypes() ? ["--experimental-strip-types"] : []),
      "--no-warnings",
      testFilePath,
    ];

    const result = await runProcess(
      "node",
      nodeArgs,
      {
        cwd,
        timeout: config.timeout * Math.max(properties.length, 1),
        env: {
          NODE_PATH: [
            path.join(cwd, "node_modules"),
            path.join(cwd, "..", "..", "node_modules"),
            path.join(cwd, "..", "..", "..", "node_modules"),
            process.env["NODE_PATH"] ?? "",
          ].join(path.delimiter),
        },
      },
    );

    const rawResults = parseJsonLines(result.stdout);
    return mapResults(rawResults, properties, config, Date.now() - startTime, result.stderr, "Test execution error");
  } finally {
    // Clean up copy
    if (copyPath) {
      try {
        await fsPromises.unlink(copyPath);
      } catch (e) {
        if (e instanceof Error && (e as NodeJS.ErrnoException).code !== "ENOENT") {
          console.warn(`  Warning: Failed to clean up ${copyPath}: ${e.message}`);
        }
      }
    }
  }
}
