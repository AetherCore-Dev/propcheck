/**
 * fast-check code generator — converts PropertyDefinition[] to executable test file.
 *
 * Generates .propcheck/tests/module.fc.ts with fast-check assertions.
 */

import type { PropertyDefinition, GeneratorSpec, RunConfig } from "@propcheck/common";
import { toForwardSlash } from "@propcheck/common";
import * as fs from "node:fs";
import * as path from "node:path";

const JS_BUILTINS = new Set([
  "target", "true", "false", "null", "undefined",
  "Math", "Number", "String", "Array", "JSON", "Object", "RegExp",
  "Date", "Error", "TypeError", "RangeError", "Set", "Map",
  "NaN", "Infinity",
  "parseFloat", "parseInt", "isNaN", "isFinite",
  "encodeURIComponent", "decodeURIComponent",
  "console", "globalThis",
]);

/** Strip newlines and limit length for safe embedding in code comments. */
function toSafeComment(s: string): string {
  return s.replace(/[\r\n\u2028\u2029]/g, " ").slice(0, 200);
}

/**
 * Detect whether the target project is ESM via nearest package.json type field.
 * Our generated fast-check file uses CommonJS `require(...)`, so in ESM projects
 * it must be emitted as `.cjs` instead of `.js`.
 */
function isTypeModuleProject(targetFile: string): boolean {
  let dir = path.dirname(targetFile);

  while (true) {
    const packageJsonPath = path.join(dir, "package.json");
    if (fs.existsSync(packageJsonPath)) {
      try {
        const raw = fs.readFileSync(packageJsonPath, "utf8");
        const pkg = JSON.parse(raw) as { type?: string };
        return pkg.type === "module";
      } catch {
        return false;
      }
    }

    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return false;
}

/**
 * Detect whether the project has explicit "type": "commonjs" in package.json.
 * This causes Node 24+ to reject `export` syntax in .ts files loaded via require().
 */
function isExplicitCJSProject(targetFile: string): boolean {
  let dir = path.dirname(targetFile);

  while (true) {
    const packageJsonPath = path.join(dir, "package.json");
    if (fs.existsSync(packageJsonPath)) {
      try {
        const raw = fs.readFileSync(packageJsonPath, "utf8");
        const pkg = JSON.parse(raw) as { type?: string };
        return pkg.type === "commonjs";
      } catch {
        return false;
      }
    }

    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return false;
}

/** Maximum recursion depth for nested object generators. */
const MAX_GENERATOR_DEPTH = 10;

/**
 * Map a GeneratorSpec to a fast-check Arbitrary expression.
 *
 * @param spec - The generator specification from the LLM
 * @param depth - Current recursion depth (for nested object guards)
 */
function mapGenerator(spec: GeneratorSpec, depth = 0): string {
  if (depth > MAX_GENERATOR_DEPTH) {
    return "fc.anything()";
  }

  const c = spec.constraints ?? {};

  switch (spec.type) {
    case "constant":
      return `fc.constant(${JSON.stringify(c.value ?? null)})`;
    case "integer":
    case "int":
      if (c.min !== undefined || c.max !== undefined) {
        const parts: string[] = [];
        if (c.min !== undefined) parts.push(`min: ${Number(c.min)}`);
        if (c.max !== undefined) parts.push(`max: ${Number(c.max)}`);
        return `fc.integer({ ${parts.join(", ")} })`;
      }
      return "fc.integer()";

    case "float":
    case "number":
      if (c.min !== undefined || c.max !== undefined) {
        const parts: string[] = [];
        if (c.min !== undefined) parts.push(`min: ${Number(c.min)}`);
        if (c.max !== undefined) parts.push(`max: ${Number(c.max)}`);
        return `fc.double({ ${parts.join(", ")}, noNaN: true, noDefaultInfinity: true })`;
      }
      // Default to non-negative range — most business-domain values (prices,
      // counts, percentages) are non-negative, and unconstrained doubles that
      // span -1.7e308..+1.7e308 cause false failures far more often than they
      // find real bugs.
      return "fc.double({ min: 0, noNaN: true, noDefaultInfinity: true })";

    case "string":
      if (c.maxLength !== undefined) {
        return `fc.string({ maxLength: ${Number(c.maxLength)} })`;
      }
      return "fc.string()";

    case "boolean":
      return "fc.boolean()";

    case "array": {
      // Support "items" as a full nested generator spec (LLM format),
      // in addition to elementType/element + elementConstraints (legacy format).
      const items = c.items as { type: string; constraints?: Record<string, unknown> } | undefined;
      const elementType = c.element ?? c.elementType;

      let element: string;
      if (items && typeof items === "object" && typeof items.type === "string") {
        // LLM format: { items: { type: "float", constraints: { min: 0, max: 100 } } }
        element = mapGenerator({ type: items.type, constraints: items.constraints }, depth + 1);
      } else if (elementType) {
        // Build nested element constraints from multiple possible sources:
        //   1. Explicit "elementConstraints" object (preferred)
        //   2. "elementMin"/"elementMax" keys
        //   3. Direct "min"/"max" keys at same level as elementType (real providers)
        const nestedConstraints = c.elementConstraints && typeof c.elementConstraints === "object"
          ? (c.elementConstraints as Record<string, unknown>)
          : {
              ...((c.elementMin ?? c.min) !== undefined ? { min: c.elementMin ?? c.min } : {}),
              ...((c.elementMax ?? c.max) !== undefined ? { max: c.elementMax ?? c.max } : {}),
              ...(c.elementMaxLength !== undefined ? { maxLength: c.elementMaxLength } : {}),
            };
        element = mapGenerator({
            type: String(elementType).replace(/[^a-zA-Z0-9_]/g, ""),
            ...(Object.keys(nestedConstraints).length > 0 ? { constraints: nestedConstraints } : {}),
          }, depth + 1);
      } else {
        element = "fc.anything()";
      }
      const maxLen = c.maxLength ? `, { maxLength: ${Number(c.maxLength)} }` : "";
      return `fc.array(${element}${maxLen})`;
    }

    case "record":
      return "fc.dictionary(fc.string(), fc.anything())";

    case "object": {
      const fields = c.fields;
      if (fields && typeof fields === "object") {
        const entries = Object.entries(fields as Record<string, unknown>);
        if (entries.length === 0) {
          return "fc.record({})";
        }
        const fieldExprs = entries.map(([name, fieldSpec]) => {
          const fs = fieldSpec as { type: string; constraints?: Record<string, unknown> };
          const safeName = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name) ? name : JSON.stringify(name);
          return `${safeName}: ${mapGenerator({ type: fs.type, constraints: fs.constraints }, depth + 1)}`;
        });
        return `fc.record({ ${fieldExprs.join(", ")} })`;
      }
      // No fields — fall through to generic dictionary
      return "fc.dictionary(fc.string(), fc.anything())";
    }

    case "optional": {
      const inner = c.inner as { type: string; constraints?: Record<string, unknown> } | undefined;
      if (inner && typeof inner === "object" && typeof inner.type === "string") {
        return `fc.option(${mapGenerator({ type: inner.type, constraints: inner.constraints }, depth + 1)})`;
      }
      return "fc.option(fc.anything())";
    }

    case "enum": {
      const values = c.values;
      if (Array.isArray(values) && values.length > 0) {
        return `fc.constantFrom(${values.map((v: unknown) => JSON.stringify(v)).join(", ")})`;
      }
      return "fc.anything()";
    }

    default: {
      // Check if constraints contain a "fields" key — treat unknown type names
      // (e.g. "X402PaymentChallenge") with fields as object generators.
      const fields = c.fields;
      if (fields && typeof fields === "object" && Object.keys(fields as object).length > 0) {
        return mapGenerator({ type: "object", constraints: spec.constraints }, depth);
      }
      return "fc.anything()";
    }
  }
}

/**
 * Normalize logical implication syntax used by LLMs.
 *
 * Example: `A implies B` → `!(A) || (B)`
 *
 * Handles chained top-level implications recursively while ignoring occurrences
 * inside quoted strings and nested parentheses.
 */
function normalizeAssertionSyntax(assertion: string): string {
  let depth = 0;
  let quote: "'" | '"' | "`" | null = null;
  let escaped = false;

  for (let i = 0; i < assertion.length; i++) {
    const ch = assertion[i];

    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        continue;
      }
      if (ch === quote) {
        quote = null;
      }
      continue;
    }

    if (ch === "'" || ch === '"' || ch === "`") {
      quote = ch;
      continue;
    }

    if (ch === "(" || ch === "[" || ch === "{") {
      depth++;
      continue;
    }

    if (ch === ")" || ch === "]" || ch === "}") {
      depth = Math.max(0, depth - 1);
      continue;
    }

    if (
      depth === 0 &&
      assertion.startsWith("implies", i) &&
      /\s/.test(assertion[i - 1] ?? "") &&
      /\s/.test(assertion[i + "implies".length] ?? "")
    ) {
      const left = assertion.slice(0, i).trim();
      const right = assertion.slice(i + "implies".length).trim();
      if (!left || !right) {
        return assertion;
      }
      return `!(${normalizeAssertionSyntax(left)}) || (${normalizeAssertionSyntax(right)})`;
    }
  }

  return assertion;
}

