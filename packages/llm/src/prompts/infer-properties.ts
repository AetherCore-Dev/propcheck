/**
 * Inference prompt builder — constructs the LLM prompt from AnalysisContext.
 */

import type { AnalysisContext, FunctionSignature } from "@propcheck/common";
import type { LlmToolSchema } from "../client";

const SYSTEM_PROMPT = `You are propcheck, an expert AI that discovers testable properties (invariants) of code.

Given a function's signature, types, and documentation, you infer properties that should ALWAYS hold true for ANY valid input.

Property categories:
- roundtrip: encode then decode returns original (decode(encode(x)) === x)
- idempotent: applying twice is same as once (f(f(x)) === f(x))
- conservation: a quantity is preserved (sum before === sum after)
- monotonic: output preserves ordering (if a <= b then f(a) <= f(b))
- equivalence: two implementations agree (f(x) === g(x))
- type-preservation: output type matches expectation
- cross-function: relationship between two functions
- boundary: edge case behavior (result >= 0, handles empty input)
- metamorphic: transformed input relates to transformed output

Rules:
1. Every property MUST be testable with random inputs
2. Every property MUST cite evidence from the code or docs
3. Prefer specific properties over generic ones
4. Include seed inputs: one normal case, one boundary, one extreme
5. Generators must cover the function's parameter types
6. Assertions must reference the target function's return value
7. Do NOT generate tautologies (always-true) or trivial type checks
8. Avoid fragile assertions:
   - Do NOT use exact equality (===) for floating-point comparisons; use tolerance-based checks
   - Do NOT use tiny absolute tolerances (< 1e-9) for sums or scaled values
   - If a property depends on business constraints (e.g. price >= 0), make the precondition explicit
   - Prefer metamorphic or relation-style properties over arbitrary free-form assertions
9. For parameters that are custom types/interfaces, use type "object" with a "fields" constraint:
   - Each field maps to a generator spec: { type: "string", constraints: { maxLength: 100 } }
   - For optional fields, use type "optional" with an "inner" constraint: { type: "optional", constraints: { inner: { type: "string" } } }
   - For enum types, use type "enum" with a "values" constraint: { type: "enum", constraints: { values: ["a", "b"] } }
   - Nest "object" types for fields that are themselves custom interfaces
   - Example: { type: "object", constraints: { fields: { name: { type: "string" }, price: { type: "float", constraints: { min: 0 } } } } }`;

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

export function buildInferPrompt(context: AnalysisContext): string {
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
            },
            required: [
              "targetFunction", "description", "category", "assertion",
              "generators", "seedInputs", "evidence", "confidence",
            ],
          },
        },
      },
      required: ["properties"],
    },
  };
}
