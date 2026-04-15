/**
 * Source-code semantic analyzer — extracts signals from function bodies
 * to determine which property categories are safe to generate.
 *
 * Used by the adaptive generator in mock mode to avoid generating
 * algebraic properties (idempotent, commutative, monotonic) for
 * functions that don't actually have those properties.
 *
 * Design: lightweight regex scanning, NOT full AST parsing.
 * This keeps it fast, dependency-free, and good-enough for mock mode.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface SemanticSignals {
  /** Function performs sorting (.sort(), .toSorted()) */
  readonly hasSort: boolean;
  /** Function involves hashing/digest/crypto */
  readonly hasHash: boolean;
  /** Function involves path operations (path.join, resolve, etc.) */
  readonly hasPathOps: boolean;
  /** Function uses subtraction (a - b) — non-commutative */
  readonly hasSubtraction: boolean;
  /** Function uses division (a / b) — non-commutative */
  readonly hasDivision: boolean;
  /** Function concatenates strings (+, concat, join, template literals) */
  readonly hasStringConcat: boolean;
  /** Function formats output (.toFixed, template, format, pad) */
  readonly hasFormat: boolean;
  /** Function uses .map() — preserves length but changes values */
  readonly hasMap: boolean;
  /** Function uses .filter() — reduces length, idempotent candidate */
  readonly hasFilter: boolean;
  /** Function uses .reduce() / .fold — aggregation */
  readonly hasReduce: boolean;
  /** Function has conditional logic (if/else, ternary) */
  readonly hasConditional: boolean;
  /** Function uses Math operations */
  readonly hasMathOps: boolean;
  /** Function involves Date/timestamp operations */
  readonly hasDateOps: boolean;
  /** Function uses RegExp */
  readonly hasRegex: boolean;
  /** Function involves I/O (fs, fetch, spawn, exec, read, write) */
  readonly hasIO: boolean;
  /** Function is async */
  readonly isAsync: boolean;
  /** Function involves Set (deduplication) */
  readonly hasSet: boolean;
  /** Function involves JSON.parse/stringify */
  readonly hasJsonOps: boolean;
}

// ---------------------------------------------------------------------------
// Body extraction
// ---------------------------------------------------------------------------

/**
 * Extract the body of a specific function from source code.
 * Returns the text between the opening `{` and closing `}` of the function,
 * or null if the function can't be found.
 */
