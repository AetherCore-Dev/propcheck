/**
 * fast-check engine adapter — implements EngineAdapter for JavaScript/TypeScript.
 */

import * as path from "node:path";
import * as fs from "node:fs/promises";
import type {
  EngineAdapter,
  PropertyDefinition,
  RunConfig,
  GeneratedTest,
  PrerequisiteCheck,
  ExecutionResult,
} from "@propcheck/common";
import { generateFastCheckTest } from "./fc-codegen";
import { runFastCheckTest } from "./fc-runner";
import { runProcess } from "../shared/process-runner";

export function createFastCheckAdapter(): EngineAdapter {
  return {
    language: "typescript",
    name: "fast-check",

    async generateTestFile(
      properties: readonly PropertyDefinition[],
      targetFile: string,
      config: RunConfig,
    ): Promise<GeneratedTest> {
      // Resolve test directory relative to target
      const targetDir = path.dirname(targetFile);
      const storeDir = path.join(targetDir, ".propcheck", "tests");
      await fs.mkdir(storeDir, { recursive: true });

      const { content, fileName } = generateFastCheckTest(
        properties,
        targetFile,
        storeDir,
        config,
      );

      const filePath = path.join(storeDir, fileName);
      await fs.writeFile(filePath, content, "utf8");

      return {
        filePath,
        engine: "fast-check",
        language: "typescript",
        propertyIds: properties.map((p) => p.id),
        content,
      };
    },

    async execute(
      testFile: GeneratedTest,
      config: RunConfig,
    ): Promise<ExecutionResult> {
      // We need the original properties to map results
      // They're embedded in the test file's propertyIds
      // For now, create minimal PropertyDefinition stubs
      // The caller should pass the full properties through the result
      return runFastCheckTest(testFile.filePath, [], config);
    },

    async checkPrerequisites(): Promise<PrerequisiteCheck> {
      const missing: string[] = [];

      // Check if fast-check is available
      try {
        await runProcess("node", ["-e", 'require("fast-check")'], { timeout: 10000 });
      } catch {
        missing.push("fast-check");
      }

      return {
        satisfied: missing.length === 0,
        missing,
        instructions: missing.length > 0
          ? `Install missing dependencies: npm install ${missing.join(" ")}`
          : "All prerequisites satisfied",
      };
    },
  };
}
