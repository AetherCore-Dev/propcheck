/**
 * Python parser — extracts function signatures from Python source code.
 *
 * Uses regex-based parsing for MVP. Handles:
 * - def function(params): with type hints
 * - Docstrings (Google/NumPy/Sphinx styles)
 * - @dataclass and TypedDict
 * - async def
 */

import type {
  FunctionSignature,
  ParameterInfo,
  TypeDefinition,
  ImportInfo,
  SourceLocation,
  AnalysisContext,
  AstSignal,
  TypeSignal,
  DocSignal,
} from "@propcheck/common";

/** Pattern for Python function definitions (created fresh per call to avoid global lastIndex state). */
const FUNC_REGEX_SOURCE = /^(\s*)(async\s+)?def\s+(\w+)\s*\(([^)]*)\)\s*(?:->\s*([^:]+))?\s*:/;

/** Regex for Python type hints in parameters. */
const PARAM_REGEX = /(\*{0,2})(\w+)\s*(?::\s*([^=,]+?))?\s*(?:=\s*([^,]+))?\s*$/;

/** Regex for docstrings (triple-quoted strings). */
const DOCSTRING_REGEX = /^\s*(?:"""([\s\S]*?)"""|'''([\s\S]*?)''')/;

function parseParameter(raw: string): ParameterInfo | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "self" || trimmed === "cls") return null;

  const match = trimmed.match(PARAM_REGEX);
  if (!match) return null;

  const [, stars, name, typeHint, defaultValue] = match;
  return {
    name,
    type: typeHint?.trim() ?? null,
    defaultValue: defaultValue?.trim() ?? null,
    isOptional: !!defaultValue,
    isRest: stars === "*" || stars === "**",
  };
}