export function extractFunctionBody(
  functionName: string,
  sourceCode: string,
): string | null {
  // Match: export function name(, function name(, const name = (, name(
  // Handle both named function declarations and arrow functions
  const escapedName = functionName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    // export function name(...) {
    new RegExp(`(?:export\\s+)?(?:async\\s+)?function\\s+${escapedName}\\s*\\([^)]*\\)[^{]*\\{`),
    // const/let/var name = (...) => {
    new RegExp(`(?:const|let|var)\\s+${escapedName}\\s*=\\s*(?:async\\s+)?\\([^)]*\\)\\s*(?::\\s*\\S+\\s*)?=>\\s*\\{`),
    // const/let/var name = function(...) {
    new RegExp(`(?:const|let|var)\\s+${escapedName}\\s*=\\s*(?:async\\s+)?function\\s*\\([^)]*\\)[^{]*\\{`),
    // name(...) { — method in class/object
    new RegExp(`${escapedName}\\s*\\([^)]*\\)\\s*(?::\\s*\\S+\\s*)?\\{`),
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(sourceCode);
    if (!match) continue;

    // Find the matching closing brace, skipping strings/comments
    const startIdx = match.index + match[0].length;
    let depth = 1;
    let i = startIdx;
    while (i < sourceCode.length && depth > 0) {
      const ch = sourceCode[i];

      // Skip single-line comments
      if (ch === "/" && sourceCode[i + 1] === "/") {
        const nl = sourceCode.indexOf("\n", i + 2);
        i = nl === -1 ? sourceCode.length : nl + 1;
        continue;
      }
      // Skip block comments
      if (ch === "/" && sourceCode[i + 1] === "*") {
        const end = sourceCode.indexOf("*/", i + 2);
        i = end === -1 ? sourceCode.length : end + 2;
        continue;
      }
      // Skip string literals (single, double, template)
      if (ch === "'" || ch === '"' || ch === "`") {
        const quote = ch;
        i++;
        while (i < sourceCode.length) {
          if (sourceCode[i] === "\\" ) { i += 2; continue; }
          if (sourceCode[i] === quote) { i++; break; }
          // Template literal nested expressions: skip ${...}
          if (quote === "`" && sourceCode[i] === "$" && sourceCode[i + 1] === "{") {
            // Skip past nested template expression — count braces
            let tDepth = 1;
            i += 2;
            while (i < sourceCode.length && tDepth > 0) {
              if (sourceCode[i] === "{") tDepth++;
              else if (sourceCode[i] === "}") tDepth--;
              if (tDepth > 0) i++;
            }
            if (tDepth === 0) i++; // skip closing }
            continue;
          }
          i++;
        }
        continue;
      }
      // Skip regex literals — simple heuristic: /.../ not preceded by a value token
      // (not handled — too complex for this lightweight scanner, rare edge case)

      if (ch === "{") depth++;
      else if (ch === "}") depth--;
      i++;
    }

    if (depth === 0) {
      return sourceCode.slice(startIdx, i - 1);
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Signal detection
// ---------------------------------------------------------------------------

/** Detect semantic signals from a function body string. */
function detectSignals(body: string): SemanticSignals {
  return {
    hasSort: /\.sort\s*\(/.test(body) || /\.toSorted\s*\(/.test(body),
    hasHash: /\bhash\b/i.test(body) || /\bdigest\b/i.test(body) || /\bcrypto\b/i.test(body) || /\bcreateHash\b/.test(body),
    hasPathOps: /\bpath\s*\./.test(body) || /\bpath\.join\b/.test(body) || /\bpath\.resolve\b/.test(body) || /\bpath\.relative\b/.test(body),
    hasSubtraction: /[^-]\s*-\s*[^->=]/.test(body) && !/^\s*\/\//.test(body),
    hasDivision: /[^/]\s*\/\s*[^/*>=]/.test(body),
    hasStringConcat: /\.concat\s*\(/.test(body) || /\.join\s*\(/.test(body) || /\+\s*["'`]/.test(body) || /["'`]\s*\+/.test(body),
    hasFormat: /\.toFixed\s*\(/.test(body) || /\.padStart\s*\(/.test(body) || /\.padEnd\s*\(/.test(body) || /\bformat\b/i.test(body) || /`[^`]*\$\{/.test(body),
    hasMap: /\.map\s*\(/.test(body),
    hasFilter: /\.filter\s*\(/.test(body),
    hasReduce: /\.reduce\s*\(/.test(body) || /\.reduceRight\s*\(/.test(body),
    hasConditional: /\bif\s*\(/.test(body) || /\?.*:/.test(body) || /\bswitch\s*\(/.test(body),
    hasMathOps: /\bMath\s*\./.test(body),
    hasDateOps: /\bDate\b/.test(body) || /\btimestamp\b/i.test(body),
    hasRegex: /\bRegExp\b/.test(body) || /\.match\s*\(/.test(body) || /\.replace\s*\(/.test(body) || /\.test\s*\(/.test(body),
    hasIO: /\bfs\b\s*\./.test(body) || /\breadFile\b/.test(body) || /\bwriteFile\b/.test(body) || /\bfetch\s*\(/.test(body) || /\bspawn\b/.test(body) || /\bexec\b/.test(body) || /\breaddir\b/.test(body),
    isAsync: /\bawait\b/.test(body),
    hasSet: /\bnew\s+Set\b/.test(body),
    hasJsonOps: /\bJSON\s*\.parse\b/.test(body) || /\bJSON\s*\.stringify\b/.test(body),
  };
}

// ---------------------------------------------------------------------------
// Category safety
// ---------------------------------------------------------------------------

/**
 * Determine whether a property category is safe to generate for a function,
 * based on its semantic signals and function name.
 */
export function isCategorySafe(
  category: string,
  functionName: string,
  signals: SemanticSignals,
): boolean {
  switch (category) {
    case "idempotent": {
      // SAFE: sort, unique/dedup, normalize, trim, clamp, flatten, compact, abs, lower/upper case
      const idempotentNames = /\b(sort|unique|dedup|deduplicate|distinct|normalize|canonical|trim|strip|clean|clamp|bound|limit|cap|flatten|compact|abs|lower|upper|toLower|toUpper)\b/i;
      if (idempotentNames.test(functionName)) return true;
      // Also safe if function uses .filter() or new Set() (dedup patterns)
      if (signals.hasFilter || signals.hasSet) return true;
      // UNSAFE: hash, crypto, encode, format, path ops, string concat, IO, date, JSON ops
      if (signals.hasHash || signals.hasFormat || signals.hasStringConcat ||
          signals.hasPathOps || signals.hasDateOps || signals.hasIO ||
          signals.hasJsonOps) return false;
      // UNSAFE: generic math that modifies values (reduce, map without clear normalize intent)
      if (signals.hasReduce || signals.hasMathOps) return false;
      // Default: unsafe — idempotent is a strong claim
      return false;
    }

    case "equivalence": {
      // This category is used for commutativity: f(a,b) === f(b,a)
      // SAFE: add/sum, min, max, gcd, lcm, equals, deepEqual, union, intersection, merge (symmetric)
      const commutativeNames = /\b(add|sum|min|max|gcd|lcm|equals|deepEqual|isEqual|compare|union|intersection|and|or|xor)\b/i;
      if (commutativeNames.test(functionName)) return true;
      // UNSAFE: subtraction, division, path ops, string concat, any ordered operation
      if (signals.hasSubtraction || signals.hasDivision ||
          signals.hasPathOps || signals.hasStringConcat) return false;
      // UNSAFE: conditional logic suggests argument order matters
      if (signals.hasConditional) return false;
      // Default: unsafe — commutativity is a strong claim
      return false;
    }

    case "monotonic": {
      // SAFE: only for functions that actually sort
      if (signals.hasSort) return true;
      // SAFE: function name explicitly indicates sorting
      const sortNames = /\b(sort|order|rank|arrange)\b/i;
      if (sortNames.test(functionName)) return true;
      // Default: unsafe
      return false;
    }

    case "roundtrip": {
      // SAFE: only for known inverse patterns (encode/decode, serialize/deserialize)
      // Cross-function roundtrip is handled separately by findInverseSibling
      // Single-function roundtrip (involution) is rare — only safe for reverse, negate, flip
      const involutionNames = /\b(reverse|flip|invert|negate|toggle|complement|not)\b/i;
      if (involutionNames.test(functionName)) return true;
      // Default: unsafe
      return false;
    }

    // These categories are generally safe to generate:
    case "boundary":
    case "conservation":
    case "type-preservation":
    case "metamorphic":
    case "cross-function":
      return true;

    default:
      return true;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Analyze a function's source code and return semantic signals.
 * Returns null if the function body cannot be extracted.
 */
export function analyzeFunction(
  functionName: string,
  sourceCode: string,
): SemanticSignals | null {
  const body = extractFunctionBody(functionName, sourceCode);
  if (!body) return null;
  return detectSignals(body);
}
