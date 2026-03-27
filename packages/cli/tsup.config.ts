import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs"],
  target: "node18",
  outDir: "dist-bundle",
  clean: true,
  splitting: false,
  sourcemap: true,
  dts: false,
  // Bundle all workspace packages into one file
  noExternal: [
    "@propcheck/common",
    "@propcheck/config",
    "@propcheck/parser",
    "@propcheck/store",
    "@propcheck/llm",
    "@propcheck/engines",
    "@propcheck/reporter",
  ],
  // Keep these as external — user must have them installed
  external: [
    "@anthropic-ai/sdk",
    "fast-check",
    "chalk",
    "commander",
    "zod",
    "typescript",
  ],
});
