/**
 * Cross-platform child process runner with timeout.
 */

import { spawn } from "node:child_process";
import { EngineError } from "@propcheck/common";

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
      env: { ...process.env, ...options.env },
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let killed = false;

    proc.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
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
