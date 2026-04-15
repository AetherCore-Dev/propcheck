/**
 * Inference prompt builder — constructs the LLM prompt from AnalysisContext.
 */

import type { AnalysisContext, FunctionSignature } from "@propcheck/common";
import type { LlmToolSchema } from "../client";

const SYSTEM_PROMPT = `You are propcheck, a security-minded AI that discovers testable properties (invariants) of code.

Your goal is NOT to prove the code works — it is to find where the code BREAKS.

## Thinking Process (follow this order)

Step 1: Read the implementation carefully. Understand what it actually does, not just what docs claim.
Step 2: Think adversarially — what inputs would a malicious or careless caller provide?
  - Values OUTSIDE documented ranges (if docs say 0-100, test -50 and 200)
  - Type boundary values: NaN, Infinity, -0, Number.MAX_SAFE_INTEGER, empty string "", empty array []
  - Null/undefined if the type system allows widening
  - Inputs that violate documented preconditions — the function may not validate them
Step 3: For each risk area, generate a property that TESTS the boundary.
Step 4: Also generate standard invariant properties (idempotent, conservation, roundtrip, etc.) where the code structure genuinely supports them.

## Property Categories
- boundary: edge case behavior, input validation gaps, result constraints
- metamorphic: transformed input relates to transformed output (e.g. f(2*x) = 2*f(x))
- conservation: a quantity is preserved (array length, total sum, element membership)
- idempotent: applying twice equals applying once (f(f(x)) === f(x)) — ONLY when code genuinely normalizes
- roundtrip: encode/decode, format/parse returns original within tolerance
- monotonic: output preserves ordering
- equivalence: commutativity, associativity, or two implementations agree
- cross-function: relationship between two functions (decode(encode(x)) === x)
- type-preservation: output structure/type matches contract

## CRITICAL: Generator Ranges Must Push Boundaries
Generator ranges MUST extend BEYOND documented input ranges. This is the whole point of property-based testing.
- If docs say "discount 0-100", set generator to {min: -50, max: 200}
- If docs say "price (non-negative)", set generator to {min: -1000, max: 100000}
- If docs say "array of prices", include empty arrays and large arrays
The goal is to discover what happens when callers don't follow the documentation.

## Anti-Patterns (DO NOT generate these — they waste test cycles)
1. typeof checks: "typeof f(x) === 'string'" — TypeScript already guarantees this. NEVER generate typeof properties.
2. Identity tautologies: "f(x) === f(x)" — JavaScript always evaluates the same expression to the same value in the same execution. This tests nothing. For determinism, store result in a variable first: "(() => { const r1 = f(x); const r2 = f(x); return r1 === r2; })()"
3. Implementation mirroring: restating the function body as the assertion.
   BAD: "applyDiscount(p, d) ≈ p * (1 - d/100)" — this IS the implementation, you're testing nothing
   BAD: "calculateTax(p, r) ≈ p * r" — this IS the implementation
   GOOD: "applyDiscount(p, d) >= 0" — this is an invariant the implementation should maintain but doesn't validate
4. Overly conservative generators: ranges that match documented "valid" input ranges test only the happy path.

## Rules
1. Every property MUST be testable with random inputs via fast-check/Hypothesis
2. Prefer adversarial properties that find real bugs over gentle properties that always pass
3. Include seed inputs: one normal case, one boundary, one extreme (beyond documented range)
4. Assertions must be valid JavaScript expressions — not natural language
5. For floating-point: use Math.abs(a - b) < tolerance instead of ===
6. When a spec/plan is present, treat it as higher-priority intent than implementation
7. Look for cross-function relationships in sibling functions
8. For custom types/interfaces, use type "object" with "fields" constraint
9. Set evidenceSource to: code, doc, spec, domain, or mixed`;

function formatFunction(fn: FunctionSignature): string {
  const params = fn.parameters
    .map((p) => {
      let s = p.name;
      if (p.type) s += `: ${p.type}`;
      if (p.isOptional) s += "?";
      if (p.defaultValue) s += ` = ${p.defaultValue}`;
      if (p.isRest) s = `...${s}`;
      return s;
    })
    .join(", ");

  const ret = fn.returnType ? `: ${fn.returnType}` : "";
  const prefix = fn.isAsync ? "async " : "";
  return `${prefix}function ${fn.qualifiedName}(${params})${ret}`;
}

