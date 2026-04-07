/**
 * OpenAI-compatible API client — works with OpenRouter, one-api, new-api, etc.
 *
 * Implements the same LlmClient interface as client.ts but speaks the
 * OpenAI /v1/chat/completions wire protocol instead of Anthropic /v1/messages.
 *
 * Zero external dependencies — uses Node.js built-in fetch().
 */

import { LlmError } from "@propcheck/common";
import type { LlmClient, LlmToolSchema, LlmCallOptions, ApiResponse } from "./client";

const RETRY_DELAYS = [1000, 2000, 4000];

interface OpenAITool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

interface OpenAIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OpenAIToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

interface OpenAIChoice {
  message: {
    role: string;
    content: string | null;
    tool_calls?: OpenAIToolCall[];
  };
  finish_reason: string;
}

interface OpenAIResponse {
  id: string;
  model: string;
  choices: OpenAIChoice[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/** Convert Anthropic-style tool schema to OpenAI function calling format. */
function toOpenAITools(tools: readonly LlmToolSchema[]): OpenAITool[] {
  return tools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.input_schema,
    },
  }));
}

/**
 * Create an OpenAI-compatible API client.
 *
 * Works with any service that implements the OpenAI /v1/chat/completions endpoint:
 * OpenRouter, one-api, new-api, vllm, ollama, LiteLLM, etc.
 */
export function createOpenAIClient(
  apiKey: string,
  model: string,
  baseURL: string = "https://openrouter.ai/api/v1",
): LlmClient {
  // Normalize: strip trailing slash, ensure no /chat/completions suffix
  const base = baseURL.replace(/\/+$/, "");
  const endpoint = `${base}/chat/completions`;

  return {
    async call(
      systemPrompt: string,
      userPrompt: string,
      tools: readonly LlmToolSchema[],
      options: LlmCallOptions = {},
    ): Promise<ApiResponse> {
      const maxTokens = options.maxTokens ?? 4096;
      const temperature = options.temperature ?? 0.2;

      const messages: OpenAIMessage[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ];

      const openaiTools = toOpenAITools(tools);

      const body: Record<string, unknown> = {
        model,
        messages,
        max_tokens: maxTokens,
        temperature,
      };

      // Only include tools and tool_choice if tools are provided
      if (openaiTools.length > 0) {
        body.tools = openaiTools;
        body.tool_choice = {
          type: "function",
          function: { name: tools[0].name },
        };
      }

      let lastError: unknown;

      for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
        try {
          const response = await fetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
              // OpenRouter-specific headers (harmless for other providers)
              "HTTP-Referer": "https://github.com/AetherCore-Dev/propcheck",
              "X-Title": "propcheck",
            },
            body: JSON.stringify(body),
          });

          if (!response.ok) {
            const errorText = await response.text().catch(() => "");

            if (response.status === 401 || response.status === 403) {
              throw new LlmError("Invalid API key", {
                code: "AUTH_ERROR",
                status: response.status,
              });
            }

            // Retry on rate limit (429) and server errors (5xx)
            if (
              (response.status === 429 || response.status >= 500) &&
              attempt < RETRY_DELAYS.length
            ) {
              await sleep(RETRY_DELAYS[attempt]);
              continue;
            }

            throw new LlmError(
              `API request failed: ${response.status} ${response.statusText} - ${sanitizeErrorMessage(errorText.slice(0, 500))}`,
              { status: response.status },
            );
          }

          const data = (await response.json()) as OpenAIResponse;

          // Extract tool call result
          const choice = data.choices?.[0];
          const toolCall = choice?.message?.tool_calls?.[0];

          let content: unknown = null;
          if (toolCall) {
            try {
              content = JSON.parse(toolCall.function.arguments);
            } catch {
              // If arguments is not valid JSON, return as string
              content = toolCall.function.arguments;
            }
          }

          return {
            content,
            inputTokens: data.usage?.prompt_tokens ?? 0,
            outputTokens: data.usage?.completion_tokens ?? 0,
            model: data.model ?? model,
          };
        } catch (err: unknown) {
          // Re-throw LlmError as-is
          if (err instanceof LlmError) {
            throw err;
          }

          lastError = err;

          if (attempt < RETRY_DELAYS.length) {
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
  const raw = err instanceof Error ? err.message : typeof err === "string" ? err : String(err);
  return raw
    .replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]")
    .replace(/\b(?:sk-|sk_|hf_|ghp_|gho_|ghu_|ghs_|ghr_)[a-zA-Z0-9_-]{10,}/g, "[REDACTED]")
    .replace(/key[=:]\s*\S+/gi, "key=[REDACTED]")
    .replace(/\beyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, "[JWT_REDACTED]");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