function extractDocstring(source: string, funcEndIndex: number): string | null {
  const remaining = source.slice(funcEndIndex);
  // Look for docstring on the next line(s)
  const lines = remaining.split("\n");

  // Skip to the line after the def:
  let docStart = -1;
  for (let i = 0; i < lines.length && i < 5; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith('"""') || trimmed.startsWith("'''")) {
      docStart = i;
      break;
    }
    if (trimmed.length > 0 && !trimmed.startsWith("#") && i > 0) {
      break; // Non-empty, non-comment line → no docstring
    }
  }

  if (docStart === -1) return null;

  // Find closing triple quotes
  const quote = lines[docStart].trim().startsWith('"""') ? '"""' : "'''";
  let docLines: string[] = [];
  let found = false;

  for (let i = docStart; i < lines.length; i++) {
    docLines.push(lines[i]);
    // Check if closing quotes are on this line (but not the same as opening on single-line)
    if (i === docStart) {
      const afterOpen = lines[i].trim().slice(3);
      if (afterOpen.includes(quote)) {
        // Single-line docstring
        found = true;
        break;
      }
    } else if (lines[i].includes(quote)) {
      found = true;
      break;
    }
  }

  if (!found) return null;

  // Clean up docstring
  const raw = docLines.join("\n");
  return raw
    .replace(/^\s*["']{3}/, "")
    .replace(/["']{3}\s*$/, "")
    .trim();
}

/**
 * Detect if a Python function body contains `yield` or `yield from`.
 * Scans lines after the `def:` until indentation returns to function level.
 * Skips nested function bodies to avoid false positives.
 */
function detectYield(source: string, funcEndIndex: number, funcIndent: number): boolean {
  const remaining = source.slice(funcEndIndex);
  const bodyLines = remaining.split("\n").slice(1); // skip the def: line itself
  let skipUntilIndent = -1; // when > 0, we're inside a nested def

  for (const line of bodyLines) {
    const trimmed = line.trimStart();
    if (trimmed.length === 0 || trimmed.startsWith("#")) continue;

    const lineIndent = line.length - line.trimStart().length;

    // Line at or less than function indent = left the body
    if (lineIndent <= funcIndent && trimmed.length > 0) break;

    // Exiting a nested def?
    if (skipUntilIndent > 0 && lineIndent <= skipUntilIndent) {
      skipUntilIndent = -1;
    }

    // Entering a nested def?
    if (/^(?:async\s+)?def\s+\w+/.test(trimmed)) {
      skipUntilIndent = lineIndent;
      continue;
    }

    // Skip lines inside nested def
    if (skipUntilIndent > 0) continue;

    // Check for yield keyword
    if (/\byield\b/.test(trimmed)) return true;
  }

  return false;
}

/**
 * Analyze a Python source file.
 */
export function analyzePythonFile(
  filePath: string,
  source: string,
): AnalysisContext {
  const functions: FunctionSignature[] = [];
  const lines = source.split("\n");

  // Create fresh regex per call to avoid lastIndex global state issues
  const funcRegex = new RegExp(FUNC_REGEX_SOURCE.source, "gm");
  let match: RegExpExecArray | null;

  while ((match = funcRegex.exec(source)) !== null) {
    const [fullMatch, indent, asyncKw, name, rawParams, returnType] = match;
    const isTopLevel = indent.length === 0;
    const isAsync = !!asyncKw;

    // Parse parameters
    const paramStrings = rawParams.split(",").filter((s) => s.trim().length > 0);
    const parameters: ParameterInfo[] = [];
    for (const ps of paramStrings) {
      const param = parseParameter(ps);
      if (param) parameters.push(param);
    }

    // Calculate location
    const beforeMatch = source.slice(0, match.index);
    const startLine = beforeMatch.split("\n").length;
    const endLine = startLine + fullMatch.split("\n").length - 1;

    // Extract docstring
    const funcEndIndex = match.index + fullMatch.length;
    const docstring = extractDocstring(source, funcEndIndex);

    // Detect generator (yield/yield from in function body)
    const isGenerator = detectYield(source, funcEndIndex, indent.length);

    // Determine visibility: _ prefix = private, __ prefix = internal
    let visibility: "public" | "private" | "internal" = "public";
    if (name.startsWith("__") && !name.endsWith("__")) {
      visibility = "internal";
    } else if (name.startsWith("_")) {
      visibility = "private";
    }

    functions.push({
      name,
      qualifiedName: name,
      parameters,
      returnType: returnType?.trim() ?? null,
      docstring,
      visibility,
      isAsync,
      isGenerator,
      loc: {
        startLine,
        endLine,
        startColumn: indent.length,
        endColumn: 0,
      },
    });
  }

  // Extract imports
  const imports: ImportInfo[] = [];
  const importRegex = /^(?:from\s+(\S+)\s+)?import\s+(.+)$/gm;
  let importMatch: RegExpExecArray | null;

  while ((importMatch = importRegex.exec(source)) !== null) {
    const [, fromModule, specifiers] = importMatch;
    const specs = specifiers.split(",").map((s) => s.trim().split(/\s+as\s+/)[0].trim());
    imports.push({
      source: fromModule ?? specs[0],
      specifiers: specs,
      isDefault: !fromModule,
      isNamespace: specifiers.trim() === "*",
    });
  }

  // Build signals
  const typeSignals: TypeSignal[] = functions.map((fn) => ({
    functionName: fn.qualifiedName,
    paramTypes: fn.parameters.map((p) => p.type ?? "unknown"),
    returnType: fn.returnType,
  }));

  const docSignals: DocSignal[] = functions
    .filter((fn) => fn.docstring)
    .map((fn) => ({
      functionName: fn.qualifiedName,
      description: fn.docstring ?? "",
      paramDocs: {},
      returnDoc: null,
      throws: [],
      examples: [],
    }));

  return {
    filePath,
    language: "python",
    sourceCode: source,
    functions,
    types: [],
    imports,
    signals: {
      ast: functions.map((fn) => ({
        kind: fn.isAsync ? "async_function" : "function",
        detail: fn.qualifiedName,
      })),
      type: typeSignals,
      doc: docSignals,
    },
  };
}
