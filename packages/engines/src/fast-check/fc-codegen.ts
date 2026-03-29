/**
 * fast-check code generator — converts PropertyDefinition[] to executable test file.
 *
 * Generates .propcheck/tests/module.fc.ts with fast-check assertions.
 */

import type { PropertyDefinition, GeneratorSpec, RunConfig } from "@propcheck/common";
import { toForwardSlash } from "@propcheck/common";
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
 * Map a GeneratorSpec to a fast-check Arbitrary expression.
 */
function mapGenerator(spec: GeneratorSpec): string {
  const c = spec.constraints ?? {};

  switch (spec.type) {
    case "integer":
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
      const elementType = c.element ?? c.elementType;

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

      const element = elementType
        ? mapGenerator({
            type: String(elementType).replace(/[^a-zA-Z0-9_]/g, ""),
            ...(Object.keys(nestedConstraints).length > 0 ? { constraints: nestedConstraints } : {}),
          })
        : "fc.anything()";
      const maxLen = c.maxLength ? `, { maxLength: ${Number(c.maxLength)} }` : "";
      return `fc.array(${element}${maxLen})`;
    }

    case "record":
      return "fc.dictionary(fc.string(), fc.anything())";

    default:
      return "fc.anything()";
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
): { readonly content: string; readonly fileName: string } {
  const relativeImport = toForwardSlash(
    path.relative(testDir, targetFile),
  ).replace(/\.(ts|tsx|js|jsx)$/, "");

  // Keep the file extension for TypeScript files so Node.js --experimental-strip-types
  // can resolve them. For JS files, strip the extension per Node.js convention.
  let importPathStr: string;
  if (targetFile.endsWith(".ts") || targetFile.endsWith(".tsx")) {
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
  let fcRequire = `require("fast-check")`;
  try {
    const fcPath = require.resolve("fast-check");
    fcRequire = `require(${JSON.stringify(toForwardSlash(fcPath))})`;
  } catch {
    // Fall back to relative require — user must have fast-check installed
  }

  const lines: string[] = [];

  // Header
  lines.push(`// Auto-generated by propcheck — do not edit manually`);
  lines.push(`// Target: ${toForwardSlash(targetFile)}`);
  lines.push(`// Generated: ${new Date().toISOString()}`);
  lines.push(``);
  lines.push(`const fc = ${fcRequire};`);
  lines.push(`const target = require("${importPathStr}");`);
  lines.push(``);
  lines.push(`const numRuns = ${config.iterations};`);
  lines.push(``);

  // Generate test for each property
  for (const prop of properties) {
    const funcName = prop.targetFunction.split(".").pop()!;
    const generators = Object.entries(prop.generators);
    const arbNames = generators.map(([name]) => name);
    const arbExprs = generators.map(([, spec]) => mapGenerator(spec));

    // Normalize non-JS patterns that real LLMs produce.
    let assertion = normalizeAssertionSyntax(prop.assertion);

    // Replace bare function calls with target.funcName in assertion.
    // Use negative lookbehind to avoid replacing method calls like `.funcName(`.
    assertion = assertion.replace(
      new RegExp(`(?<!\\.)\\b${funcName}\\(`, "g"),
      `target.${funcName}(`,
    );

    // Qualify bare function calls from the target module with `target.`.
    // We must NOT qualify:
    //   - Method calls (e.g. `.test(`, `.every(`, `.abs(`)
    //   - Generator parameter names (e.g. `price`, `discount`)
    //   - JS built-in globals (Math, Number, parseFloat, etc.)
    //   - Keywords (true, false, null, undefined)
    for (const varName of assertion.match(/\b[a-zA-Z_]\w*\b/g) ?? []) {
      if (
        varName !== funcName &&
        !JS_BUILTINS.has(varName) &&
        !arbNames.includes(varName) &&
        !functionNames.includes(varName)
      ) {
        // Only qualify standalone function calls — NOT method calls preceded by `.`
        // Use negative lookbehind (?<!\.) to skip `.method(` patterns.
        assertion = assertion.replace(
          new RegExp(`(?<!\\.)\\b${varName}\\(`, "g"),
          `target.${varName}(`,
        );
      }
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
  const fileName = `${baseName}.fc.js`;

  return {
    content: lines.join("\n"),
    fileName,
  };
}
