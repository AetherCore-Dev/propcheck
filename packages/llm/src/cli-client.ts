/**
 * CLI-based LLM client — invokes an external CLI tool (e.g. `codebuddy`)
 * as the LLM backend for property inference.
 *
 * This enables propcheck to work with any LLM accessible through a CLI,
 * without requiring direct HTTP API access or API keys.
 *
 * Usage:
 *   propcheck infer --provider cli --cli-command codebuddy <file>
 *
 * The CLI tool must support:
 *   <command> -p --output-format text "<prompt>"
 * and return raw text to stdout.
 */

import { spawn } from "node:child_process";
import { LlmError } from "@propcheck/common";
import type { LlmClient, ApiResponse, LlmToolSchema, LlmCallOptions } from "./client";

/** Options for creating a CLI-based LLM client. */
export interface CliClientOptions {
  /** CLI command to execute (e.g. "codebuddy", "claude-internal") */
  readonly command: string;
  /** Additional CLI arguments (default: ["-p", "--output-format", "text"]) */
  readonly args?: readonly string[];
  /** Extra environment variables to set for the child process */
  readonly env?: Readonly<Record<string, string>>;
  /** Timeout in milliseconds (default: 300_000 = 5 minutes) */
  readonly timeout?: number;
}

const DEFAULT_ARGS = ["-p", "--output-format", "text"];
const DEFAULT_TIMEOUT = 300_000;

/**
 * Build a text prompt from system prompt, user prompt, and tool schema.
 *
 * Since CLI tools typically don't support tool_use / function_calling,
 * we embed the output schema as plain-text instructions.
 */
function buildTextPrompt(
  systemPrompt: string,
  userPrompt: string,
  tools: readonly LlmToolSchema[],
): string {
  const parts: string[] = [];

  // Include the full system prompt (adversarial framing, categories, anti-patterns, rules)
  // This is the same SYSTEM_PROMPT from infer-properties.ts — critical for quality.
  if (systemPrompt.trim()) {
    parts.push(systemPrompt.trim());
    parts.push("");
  }

  parts.push(userPrompt);

  if (tools.length > 0) {
    parts.push("");
    parts.push("Respond with ONLY a raw JSON object (no markdown fences, no explanation).");
    parts.push("The assertion MUST be a valid executable JavaScript expression (not natural language).");
    parts.push("Category MUST be one of: roundtrip, idempotent, conservation, monotonic, equivalence, type-preservation, cross-function, boundary, metamorphic.");
    parts.push("evidenceSource MUST be one of: code, doc, spec, domain, mixed.");
    parts.push("seedInputs labels MUST be one of: normal, boundary, extreme.");
    parts.push("Generator ranges MUST extend beyond documented input ranges to test boundaries.");
    parts.push("All JSON values must be valid JSON literals — no .repeat() or JS expressions in values.");
    parts.push("");
    parts.push("EXACT format (follow precisely):");
    parts.push(`{"properties":[{"targetFunction":"clamp","description":"clamp result is within bounds","category":"boundary","assertion":"(() => { const r = clamp(value, min, max); return r >= min && r <= max; })()","generators":{"value":{"type":"float","constraints":{"min":-1000,"max":1000}},"min":{"type":"float","constraints":{"min":-100,"max":100}},"max":{"type":"float","constraints":{"min":-100,"max":100}}},"seedInputs":[{"label":"normal","value":{"value":5,"min":0,"max":10}},{"label":"boundary","value":{"value":-50,"min":0,"max":10}},{"label":"extreme","value":{"value":999,"min":0,"max":10}}],"evidence":"Math.min(Math.max(value, min), max) ensures result is bounded","confidence":0.95,"evidenceSource":"code"}]}`);
  }

  return parts.join("\n");
}

/**
 * Sanitize common LLM JSON errors:
 * - "a".repeat(N) → "aaa..." (actual string)
 * - Trailing commas before } or ]
 */
function sanitizeLlmJson(text: string): string {
  // Replace "X".repeat(N) patterns with actual repeated strings (capped at 100 chars)
  let result = text.replace(/"([^"]{1,5})"\.repeat\((\d+)\)/g, (_match, char, count) => {
    const n = Math.min(parseInt(count, 10), 100);
    return JSON.stringify(char.repeat(n));
  });
  // Remove trailing commas before } or ]
  result = result.replace(/,\s*([}\]])/g, "$1");
  return result;
}

