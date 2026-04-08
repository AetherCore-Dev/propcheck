/**
 * Cross-platform child process runner with timeout.
 */

import { spawn } from "node:child_process";
import { EngineError } from "@propcheck/common";

/** Maximum bytes to capture from stdout/stderr to prevent OOM. */
const MAX_OUTPUT_BYTES = 10 * 1024 * 1024; // 10MB

/** Env var prefixes/names that must never leak to generated test subprocesses. */
const SENSITIVE_ENV_PATTERNS: readonly RegExp[] = [
  /^(?:PROPCHECK_)?API_?KEY$/i,
  /^(?:PROPCHECK_)?SECRET/i,
  /^(?:PROPCHECK_)?TOKEN$/i,
  /^ANTHROPIC_API_KEY$/i,
  /^OPENAI_API_KEY$/i,
  /^AWS_SECRET/i,
  /^GITHUB_TOKEN$/i,
  /^NPM_TOKEN$/i,
  /^GH_TOKEN$/i,
];

/** Remove sensitive keys from caller-provided env overrides. @internal Exported for testing. */
export function filterSensitiveEnv(env: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (!SENSITIVE_ENV_PATTERNS.some((p) => p.test(key))) {
      result[key] = value;
    }
  }
  return result;
}

export interface ProcessResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
}

/**
 * Spawn a child process and capture output.
 *
 * Handles timeout (kills process) and cross-platform quirks.
 */
export function runProcess(
  command: string,
  args: readonly string[],
  options: {
    readonly cwd?: string;
    readonly timeout?: number;
    readonly env?: Record<string, string>;
  } = {},
): Promise<ProcessResult> {
  const timeout = options.timeout ?? 60_000;

  return new Promise((resolve, reject) => {
    const proc = spawn(command, args as string[], {
      cwd: options.cwd,
      env: {
        // Only forward safe env vars — never leak API keys to generated test code
        PATH: process.env["PATH"] ?? "",
        HOME: process.env["HOME"] ?? process.env["USERPROFILE"] ?? "",
        TEMP: process.env["TEMP"] ?? process.env["TMPDIR"] ?? "/tmp",
        TMP: process.env["TMP"] ?? "",
        LANG: process.env["LANG"] ?? "",
        TERM: process.env["TERM"] ?? "",
        SHELL: process.env["SHELL"] ?? "",
        // Windows-specific
        SYSTEMROOT: process.env["SYSTEMROOT"] ?? "",
        APPDATA: process.env["APPDATA"] ?? "",
        LOCALAPPDATA: process.env["LOCALAPPDATA"] ?? "",
        PROGRAMFILES: process.env["PROGRAMFILES"] ?? "",
        COMSPEC: process.env["COMSPEC"] ?? "",
        // Python-specific
        PYTHONPATH: process.env["PYTHONPATH"] ?? "",
        VIRTUAL_ENV: process.env["VIRTUAL_ENV"] ?? "",
        // Caller overrides (e.g. NODE_PATH) — strip any sensitive keys
        ...filterSensitiveEnv(options.env ?? {}),
      },
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let killed = false;

    proc.stdout.on("data", (data: Buffer) => {
      if (stdout.length < MAX_OUTPUT_BYTES) {
        stdout += data.toString();
      }
    });

    proc.stderr.on("data", (data: Buffer) => {
      if (stderr.length < MAX_OUTPUT_BYTES) {
        stderr += data.toString();
      }
    });

    const timer = setTimeout(() => {
      killed = true;
      proc.kill("SIGTERM");
      // Force kill after 5s if SIGTERM doesn't work
      setTimeout(() => proc.kill("SIGKILL"), 5000);
    }, timeout);

    proc.on("close", (code) => {
      clearTimeout(timer);
      if (killed) {
        reject(
          new EngineError(`Process timed out after ${timeout}ms`, {
            command,
            args,
            stdout: stdout.slice(0, 500),
            stderr: stderr.slice(0, 500),
          }),
        );
        return;
      }
      resolve({ stdout, stderr, exitCode: code ?? 1 });
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(
        new EngineError(`Failed to spawn process: ${err.message}`, {
          command,
          args,
        }),
      );
    });
  });
}
