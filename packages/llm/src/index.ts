/**
 * Main entry point for @propcheck/llm.
 *
 * Orchestrates: build prompt → call API → parse response → score/filter → return
 */

import type { AnalysisContext, PropertyDefinition } from "@propcheck/common";
import { hashContent } from "@propcheck/common";
import { createLlmClient } from "./client";
import { createMockClient } from "./mock-client";
import { buildInferPrompt, getSystemPrompt, getInferTool } from "./prompts/infer-properties";
import { parseInferResponse } from "./response-parser";
import { scoreAndFilter } from "./scoring";

export interface InferOptions {
  readonly maxProperties: number;
  readonly minScore: number;
  readonly mock: boolean;
}

export interface InferResult {
  readonly properties: readonly PropertyDefinition[];
  readonly tokensUsed: number;
  readonly cost: number;
  readonly duration: number;
}

const DEFAULT_OPTIONS: InferOptions = {
  maxProperties: 5,
  minScore: 10,
  mock: false,
};

// Claude Sonnet pricing (per 1M tokens)
const INPUT_COST_PER_1M = 3.0;
const OUTPUT_COST_PER_1M = 15.0;

function estimateCost(inputTokens: number, outputTokens: number): number {
  return (
    (inputTokens / 1_000_000) * INPUT_COST_PER_1M +
    (outputTokens / 1_000_000) * OUTPUT_COST_PER_1M
  );
}

/**
 * Infer properties for functions in the given analysis context.
 */
export async function inferProperties(
  apiKey: string | null,
  model: string,
  context: AnalysisContext,
  options: Partial<InferOptions> = {},
): Promise<InferResult> {
  const opts: InferOptions = { ...DEFAULT_OPTIONS, ...options };
  const startTime = Date.now();

  // Create client (real or mock)
  const client = opts.mock
    ? createMockClient()
    : createLlmClient(apiKey!, model);

  // Build prompt
  const systemPrompt = getSystemPrompt();
  const userPrompt = buildInferPrompt(context);
  const tool = getInferTool();

  // Call LLM
  const response = await client.call(systemPrompt, userPrompt, [tool]);

  // Parse response
  const sourceHash = hashContent(context.sourceCode);
  const rawProperties = parseInferResponse(response.content, {
    sourceHash,
    modelId: response.model,
  });

  // Score and filter
  const filtered = scoreAndFilter(rawProperties, opts.minScore);

  // Limit to maxProperties per function
  const functionGroups = new Map<string, PropertyDefinition[]>();
  for (const prop of filtered) {
    const group = functionGroups.get(prop.targetFunction) ?? [];
    group.push(prop);
    functionGroups.set(prop.targetFunction, group);
  }

  const limited: PropertyDefinition[] = [];
  for (const [_fn, props] of functionGroups) {
    limited.push(...props.slice(0, opts.maxProperties));
  }

  const duration = Date.now() - startTime;
  const cost = estimateCost(response.inputTokens, response.outputTokens);

  return {
    properties: limited,
    tokensUsed: response.inputTokens + response.outputTokens,
    cost,
    duration,
  };
}

// Re-exports
export { createLlmClient } from "./client";
export type { LlmClient, ApiResponse, LlmToolSchema } from "./client";
export { createMockClient } from "./mock-client";
export { parseInferResponse } from "./response-parser";
export { scoreProperty, scoreAndFilter, isRedundant } from "./scoring";
export { buildInferPrompt, getSystemPrompt, getInferTool } from "./prompts/infer-properties";
export { repairProperty } from "./prompts/self-repair";
export { mockRepairProperty } from "./mock-repair";