export function buildInferPrompt(
  context: AnalysisContext,
  siblingFunctions?: readonly FunctionSignature[],
): string {
  const lines: string[] = [];

  lines.push(`File: ${context.filePath}`);
  lines.push(`Language: ${context.language}`);
  lines.push("");

  // Include source code — essential for LLM to understand implementation
  lines.push("## Source Code:");
  lines.push("```" + context.language);
  lines.push(context.sourceCode);
  lines.push("```");
  lines.push("");

  // Functions
  if (context.spec) {
    lines.push("## External spec / plan:");
    lines.push(`Source: ${context.spec.sourcePath}`);
    if (context.spec.generalRequirements.length > 0) {
      lines.push("General requirements:");
      for (const requirement of context.spec.generalRequirements) {
        lines.push(`- ${requirement}`);
      }
    }
    for (const specFn of context.spec.functions) {
      lines.push(`Spec for ${specFn.functionName}:`);
      for (const requirement of specFn.requirements) {
        lines.push(`- ${requirement}`);
      }
      for (const constraint of specFn.constraints) {
        lines.push(`  Constraint: ${constraint.kind} (${constraint.detail})`);
      }
    }
    lines.push("");
  }

  lines.push("## Functions to analyze:");
  for (const fn of context.functions) {
    lines.push(`\n### ${fn.qualifiedName}`);
    lines.push(`Signature: ${formatFunction(fn)}`);
    if (fn.docstring) {
      lines.push(`Documentation: ${fn.docstring}`);
    }
    lines.push(`Visibility: ${fn.visibility}`);
  }

  // Types
  if (context.types.length > 0) {
    lines.push("\n## Type definitions:");
    for (const t of context.types) {
      lines.push(`${t.kind} ${t.name} {`);
      for (const prop of t.properties) {
        const opt = prop.isOptional ? "?" : "";
        const ro = prop.isReadonly ? "readonly " : "";
        lines.push(`  ${ro}${prop.name}${opt}: ${prop.type}`);
      }
      lines.push("}");
    }
  }

  // Doc signals — @param, @returns, @throws, @example
  const docSignals = context.signals.doc;
  if (docSignals.length > 0) {
    lines.push("\n## Documentation signals:");
    for (const doc of docSignals) {
      const paramEntries = Object.entries(doc.paramDocs);
      if (paramEntries.length > 0) {
        lines.push(`Parameters for ${doc.functionName}:`);
        for (const [name, desc] of paramEntries) {
          lines.push(`  @param ${name} — ${desc}`);
        }
      }
      if (doc.returnDoc) {
        lines.push(`  @returns ${doc.returnDoc}`);
      }
      if (doc.throws.length > 0) {
        lines.push(`  @throws ${doc.throws.join(", ")}`);
      }
      if (doc.examples.length > 0) {
        lines.push(`Examples for ${doc.functionName}:`);
        for (const ex of doc.examples) {
          lines.push(`  ${ex}`);
        }
      }
    }
  }

  lines.push("\n## Instructions:");
  lines.push("Infer 3-5 testable properties per function.");
  if (siblingFunctions && siblingFunctions.length > 0) {
    lines.push("Look for cross-function properties between the analyzed functions and these sibling functions:");
    for (const fn of siblingFunctions) {
      lines.push(`  - ${formatFunction(fn)}`);
    }
  }
  lines.push("Use the infer_properties tool to return structured results.");

  return lines.join("\n");
}

export function getSystemPrompt(): string {
  return SYSTEM_PROMPT;
}

export function getInferTool(): LlmToolSchema {
  return {
    name: "infer_properties",
    description: "Return inferred properties for the analyzed functions",
    input_schema: {
      type: "object",
      properties: {
        properties: {
          type: "array",
          items: {
            type: "object",
            properties: {
              targetFunction: { type: "string", description: "Qualified function name" },
              description: { type: "string", description: "Human-readable description" },
              category: {
                type: "string",
                enum: [
                  "roundtrip", "idempotent", "conservation", "monotonic",
                  "equivalence", "type-preservation", "cross-function",
                  "boundary", "metamorphic",
                ],
              },
              assertion: { type: "string", description: "Testable code expression" },
              generators: {
                type: "object",
                description: "Map of parameter name to generator spec",
                additionalProperties: {
                  type: "object",
                  properties: {
                    type: { type: "string" },
                    constraints: {
                      type: "object",
                      description: "Generator constraints. For 'object' type, include 'fields' mapping field names to nested generator specs. For 'optional', include 'inner' with the wrapped generator spec. For 'enum', include 'values' array.",
                    },
                  },
                  required: ["type"],
                },
              },
              seedInputs: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    label: { type: "string", enum: ["normal", "boundary", "extreme"] },
                    value: {},
                  },
                  required: ["label", "value"],
                },
                minItems: 1,
                maxItems: 3,
              },
              evidence: { type: "string", description: "Code/doc evidence for this property" },
              confidence: { type: "number", minimum: 0, maximum: 1 },
              evidenceSource: {
                type: "string",
                enum: ["code", "doc", "spec", "domain", "mixed"],
              },
              relatedFunctions: {
                type: "array",
                items: { type: "string" },
                description: "Other function names involved in cross-function properties (optional)",
              },
            },
            required: [
              "targetFunction", "description", "category", "assertion",
              "generators", "seedInputs", "evidence", "confidence", "evidenceSource",
            ],
          },
        },
      },
      required: ["properties"],
    },
  };
}
