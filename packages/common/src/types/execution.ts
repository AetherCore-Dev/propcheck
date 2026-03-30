/**
 * Execution types — configuration, results, and failures from PBT runs.
 */

import type { PropertyDefinition, PropertyStatus } from "./property";

/** Run configuration controlling execution behavior. */
export interface RunConfig {
  readonly mode: "quick" | "default" | "thorough";
  readonly iterations: number;
  readonly timeout: number;
  readonly seed?: number;
  readonly verbose: boolean;
}

/** Default iteration counts per mode. */
export const RUN_MODE_ITERATIONS: Readonly<Record<RunConfig["mode"], number>> = {
  quick: 100,
  default: 1000,
  thorough: 10000,
};

/** Result for a single property that passed. */
export interface PropertyResult {
  readonly propertyId: string;
  readonly status: "passed";
  readonly iterations: number;
  readonly duration: number;
  readonly seed: number;
}

/** Result for a single property that failed with a counterexample. */
export interface PropertyFailure {
  readonly propertyId: string;
  readonly status: "failed";
  readonly counterexample: unknown;
  readonly shrinkSteps: number;
  readonly originalInput: unknown;
  readonly errorMessage: string;
  readonly seed: number;
  readonly duration: number;
}

/** Result for a property that errored (could not execute). */
export interface PropertyError {
  readonly propertyId: string;
  readonly status: "error";
  readonly errorMessage: string;
  readonly duration: number;
}

/** Union of all property result types. */
export type PropertyOutcome = PropertyResult | PropertyFailure | PropertyError;

export interface PropertySkip {
  readonly propertyId: string;
  readonly reason: "quarantined" | "dropped" | "filter";
  readonly propertyStatus: PropertyStatus;
}

/** Aggregated results from a full run. */
export interface ExecutionResult {
  readonly passed: readonly PropertyResult[];
  readonly failed: readonly PropertyFailure[];
  readonly errors: readonly PropertyError[];
  readonly skipped: readonly PropertySkip[];
  readonly duration: number;
  readonly totalIterations: number;
  readonly properties: readonly PropertyDefinition[];
}

/** Diagnosis of a failure by the LLM. */
export interface Diagnosis {
  readonly propertyId: string;
  readonly isBug: boolean;
  readonly explanation: string;
  readonly suggestedFix: string | null;
  readonly confidence: number;
}
