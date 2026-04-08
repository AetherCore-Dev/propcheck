/**
 * Main entry point for @propcheck/llm.
 *
 * Orchestrates: build prompt → call API → parse response → score/filter → return
 */

import type { AnalysisContext, PropertyDefinition } from "@propcheck/common";
import { hashContent } from "@propcheck/common";
import { createLlmClient } from "./client";
import type { LlmClient, ApiResponse } from "./client";
import { createOpenAIClient } from "./openai-client";
import { createMockClient } from "./mock-client";
import { buildInferPrompt, getSystemPrompt, getInferTool } from "./prompts/infer-properties";
import { buildRefinementPrompt } from "./prompts/refinement";
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

function limitPropertiesPerFunction(
  properties: readonly PropertyDefinition[],
  maxProperties: number,
): readonly PropertyDefinition[] {
  const functionGroups = new Map<string, PropertyDefinition[]>();
  for (const prop of properties) {
    const group = functionGroups.get(prop.targetFunction) ?? [];
    group.push(prop);
    functionGroups.set(prop.targetFunction, group);
  }

  const limited: PropertyDefinition[] = [];
  for (const [_fn, props] of functionGroups) {
    limited.push(...props.slice(0, maxProperties));
  }

  return limited;
}

function toInferResult(
  response: ApiResponse,
  context: AnalysisContext,
  opts: InferOptions,
  startedAt: number,
): InferResult {
  const sourceHash = hashContent(context.sourceCode);
  const rawProperties = parseInferResponse(response.content, {
    sourceHash,
    modelId: response.model,
  });

  const filtered = scoreAndFilter(rawProperties, opts.minScore);
  const limited = limitPropertiesPerFunction(filtered, opts.maxProperties);

  return {
    properties: limited,
    tokensUsed: response.inputTokens + response.outputTokens,
    cost: estimateCost(response.inputTokens, response.outputTokens),
    duration: Date.now() - startedAt,
  };
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

  return toInferResult(response, context, opts, startTime);
}

/**
 * Refine properties using execution feedback from a prior round.
 */
export async function refineProperties(
  apiKey: string | null,
  model: string,
  context: AnalysisContext,
  feedbackSummary: string,
  options: Partial<InferOptions> = {},
): Promise<InferResult> {
  const opts: InferOptions = { ...DEFAULT_OPTIONS, ...options };
  const startTime = Date.now();

  const client = opts.mock
    ? createMockClient()
    : createClient(apiKey!, model, opts.provider, opts.baseURL);

  const systemPrompt = getSystemPrompt();
  const originalPrompt = buildInferPrompt(context);
  const userPrompt = buildRefinementPrompt(originalPrompt, feedbackSummary);
  const tool = getInferTool();

  const response = await client.call(systemPrompt, userPrompt, [tool]);

  return toInferResult(response, context, opts, startTime);
}

// Re-exports
export { createLlmClient } from "./client";
export { createOpenAIClient } from "./openai-client";
export type { LlmClient, ApiResponse, LlmToolSchema } from "./client";
export { createMockClient } from "./mock-client";
export { parseInferResponse } from "./response-parser";
export { scoreProperty, scoreAndFilter, isRedundant, detectRiskTags, computeRiskScore } from "./scoring";
export { buildInferPrompt, getSystemPrompt, getInferTool } from "./prompts/infer-properties";
export { repairProperty } from "./prompts/self-repair";
export { mockRepairProperty } from "./mock-repair";
export { classifyProperties, buildFeedbackSummary, buildRefinementPrompt } from "./prompts/refinement";
export type { PropertyClassification } from "./prompts/refinement";
export { mockRefineProperties } from "./mock-refinement";
export { diagnoseViolation, generateFix, DIAGNOSE_SYSTEM_PROMPT, DIAGNOSE_TOOL, FIX_SYSTEM_PROMPT, FIX_TOOL, buildDiagnosePrompt, buildFixPrompt } from "./prompts/fix";
export type { FixResult } from "./prompts/fix";
export { mockDiagnoseViolation, mockGenerateFix } from "./mock-fix";
export { generateAdaptiveProperties, mapParamGenerators, selectCategories, buildSeedInputs } from "./adaptive-generator";
export type { RawMockProperty } from "./adaptive-generator";
export { extractSignaturesFromPrompt } from "./mock-client";
export { matchTemplates, getAvailableDomains, getTemplateStats } from "./templates";