/**
 * Extract JSON from LLM text output.
 * Handles common LLM response patterns:
 *   - Pure JSON
 *   - JSON wrapped in markdown fences (```json ... ```)
 *   - JSON preceded/followed by explanation text
 */
function extractJson(text: string): unknown {
  const trimmed = sanitizeLlmJson(text.trim());

  // Try direct JSON parse first
  try {
    return JSON.parse(trimmed);
  } catch (e) {
    // Log parse position for debugging
    const parseErr = e instanceof SyntaxError ? e.message : "";
    // continue to fallback strategies
    void parseErr;
  }

  // Try extracting from markdown fences
  const fenceMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1].trim());
    } catch {
      // continue
    }
  }

  // Try finding the outermost { ... } block (handles trailing text after JSON)
  const firstBrace = trimmed.indexOf("{");
  if (firstBrace !== -1) {
    // Find matching closing brace by counting depth
    let depth = 0;
    let inString = false;
    let escape = false;
    for (let i = firstBrace; i < trimmed.length; i++) {
      const ch = trimmed[i];
      if (escape) { escape = false; continue; }
      if (ch === "\\") { escape = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          try {
            return JSON.parse(trimmed.slice(firstBrace, i + 1));
          } catch {
            // continue looking
          }
        }
      }
    }
  }

  throw new LlmError(
    `Failed to parse JSON from CLI output (${trimmed.length} chars). First 200 chars: ${trimmed.slice(0, 200)}`,
    { outputLength: trimmed.length },
  );
}

/**
 * Create an LLM client that delegates to an external CLI tool.
 */
export function createCliClient(options: CliClientOptions): LlmClient {
  const {
    command,
    args = DEFAULT_ARGS,
    env: extraEnv = {},
    timeout = DEFAULT_TIMEOUT,
  } = options;

  return {
    async call(
      systemPrompt: string,
      userPrompt: string,
      tools: readonly LlmToolSchema[],
      _options?: LlmCallOptions,
    ): Promise<ApiResponse> {
      const prompt = buildTextPrompt(systemPrompt, userPrompt, tools);

      // Pass prompt via stdin to avoid shell escaping issues and argument length limits.
      // The command receives "-" as the prompt argument to indicate "read from stdin".
      const childEnv = { ...process.env, ...extraEnv };
      const fullArgs = [...args, "-"];

      const result = await runCliProcessWithStdin(command, fullArgs, prompt, childEnv, timeout);

      // Try to parse output even if exit code is non-zero — some CLI tools
      // (like codebuddy) may exit with code 1 while still producing valid output.
      if (!result.stdout.trim()) {
        if (result.exitCode !== 0) {
          throw new LlmError(
            `CLI command "${command}" exited with code ${result.exitCode}: ${result.stderr.slice(0, 500)}`,
            { command, exitCode: result.exitCode },
          );
        }
        throw new LlmError(
          `CLI command "${command}" returned empty output`,
          { command, stderr: result.stderr.slice(0, 500) },
        );
      }

      const content = extractJson(result.stdout);
      const inputTokens = Math.floor(prompt.length / 4);
      const outputTokens = Math.floor(result.stdout.length / 4);

      return {
        content,
        inputTokens,
        outputTokens,
        model: `cli:${command}`,
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Process execution
// ---------------------------------------------------------------------------

interface CliResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
}

function runCliProcessWithStdin(
  command: string,
  args: readonly string[],
  stdinData: string,
  env: NodeJS.ProcessEnv,
  timeout: number,
): Promise<CliResult> {
  return new Promise((resolve, reject) => {
    const isWindows = process.platform === "win32";
    const proc = spawn(command, args as string[], {
      env,
      stdio: ["pipe", "pipe", "pipe"],
      shell: isWindows,
      timeout,
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });

    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    proc.on("close", (code) => {
      resolve({ stdout, stderr, exitCode: code ?? 1 });
    });

    proc.on("error", (err) => {
      reject(
        new LlmError(
          `Failed to spawn CLI command "${command}": ${err.message}`,
          { command },
        ),
      );
    });

    // Write prompt to stdin and close
    proc.stdin.write(stdinData);
    proc.stdin.end();
  });
}
