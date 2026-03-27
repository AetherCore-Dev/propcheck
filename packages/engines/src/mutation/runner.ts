/**
 * Mutation testing runner — execute properties against each mutant.
 *
 * For each mutant:
 *   1. Write mutated source to a temp file
 *   2. Generate fast-check tests pointing at the mutated source
 *   3. Run tests — if any property fails, the mutant is "killed"
 *   4. If all properties pass, the mutant "survived" (property gap!)
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { PropertyDefinition, RunConfig } from "@propcheck/common";
import { generateFastCheckTest } from "../fast-check/fc-codegen";
import { runFastCheckTest } from "../fast-check/fc-runner";
import type { Mutant, MutantResult, MutationReport } from "./operators";
import { generateMutants } from "./operators";

/**
 * Run mutation testing: generate mutants → test each against properties.
 */
export async function runMutationTesting(
  sourceFilePath: string,
  source: string,
  properties: readonly PropertyDefinition[],
  storeDir: string,
): Promise<MutationReport> {
  const startTime = Date.now();
  const mutants = generateMutants(source, sourceFilePath);

  if (mutants.length === 0) {
    return {
      totalMutants: 0,
      killed: 0,
      survived: 0,
      errors: 0,
      mutationScore: 1.0,
      results: [],
      survivingMutants: [],
      duration: Date.now() - startTime,
    };
  }

  const testsDir = path.join(storeDir, "tests");
  await fs.mkdir(testsDir, { recursive: true });

  const quickConfig: RunConfig = {
    mode: "quick",
    iterations: 50, // Fewer iterations per mutant for speed
    timeout: 10_000,
    verbose: false,
  };

  const results: MutantResult[] = [];
  const survivingMutants: Mutant[] = [];

  // Process each mutant
  for (const mutant of mutants) {
    // Write mutated source to temp file
    const ext = path.extname(sourceFilePath);
    const mutantFileName = `_mutant_${mutant.id}${ext}`;
    const mutantFilePath = path.join(testsDir, mutantFileName);

    try {
      await fs.writeFile(mutantFilePath, mutant.mutatedSource, "utf8");

      // Generate test pointing at mutant file
      const generated = generateFastCheckTest(properties, mutantFilePath, testsDir, quickConfig);
      const testFilePath = path.join(testsDir, `_mut_test_${mutant.id}.js`);
      await fs.writeFile(testFilePath, generated.content, "utf8");

      // Run test
      const result = await runFastCheckTest(testFilePath, properties, quickConfig);

      // If any property failed → mutant killed
      if (result.failed.length > 0) {
        results.push({
          mutantId: mutant.id,
          status: "killed",
          killedBy: result.failed[0].propertyId,
        });
      } else if (result.errors.length > 0 && result.passed.length === 0) {
        // Test errored (e.g. mutant caused compile error) → counts as killed
        results.push({
          mutantId: mutant.id,
          status: "killed",
        });
      } else {
        // All properties passed on mutant → mutant survived (gap!)
        results.push({
          mutantId: mutant.id,
          status: "survived",
        });
        survivingMutants.push(mutant);
      }

      // Cleanup test file
      try { await fs.unlink(testFilePath); } catch { /* ignore */ }
    } catch {
      results.push({
        mutantId: mutant.id,
        status: "error",
      });
    } finally {
      // Cleanup mutant file
      try { await fs.unlink(mutantFilePath); } catch { /* ignore */ }
    }
  }

  const killed = results.filter((r) => r.status === "killed").length;
  const survived = results.filter((r) => r.status === "survived").length;
  const errors = results.filter((r) => r.status === "error").length;

  return {
    totalMutants: mutants.length,
    killed,
    survived,
    errors,
    mutationScore: killed + survived > 0 ? killed / (killed + survived) : 1.0,
    results,
    survivingMutants,
    duration: Date.now() - startTime,
  };
}
