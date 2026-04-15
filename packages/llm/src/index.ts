/**
 * Main entry point for @propcheck/llm.
 *
 * Orchestrates: build prompt → call API → parse response → score/filter → return
 */

import type { AnalysisContext, FunctionSignature, PropertyDefinition } from "@propcheck/common";
import { hashContent } from "@propcheck/common";
import { createLlmClient } from "./client";
import type { LlmClient, ApiResponse } from "./client";
import { createOpenAIClient } from "./openai-client";
import { createCliClient } from "./cli-client";
import { createMockClient } from "./mock-client";
import { LlmError } from "@propcheck/common";
import { buildInferPrompt, getSystemPrompt, getInferTool } from "./prompts/infer-properties";
import { buildRefinementPrompt } from "./prompts/refinement";
import { parseInferResponse } from "./response-parser";
import { scoreAndFilter } from "./scoring";
import { matchTemplates } from "./templates";

export interface InferOptions {
  readonly maxProperties: number;
  readonly minScore: number;
  readonly mock: boolean;
  readonly provider?: "anthropic" | "openai-compatible" | "cli";
  readonly baseURL?: string | null;
  readonly cliCommand?: string | null;
  readonly cliArgs?: readonly string[] | null;
  readonly siblingFunctions?: readonly FunctionSignature[];
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
  for (const props of functionGroups.values()) {
    limited.push(...props.slice(0, maxProperties));
  }

  return limited;
}

export function buildTemplateProperties(
  context: AnalysisContext,
  options: { readonly sourceHash?: string; readonly startingIndex?: number } = {},
): readonly PropertyDefinition[] {
  if (context.spec) {
    return [];
  }

  const sourceHash = options.sourceHash ?? hashContent(context.sourceCode);
  let counter = options.startingIndex ?? 1;
  const properties: PropertyDefinition[] = [];

  for (const fn of context.functions) {
    for (const template of matchTemplates(fn)) {
      properties.push({
        id: `prop_${String(counter).padStart(3, "0")}`,
        targetFunction: template.targetFunction,
        description: template.description,
        category: template.category,
        assertion: template.assertion,
        generators: Object.freeze({ ...template.generators }),
        seedInputs: Object.freeze(template.seedInputs.map((seed) => ({ ...seed }))),
        score: 0,
        riskScore: 0,
        riskTags: Object.freeze([]),
        status: "accepted",
        confidence: template.confidence,
        evidence: template.evidence,
        evidenceSource: "domain",
        sourceHash,
        inferredAt: new Date().toISOString(),
        modelId: "community-template",
      });
      counter++;
    }
  }

  return properties;
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
  const templateProperties = buildTemplateProperties(context, {
    sourceHash,
    startingIndex: rawProperties.length + 1,
  });

  const filtered = scoreAndFilter([...rawProperties, ...templateProperties], opts.minScore);
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
  apiKey: string | null,
  model: string,
  provider: "anthropic" | "openai-compatible" | "cli" = "anthropic",
  baseURL?: string | null,
  cliOptions?: { command: string; args?: readonly string[] },
): LlmClient {
  if (provider === "cli") {
    if (!cliOptions?.command) {
      throw new LlmError("CLI provider requires --cli-command to be set", {});
    }
    return createCliClient({
      command: cliOptions.command,
      args: cliOptions.args,
    });
  }
  if (provider === "openai-compatible") {
    return createOpenAIClient(apiKey!, model, baseURL ?? undefined);
  }
  return createLlmClient(apiKey!, model, baseURL);
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
  const cliOpts = opts.provider === "cli" && opts.cliCommand
    ? { command: opts.cliCommand, args: opts.cliArgs ?? undefined }
    : undefined;
  const client = opts.mock
    ? createMockClient()
    : createClient(apiKey, model, opts.provider, opts.baseURL, cliOpts);

  // Build prompt
  const systemPrompt = getSystemPrompt();
  const userPrompt = buildInferPrompt(context, opts.siblingFunctions);
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

  const cliOpts = opts.provider === "cli" && opts.cliCommand
    ? { command: opts.cliCommand, args: opts.cliArgs ?? undefined }
    : undefined;
  const client = opts.mock
    ? createMockClient()
    : createClient(apiKey, model, opts.provider, opts.baseURL, cliOpts);

  const systemPrompt = getSystemPrompt();
  const originalPrompt = buildInferPrompt(context, opts.siblingFunctions);
  const userPrompt = buildRefinementPrompt(originalPrompt, feedbackSummary);
  const tool = getInferTool();

  const response = await client.call(systemPrompt, userPrompt, [tool]);

  return toInferResult(response, context, opts, startTime);
}

// Re-exports
export { createLlmClient } from "./client";
export { createOpenAIClient } from "./openai-client";
export { createCliClient } from "./cli-client";
export type { LlmClient, ApiResponse, LlmToolSchema } from "./client";
export { createMockClient } from "./mock-client";
export { parseInferResponse } from "./response-parser";
export { scoreProperty, scoreAndFilter, isRedundant, detectRiskTags, computeRiskScore } from "./scoring";
export { buildInferPrompt, getSystemPrompt, getInferTool } from "./prompts/infer-properties";
export { repairProperty } from "./prompts/self-repair";
export { mockRepairProperty } from "./mock-repair";
export { classifyProperties, buildFeedbackSummary, buildRefinementPrompt, shouldAutoRefine } from "./prompts/refinement";
export type { PropertyClassification, FeedbackOptions } from "./prompts/refinement";
export { mockRefineProperties } from "./mock-refinement";
export { diagnoseViolation, generateFix, DIAGNOSE_SYSTEM_PROMPT, DIAGNOSE_TOOL, FIX_SYSTEM_PROMPT, FIX_TOOL, buildDiagnosePrompt, buildFixPrompt } from "./prompts/fix";
export type { FixResult } from "./prompts/fix";
export { mockDiagnoseViolation, mockGenerateFix } from "./mock-fix";
export { generateAdaptiveProperties, mapParamGenerators, selectCategories, buildSeedInputs } from "./adaptive-generator";
export type { RawMockProperty } from "./adaptive-generator";
export { extractSignaturesFromPrompt } from "./mock-client";
export { matchTemplates, getAvailableDomains, getTemplateStats } from "./templates";
export type { RawTemplateProperty } from "./templates";
export { expandGeneratorRanges, hasExpandableRanges } from "./boundary-expansion";