/**
 * Generate a fast-check test file for the given properties.
 */
export function generateFastCheckTest(
  properties: readonly PropertyDefinition[],
  targetFile: string,
  testDir: string,
  config: RunConfig,
): { readonly content: string; readonly fileName: string; readonly needsMtsCopy?: boolean } {
  const isTS = targetFile.endsWith(".ts") || targetFile.endsWith(".tsx");
  const explicitCJS = isExplicitCJSProject(targetFile);
  const needsMtsCopy = isTS && explicitCJS;

  // When project is explicit CJS + target is .ts, Node 24 can't require() TS files
  // with export syntax. We generate ESM .mjs test files that import a .mts copy instead.
  const useESM = needsMtsCopy;

  const relativeImport = toForwardSlash(
    path.relative(testDir, targetFile),
  ).replace(/\.(ts|tsx|js|jsx)$/, "");

  let importPathStr: string;
  if (useESM) {
    // For ESM tests: import the .mts copy (same dir as original, .ts → .mts)
    const mtsTarget = targetFile.replace(/\.ts$/, ".mts").replace(/\.tsx$/, ".mtsx");
    importPathStr = toForwardSlash(path.relative(testDir, mtsTarget));
    if (!importPathStr.startsWith(".")) importPathStr = `./${importPathStr}`;
  } else if (isTS) {
    // Keep .ts extension — Node with --experimental-strip-types needs it
    importPathStr = toForwardSlash(path.relative(testDir, targetFile));
    if (!importPathStr.startsWith(".")) importPathStr = `./${importPathStr}`;
  } else {
    const noExt = relativeImport.startsWith(".") ? relativeImport : `./${relativeImport}`;
    importPathStr = noExt;
  }

  // Collect unique function names for imports
  const functionNames = [...new Set(properties.map((p) => p.targetFunction.split(".").pop()!))];

  // Try to resolve fast-check absolute path for reliable loading
  let fcImport: string;
  if (useESM) {
    // ESM: use dynamic import for fast-check
    try {
      const fcPath = require.resolve("fast-check");
      fcImport = `const { default: fc } = await import(${JSON.stringify("file:///" + toForwardSlash(fcPath))});`;
    } catch {
      fcImport = `const { default: fc } = await import("fast-check");`;
    }
  } else {
    let fcRequire = `require("fast-check")`;
    try {
      const fcPath = require.resolve("fast-check");
      fcRequire = `require(${JSON.stringify(toForwardSlash(fcPath))})`;
    } catch {
      // Fall back to relative require — user must have fast-check installed
    }
    fcImport = `const fc = ${fcRequire};`;
  }

  const lines: string[] = [];

  // Header
  lines.push(`// Auto-generated by propcheck — do not edit manually`);
  lines.push(`// Target: ${toForwardSlash(targetFile)}`);
  lines.push(`// Generated: ${new Date().toISOString()}`);
  lines.push(``);

  if (useESM) {
    // ESM wrapper: top-level await with pathToFileURL
    lines.push(`import { pathToFileURL } from "node:url";`);
    lines.push(`import { resolve } from "node:path";`);
    lines.push(``);
    lines.push(fcImport);
    lines.push(`const __targetPath = resolve(import.meta.dirname, "${importPathStr}");`);
    lines.push(`const target = await import(pathToFileURL(__targetPath).href);`);
  } else {
    lines.push(fcImport);
    lines.push(`const target = require("${importPathStr}");`);
  }

  lines.push(``);
  lines.push(`function approxEqual(a, b, absTol = 1e-9, relTol = 1e-6) {`);
  lines.push(`  return Math.abs(a - b) <= absTol + relTol * Math.max(1, Math.abs(a), Math.abs(b));`);
  lines.push(`}`);
  lines.push(``);
  lines.push(`const numRuns = ${config.iterations};`);
  lines.push(``);

  // Generate test for each property
  for (const prop of properties) {
    const generators = Object.entries(prop.generators);
    const arbNames = generators.map(([name]) => name);
    const arbExprs = generators.map(([, spec]) => mapGenerator(spec));

    // Normalize non-JS patterns that real LLMs produce.
    let assertion = normalizeAssertionSyntax(prop.assertion);

    // Qualify bare calls to functions exported from the target module with `target.`.
    // ONLY replace identifiers that are known target-module function names.
    // Use negative lookbehind to avoid replacing method calls like `.funcName(`.
    for (const fn of functionNames) {
      assertion = assertion.replace(
        new RegExp(`(?<!\\.)\\b${fn}\\(`, "g"),
        `target.${fn}(`,
      );
    }

    lines.push(`// ${prop.id}: ${toSafeComment(prop.description)}`);
    lines.push(`// Category: ${toSafeComment(prop.category)}`);
    lines.push(`// Evidence: ${toSafeComment(prop.evidence)}`);
    lines.push(`try {`);

    if (generators.length === 0) {
      // Zero-parameter assertion — wrap with a dummy fc.constant(null) arbitrary
      // so all properties go through the same fc.assert pathway.  fast-check's
      // fc.property() requires at least 1 arbitrary.
      lines.push(`  fc.assert(`);
      lines.push(`    fc.property(`);
      lines.push(`      fc.constant(null),`);
      lines.push(`      () => {`);
      lines.push(`        return ${assertion};`);
      lines.push(`      }`);
      lines.push(`    ),`);
      lines.push(`    { numRuns: 1 }`);
      lines.push(`  );`);
      lines.push(`  console.log(JSON.stringify({ propertyId: "${prop.id}", status: "passed", iterations: 1 }));`);
    } else {
      lines.push(`  fc.assert(`);
      lines.push(`    fc.property(`);

      // Add arbitraries
      for (let i = 0; i < arbExprs.length; i++) {
        lines.push(`      ${arbExprs[i]},`);
      }

      // Add predicate
      lines.push(`      (${arbNames.join(", ")}) => {`);
      lines.push(`        return ${assertion};`);
      lines.push(`      }`);
      lines.push(`    ),`);
      lines.push(`    { numRuns${config.seed !== undefined ? `, seed: ${config.seed}` : ""} }`);
      lines.push(`  );`);
      lines.push(`  console.log(JSON.stringify({ propertyId: "${prop.id}", status: "passed", iterations: numRuns }));`);
    }
    lines.push(`} catch (e) {`);
    lines.push(`  // Parse counterexample from fast-check error message`);
    lines.push(`  let counterexample = null;`);
    lines.push(`  let shrinkSteps = 0;`);
    lines.push(`  const msg = e.message ?? String(e);`);
    lines.push(`  const ceMatch = msg.match(/Counterexample: (\\[.*?\\])/);`);
    lines.push(`  if (ceMatch) { try { counterexample = JSON.parse(ceMatch[1]); } catch {} }`);
    lines.push(`  const shrinkMatch = msg.match(/Shrunk (\\d+) time/);`);
    lines.push(`  if (shrinkMatch) { shrinkSteps = parseInt(shrinkMatch[1], 10); }`);
    lines.push(`  console.log(JSON.stringify({`);
    lines.push(`    propertyId: "${prop.id}",`);
    lines.push(`    status: "failed",`);
    lines.push(`    counterexample,`);
    lines.push(`    errorMessage: msg,`);
    lines.push(`    shrinkSteps`);
    lines.push(`  }));`);
    lines.push(`}`);
    lines.push(``);
  }

  const baseName = path.basename(targetFile, path.extname(targetFile));
  let fileExt: string;
  if (useESM) {
    fileExt = ".fc.mjs"; // ESM for CJS+TS projects
  } else if (isTypeModuleProject(targetFile)) {
    fileExt = ".fc.cjs"; // CJS test in ESM project
  } else {
    fileExt = ".fc.js";  // Default CJS test
  }
  const fileName = `${baseName}${fileExt}`;

  return {
    content: lines.join("\n"),
    fileName,
    needsMtsCopy: needsMtsCopy || undefined,
  };
}
