/**
 * Main entry point for @propcheck/llm.
 *
 * Orchestrates: build prompt → call API → parse response → score/filter → return
 */

import type { AnalysisContext, PropertyDefinition } from "@propcheck/common";
import { hashContent } from "@propcheck/common";
import { createLlmClient } from "./client";
import type { LlmClient } from "./client";
import { createOpenAIClient } from "./openai-client";
import { createMockClient } from "./mock-client";
import { buildInferPrompt, getSystemPrompt, getInferTool } from "./prompts/infer-properties";
import { parseInferResponse } from "./response-parser";
import { scoreAndFilter } from "./scoring";

export interface InferOptions {
  readonly maxProperties: number;
  readonly minScore: number;
  readonly mock: boolean;
  readonly provider?: "anthropic" | "openai-compatible";
  readonly baseURL?: string | null;
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

// Claude Sonnet pricing (per 1M tokens) — approximate for cost display
const INPUT_COST_PER_1M = 3.0;
const OUTPUT_COST_PER_1M = 15.0;

function estimateCost(inputTokens: number, outputTokens: number): number {
  return (
    (inputTokens / 1_000_000) * INPUT_COST_PER_1M +
    (outputTokens / 1_000_000) * OUTPUT_COST_PER_1M
  );
}

/**
 * Create the appropriate LLM client based on provider configuration.
 */
export function createClient(
  apiKey: string,
  model: string,
  provider: "anthropic" | "openai-compatible" = "anthropic",
  baseURL?: string | null,
): LlmClient {
  if (provider === "openai-compatible") {
    return createOpenAIClient(apiKey, model, baseURL ?? undefined);
  }
  return createLlmClient(apiKey, model, baseURL);
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

  // Create client (mock → real, dispatch by provider)
  const client = opts.mock
    ? createMockClient()
    : createClient(apiKey!, model, opts.provider, opts.baseURL);

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
export { createOpenAIClient } from "./openai-client";
export type { LlmClient, ApiResponse, LlmToolSchema } from "./client";
export { createMockClient } from "./mock-client";
export { parseInferResponse } from "./response-parser";
export { scoreProperty, scoreAndFilter, isRedundant } from "./scoring";
export { buildInferPrompt, getSystemPrompt, getInferTool } from "./prompts/infer-properties";
export { repairProperty } from "./prompts/self-repair";
export { mockRepairProperty } from "./mock-repair";
export { classifyProperties, buildFeedbackSummary, buildRefinementPrompt } from "./prompts/refinement";
export type { PropertyClassification } from "./prompts/refinement";
export { mockRefineProperties } from "./mock-refinement";
