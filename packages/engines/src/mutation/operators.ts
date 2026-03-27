/**
 * Mutation operators — inject small code changes to test property effectiveness.
 *
 * Each mutant is a single atomic change. If a property catches the mutant
 * (test fails), the property "kills" that mutant. High kill rate = strong properties.
 *
 * Operators based on standard mutation testing literature (Pitest, Stryker):
 *   - Arithmetic: + → -, * → /, etc.
 *   - Relational: > → >=, === → !==, etc.
 *   - Logical: && → ||, ! removal
 *   - Boundary: off-by-one (n → n+1, n → n-1)
 *   - Return: return x → return 0, return true → return false
 *   - Removal: delete statement
 */

/** A single mutation applied to source code. */
export interface Mutant {
  readonly id: string;
  readonly operator: string;
  readonly description: string;
  readonly line: number;
  readonly original: string;
  readonly replacement: string;
  readonly mutatedSource: string;
}

/** Result of testing one mutant against all properties. */
export interface MutantResult {
  readonly mutantId: string;
  readonly status: "killed" | "survived" | "error";
  readonly killedBy?: string; // property ID that killed it
}

/** Summary of mutation testing run. */
export interface MutationReport {
  readonly totalMutants: number;
  readonly killed: number;
  readonly survived: number;
  readonly errors: number;
  readonly mutationScore: number; // killed / (killed + survived)
  readonly results: readonly MutantResult[];
  readonly survivingMutants: readonly Mutant[];
  readonly duration: number;
}

interface MutationPattern {
  readonly name: string;
  readonly description: string;
  readonly pattern: RegExp;
  readonly replacement: string | ((match: string) => string);
}

/** All mutation operators. */
const MUTATION_OPERATORS: readonly MutationPattern[] = [
  // Arithmetic
  { name: "ARITH_PLUS_TO_MINUS", description: "+ → -", pattern: /(?<=[^+=])\+(?!=)/g, replacement: "-" },
  { name: "ARITH_MINUS_TO_PLUS", description: "- → +", pattern: /(?<=[^-=])-(?!=)/g, replacement: "+" },
  { name: "ARITH_MUL_TO_DIV", description: "* → /", pattern: /\*(?!=)/g, replacement: "/" },
  { name: "ARITH_DIV_TO_MUL", description: "/ → *", pattern: /\/(?!=)/g, replacement: "*" },

  // Relational
  { name: "REL_GT_TO_GTE", description: "> → >=", pattern: /(?<!=)>(?!=)/g, replacement: ">=" },
  { name: "REL_LT_TO_LTE", description: "< → <=", pattern: /(?<!=)<(?!=)/g, replacement: "<=" },
  { name: "REL_GTE_TO_GT", description: ">= → >", pattern: />=/g, replacement: ">" },
  { name: "REL_LTE_TO_LT", description: "<= → <", pattern: /<=/g, replacement: "<" },
  { name: "REL_EQ_TO_NEQ", description: "=== → !==", pattern: /===/g, replacement: "!==" },
  { name: "REL_NEQ_TO_EQ", description: "!== → ===", pattern: /!==/g, replacement: "===" },

  // Boundary (off-by-one)
  { name: "BOUND_ZERO_TO_ONE", description: "0 → 1", pattern: /(?<=[\s(,=])0(?=[\s),;])/g, replacement: "1" },
  { name: "BOUND_ONE_TO_ZERO", description: "1 → 0", pattern: /(?<=[\s(,=])1(?=[\s),;])/g, replacement: "0" },
  { name: "BOUND_100_TO_99", description: "100 → 99", pattern: /\b100\b/g, replacement: "99" },

  // Logical
  { name: "LOGIC_AND_TO_OR", description: "&& → ||", pattern: /&&/g, replacement: "||" },
  { name: "LOGIC_OR_TO_AND", description: "|| → &&", pattern: /\|\|/g, replacement: "&&" },
  { name: "LOGIC_TRUE_TO_FALSE", description: "true → false", pattern: /\btrue\b/g, replacement: "false" },
  { name: "LOGIC_FALSE_TO_TRUE", description: "false → true", pattern: /\bfalse\b/g, replacement: "true" },

  // Return value
  { name: "RET_EMPTY_STRING", description: 'return "..." → return ""', pattern: /return\s+"[^"]*"/g, replacement: 'return ""' },
  { name: "RET_ZERO", description: "return N → return 0", pattern: /return\s+\d+/g, replacement: "return 0" },
];

/**
 * Generate all possible mutants for a source file.
 *
 * Only mutates function bodies, skips comments and imports.
 */
export function generateMutants(source: string, filePath: string): readonly Mutant[] {
  const mutants: Mutant[] = [];
  const lines = source.split("\n");
  let mutantId = 0;

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    const trimmed = line.trim();

    // Skip comments, imports, exports declarations, empty lines
    if (
      trimmed.startsWith("//") ||
      trimmed.startsWith("/*") ||
      trimmed.startsWith("*") ||
      trimmed.startsWith("import ") ||
      trimmed.startsWith("export function") ||
      trimmed.startsWith("export async function") ||
      trimmed.startsWith("export type") ||
      trimmed.startsWith("export interface") ||
      trimmed === "" ||
      trimmed === "}" ||
      trimmed === "{" ||
      trimmed.startsWith("/**")
    ) {
      continue;
    }

    for (const op of MUTATION_OPERATORS) {
      // Reset regex state
      const regex = new RegExp(op.pattern.source, op.pattern.flags);
      let match: RegExpExecArray | null;

      while ((match = regex.exec(line)) !== null) {
        const original = match[0];
        const replacement = typeof op.replacement === "function"
          ? op.replacement(original)
          : op.replacement;

        // Skip if replacement is same as original
        if (original === replacement) continue;

        // Create mutated line
        const mutatedLine = line.slice(0, match.index) + replacement + line.slice(match.index + original.length);

        // Create full mutated source
        const mutatedLines = [...lines];
        mutatedLines[lineIdx] = mutatedLine;
        const mutatedSource = mutatedLines.join("\n");

        mutants.push({
          id: `mut_${mutantId++}`,
          operator: op.name,
          description: `Line ${lineIdx + 1}: ${op.description} — "${original}" → "${replacement}"`,
          line: lineIdx + 1,
          original,
          replacement,
          mutatedSource,
        });
      }
    }
  }

  return mutants;
}
