/**
 * propcheck check — one-command experience.
 *
 * Combines init + infer --mock + run into a single command.
 * The lowest-friction way to try propcheck on any codebase.
 *
 * Usage: propcheck check <target>
 */

import * as path from "node:path";
import { initStore } from "@propcheck/store";
import { inferCommand } from "./infer";
import { runCommand } from "./run";

interface CheckOptions {
  quick?: boolean;
  thorough?: boolean;
  json?: boolean;
  function?: string;
}

export async function checkCommand(
  target: string,
  options: CheckOptions,
): Promise<void> {
  const projectRoot = process.cwd();

  // Step 1: Silently ensure .propcheck/ exists (no init output noise)
  await initStore(projectRoot);

  // Step 2: Infer properties with mock mode
  if (!options.json) {
    console.log(`\n  propcheck check — discovering and testing properties...\n`);
  }

  await inferCommand(target, {
    mock: true,
    skipValidation: false,
    function: options.function,
  });

  // Step 3: Run the properties
  await runCommand(target, {
    quick: options.quick,
    thorough: options.thorough,
    json: options.json,
  });
}
