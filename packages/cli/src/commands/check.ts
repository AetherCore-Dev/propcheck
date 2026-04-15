/**
 * propcheck check — one-command experience.
 *
 * Combines init + infer --mock + run into a single command.
 * The lowest-friction way to try propcheck on any codebase.
 *
 * Usage: propcheck check <target>
 */

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
  const exitCode = await runCommand(target, {
    quick: options.quick,
    thorough: options.thorough,
    json: options.json,
    function: options.function,
    suppressExit: true,
  });

  if (exitCode === 0 && !options.json) {
    console.log("  Next steps:");
    console.log(`    propcheck props ${target}     # inspect saved properties and statuses`);
    console.log(`    propcheck infer ${target}     # switch from mock inference to real AI`);
    console.log(`    propcheck run ${target}       # re-run stored properties later\n`);
  }

  if (exitCode !== 0) {
    process.exit(exitCode);
  }
}
