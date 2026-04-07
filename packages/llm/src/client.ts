/**
 * Anthropic SDK wrapper with retry logic and cost tracking.
 */

import Anthropic from "@anthropic-ai/sdk";
import { LlmError } from "@propcheck/common";

export interface LlmCallOptions {
  readonly maxTokens?: number;
  readonly temperature?: number;
}

export interface LlmToolSchema {
  readonly name: string;
  readonly description: string;
  readonly input_schema: Record<string, unknown>;
}

export interface ApiResponse {
  readonly content: unknown;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly model: string;
}

export interface LlmClient {
  call(
    systemPrompt: string,
    userPrompt: string,
    tools: readonly LlmToolSchema[],
    options?: LlmCallOptions,
  ): Promise<ApiResponse>;
}

const RETRY_DELAYS = [1000, 2000, 4000];

/** Create an Anthropic API client. Supports custom baseURL for proxies/mirrors. */
export function createLlmClient(apiKey: string, model: string, baseURL?: string | null): LlmClient {
  const client = new Anthropic({
    apiKey,
    ...(baseURL ? { baseURL } : {}),
  });

  return {
    async call(
      systemPrompt: string,
      userPrompt: string,
      tools: readonly LlmToolSchema[],
      options: LlmCallOptions = {},
    ): Promise<ApiResponse> {
      const maxTokens = options.maxTokens ?? 4096;
      const temperature = options.temperature ?? 0.2;

      let lastError: unknown;

      for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
        try {
          const response = await client.messages.create({
            model,
            max_tokens: maxTokens,
            temperature,
            system: systemPrompt,
            messages: [{ role: "user", content: userPrompt }],
            tools: tools as Anthropic.Messages.Tool[],
            tool_choice: tools.length > 0
              ? { type: "tool" as const, name: tools[0].name }
              : undefined,
          });

          // Extract tool_use content
          const toolUse = response.content.find(
            (block): block is Anthropic.Messages.ToolUseBlock =>
              block.type === "tool_use",
          );

          return {
            content: toolUse?.input ?? null,
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens,
            model: response.model,
          };
        } catch (err: unknown) {
          lastError = err;

          // Don't retry auth errors
          if (err instanceof Anthropic.AuthenticationError) {
            throw new LlmError("Invalid API key", {
              code: "AUTH_ERROR",
              status: 401,
            });
          }

          // Retry on rate limit and server errors
          const isRetryable =
            err instanceof Anthropic.RateLimitError ||
            err instanceof Anthropic.InternalServerError;

          if (isRetryable && attempt < RETRY_DELAYS.length) {
            await sleep(RETRY_DELAYS[attempt]);
            continue;
          }

          break;
        }
      }

      throw new LlmError(
        `API call failed after ${RETRY_DELAYS.length + 1} attempts: ${sanitizeErrorMessage(lastError)}`,
        { attempts: RETRY_DELAYS.length + 1 },
      );
    },
  };
}

/** Strip potential secrets (Bearer tokens, API keys) from error messages. */
function sanitizeErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  return raw
    .replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]")
    .replace(/sk-[a-zA-Z0-9_-]{10,}/g, "sk-[REDACTED]")
    .replace(/key[=:]\s*\S+/gi, "key=[REDACTED]");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
