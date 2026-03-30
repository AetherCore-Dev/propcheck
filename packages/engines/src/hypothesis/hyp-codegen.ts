/**
 * Hypothesis code generator — converts PropertyDefinition[] to Python test file.
 *
 * Generates .propcheck/tests/module.hyp.py with Hypothesis strategies.
 */

import type { PropertyDefinition, GeneratorSpec, RunConfig } from "@propcheck/common";
import { toForwardSlash } from "@propcheck/common";
import * as path from "node:path";

/** Strip newlines and limit length for safe embedding in code comments. */
function toSafeComment(s: string): string {
  return s.replace(/[\r\n\u2028\u2029]/g, " ").slice(0, 200);
}

/**
 * Map a GeneratorSpec to a Hypothesis strategy expression.
 */
function toPythonLiteral(value: unknown): string {
  if (value === null || value === undefined) return "None";
  if (typeof value === "number") {
    if (Number.isNaN(value)) return 'float("nan")';
    if (!Number.isFinite(value)) return value > 0 ? 'float("inf")' : 'float("-inf")';
    return Object.is(value, -0) ? "-0.0" : String(value);
  }
  if (typeof value === "boolean") return value ? "True" : "False";
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => toPythonLiteral(item)).join(", ")}]`;
  if (typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>).map(([key, item]) => `${JSON.stringify(key)}: ${toPythonLiteral(item)}`).join(", ")}}`;
  }
  return JSON.stringify(value);
}

function mapStrategy(spec: GeneratorSpec): string {
  const c = spec.constraints ?? {};

  switch (spec.type) {
    case "constant":
      return `st.just(${toPythonLiteral(c.value ?? null)})`;
    case "integer":
    case "int": {
      const parts: string[] = [];
      if (c.min !== undefined) parts.push(`min_value=${Number(c.min)}`);
      if (c.max !== undefined) parts.push(`max_value=${Number(c.max)}`);
      return parts.length > 0 ? `st.integers(${parts.join(", ")})` : "st.integers()";
    }

    case "float":
    case "number": {
      const parts: string[] = ["allow_nan=False", "allow_infinity=False"];
      if (c.min !== undefined) parts.push(`min_value=${Number(c.min)}`);
      if (c.max !== undefined) parts.push(`max_value=${Number(c.max)}`);
      return `st.floats(${parts.join(", ")})`;
    }

    case "string":
    case "str": {
      if (c.maxLength !== undefined) {
        return `st.text(max_size=${Number(c.maxLength)})`;
      }
      return "st.text()";
    }

    case "boolean":
    case "bool":
      return "st.booleans()";

    case "array":
    case "list": {
      const elementType = c.element ?? c.elementType;
      const nestedConstraints = c.elementConstraints && typeof c.elementConstraints === "object"
        ? (c.elementConstraints as Record<string, unknown>)
        : {
            ...((c.elementMin ?? c.min) !== undefined ? { min: c.elementMin ?? c.min } : {}),
            ...((c.elementMax ?? c.max) !== undefined ? { max: c.elementMax ?? c.max } : {}),
            ...(c.elementMaxLength !== undefined ? { maxLength: c.elementMaxLength } : {}),
          };

      const element = elementType
        ? mapStrategy({
            type: String(elementType).replace(/[^a-zA-Z0-9_]/g, ""),
            ...(Object.keys(nestedConstraints).length > 0 ? { constraints: nestedConstraints } : {}),
          })
        : "st.integers()";
      const maxLen = c.maxLength ? `, max_size=${Number(c.maxLength)}` : "";
      return `st.lists(${element}${maxLen})`;
    }

    case "dict":
    case "record":
      return "st.dictionaries(st.text(min_size=1, max_size=10), st.integers())";

    default:
      return "st.integers()";
  }
}

