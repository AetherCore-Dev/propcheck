/**
 * Engine adapter interface — contract between propcheck core and PBT engines.
 *
 * Each language-specific engine (fast-check, Hypothesis, proptest) implements
 * this interface to generate test files, execute them, and parse results.
 */

import type { SupportedLanguage } from "./analysis";
import type { PropertyDefinition } from "./property";
import type { ExecutionResult, RunConfig } from "./execution";

/** A generated test file ready for execution. */
export interface GeneratedTest {
  readonly filePath: string;
  readonly engine: string;
  readonly language: SupportedLanguage;
  readonly propertyIds: readonly string[];
  readonly content: string;
}

/** Result of checking engine prerequisites. */
export interface PrerequisiteCheck {
  readonly satisfied: boolean;
  readonly missing: readonly string[];
  readonly instructions: string;
}

/** Abstract interface for all PBT execution engines. */
export interface EngineAdapter {
  readonly language: SupportedLanguage;
  readonly name: string;

  /** Generate executable test file from properties. */
  generateTestFile(
    properties: readonly PropertyDefinition[],
    targetFile: string,
    config: RunConfig,
  ): Promise<GeneratedTest>;

  /** Execute generated tests and return results. */
  execute(
    testFile: GeneratedTest,
    config: RunConfig,
  ): Promise<ExecutionResult>;

  /** Check if runtime dependencies are available. */
  checkPrerequisites(): Promise<PrerequisiteCheck>;
}