function translateAssertionToPython(assertion: string): string {
  let translated = assertion;

  translated = translated.replace(/!==/g, "!=");
  translated = translated.replace(/===/g, "==");
  translated = translated.replace(/\btrue\b/g, "True");
  translated = translated.replace(/\bfalse\b/g, "False");
  translated = translated.replace(/\bnull\b/g, "None");
  translated = translated.replace(/\bundefined\b/g, "None");
  translated = translated.replace(/\bMath\.abs\s*\(/g, "abs(");
  translated = translated.replace(/\bparseFloat\s*\(/g, "float(");
  translated = translated.replace(/\bparseInt\s*\(/g, "int(");
  translated = translated.replace(/\bapproxEqual\s*\(/g, "approx_equal(");
  translated = translated.replace(/\s*&&\s*/g, " and ");
  translated = translated.replace(/\s*\|\|\s*/g, " or ");
  translated = translated.replace(/!\s*(?!=)\(/g, "not (");
  translated = translated.replace(/!\s*(?!=)([A-Za-z_][\w.]*(?:\([^()\n]*\))?)/g, "not $1");
  translated = translated.replace(/([A-Za-z_][\w.]*(?:\([^()\n]*\))?)\.length\b/g, "len($1)");

  return translated;
}

/**
 * Generate a Hypothesis test file for the given properties.
 */
export function generateHypothesisTest(
  properties: readonly PropertyDefinition[],
  targetFile: string,
  testsDir: string,
  config: RunConfig,
): { readonly content: string; readonly fileName: string } {
  // Compute relative import: from the test dir to the target module
  const targetDir = path.dirname(targetFile);
  const moduleName = path.basename(targetFile, path.extname(targetFile));

  // Build sys.path manipulation for reliable import
  const relTargetDir = toForwardSlash(path.relative(testsDir, targetDir));

  const lines: string[] = [];

  // Header
  lines.push(`# Auto-generated by propcheck — do not edit manually`);
  lines.push(`# Target: ${toForwardSlash(targetFile)}`);
  lines.push(`# Generated: ${new Date().toISOString()}`);
  lines.push(``);
  lines.push(`import sys`);
  lines.push(`import json`);
  lines.push(`from pathlib import Path`);
  lines.push(``);
  lines.push(`# Add target directory to Python path`);
  lines.push(`sys.path.insert(0, str(Path(__file__).parent / ${JSON.stringify(relTargetDir)}))`);
  lines.push(``);
  lines.push(`from hypothesis import given, settings`);
  lines.push(`from hypothesis import strategies as st`);
  lines.push(`import ${moduleName} as target`);
  lines.push(``);
  lines.push(`def approx_equal(a, b, abs_tol=1e-9, rel_tol=1e-6):`);
  lines.push(`    return abs(a - b) <= abs_tol + rel_tol * max(1, abs(a), abs(b))`);
  lines.push(``);
  lines.push(`MAX_EXAMPLES = ${config.iterations}`);
  lines.push(``);

  // Generate test for each property
  for (const prop of properties) {
    const funcName = prop.targetFunction.split(".").pop()!;
    const generators = Object.entries(prop.generators);

    // Build @given decorator args
    const givenArgs = generators
      .map(([name, spec]) => `${name}=${mapStrategy(spec)}`)
      .join(", ");

    const paramNames = generators.map(([name]) => name).join(", ");

    // Replace bare function calls with target.funcName
    let assertion = prop.assertion.replace(
      new RegExp(`\\b${funcName}\\(`, "g"),
      `target.${funcName}(`,
    );

    // Translate JavaScript-flavored syntax that LLMs commonly emit into Python.
    assertion = translateAssertionToPython(assertion);

    lines.push(`# ${prop.id}: ${toSafeComment(prop.description)}`);
    lines.push(`# Category: ${toSafeComment(prop.category)}`);
    lines.push(`# Evidence: ${toSafeComment(prop.evidence)}`);
    lines.push(`def test_${prop.id}():`);
    lines.push(`    try:`);

    if (generators.length === 0) {
      // Zero-parameter assertion — run as simple assert
      lines.push(`        assert ${assertion}`);
    } else {
      lines.push(`        @given(${givenArgs})`);
      lines.push(`        @settings(max_examples=MAX_EXAMPLES)`);
      lines.push(`        def inner(${paramNames}):`);
      lines.push(`            assert ${assertion}`);
      lines.push(`        inner()`);
    }

    lines.push(`        print(json.dumps({"propertyId": "${prop.id}", "status": "passed", "iterations": ${generators.length === 0 ? 1 : "MAX_EXAMPLES"}}))`);
    lines.push(`    except AssertionError as e:`);
    lines.push(`        print(json.dumps({"propertyId": "${prop.id}", "status": "failed", "counterexample": str(e), "errorMessage": str(e), "shrinkSteps": 0}))`);
    lines.push(`    except Exception as e:`);
    lines.push(`        msg = str(e)`);
    lines.push(`        print(json.dumps({"propertyId": "${prop.id}", "status": "failed", "counterexample": msg[:200], "errorMessage": msg[:200], "shrinkSteps": 0}))`);
    lines.push(``);
  }

  // Run all tests
  lines.push(`if __name__ == "__main__":`);
  for (const prop of properties) {
    lines.push(`    test_${prop.id}()`);
  }

  const fileName = `${moduleName}.hyp.py`;

  return {
    content: lines.join("\n"),
    fileName,
  };
}
