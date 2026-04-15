import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import { analyzeFile, detectLanguage } from "../languages/typescript";
import { parseSpecText } from "../spec";

describe("typescript parser", () => {
  it("should extract a simple function declaration", () => {
    const source = `
export function add(a: number, b: number): number {
  return a + b;
}`;
    const ctx = analyzeFile("test.ts", source, "typescript");

    assert.equal(ctx.functions.length, 1);
    const fn = ctx.functions[0];
    assert.equal(fn.name, "add");
    assert.equal(fn.qualifiedName, "add");
    assert.equal(fn.parameters.length, 2);
    assert.equal(fn.parameters[0].name, "a");
    assert.equal(fn.parameters[0].type, "number");
    assert.equal(fn.parameters[1].name, "b");
    assert.equal(fn.returnType, "number");
    assert.equal(fn.visibility, "public");
    assert.equal(fn.isAsync, false);
  });

  it("should extract arrow functions", () => {
    const source = `
export const multiply = (x: number, y: number): number => x * y;
`;
    const ctx = analyzeFile("test.ts", source, "typescript");

    assert.equal(ctx.functions.length, 1);
    assert.equal(ctx.functions[0].name, "multiply");
    assert.equal(ctx.functions[0].parameters.length, 2);
    assert.equal(ctx.functions[0].visibility, "public");
  });

  it("should extract class methods", () => {
    const source = `
export class Calculator {
  add(a: number, b: number): number {
    return a + b;
  }

  async fetchData(url: string): Promise<string> {
    return "";
  }
}`;
    const ctx = analyzeFile("test.ts", source, "typescript");

    assert.ok(ctx.functions.length >= 2);
    const addFn = ctx.functions.find((f) => f.name === "add");
    assert.ok(addFn);
    assert.equal(addFn.qualifiedName, "Calculator.add");
    assert.equal(addFn.isAsync, false);

    const fetchFn = ctx.functions.find((f) => f.name === "fetchData");
    assert.ok(fetchFn);
    assert.equal(fetchFn.isAsync, true);
    assert.equal(fetchFn.returnType, "Promise<string>");
  });

  it("should extract optional and rest parameters", () => {
    const source = `
export function greet(name: string, greeting?: string, ...tags: string[]): string {
  return "";
}`;
    const ctx = analyzeFile("test.ts", source, "typescript");
    const fn = ctx.functions[0];

    assert.equal(fn.parameters.length, 3);
    assert.equal(fn.parameters[0].isOptional, false);
    assert.equal(fn.parameters[1].isOptional, true);
    assert.equal(fn.parameters[2].isRest, true);
  });

  it("should extract default parameter values", () => {
    const source = `
export function discount(price: number, rate: number = 0.1): number {
  return price * (1 - rate);
}`;
    const ctx = analyzeFile("test.ts", source, "typescript");
    const fn = ctx.functions[0];

    assert.equal(fn.parameters[1].defaultValue, "0.1");
    assert.equal(fn.parameters[1].isOptional, true);
  });

  it("should extract interfaces", () => {
    const source = `
interface CartItem {
  readonly name: string;
  price: number;
  quantity?: number;
}`;
    const ctx = analyzeFile("test.ts", source, "typescript");

    assert.equal(ctx.types.length, 1);
    assert.equal(ctx.types[0].name, "CartItem");
    assert.equal(ctx.types[0].kind, "interface");
    assert.equal(ctx.types[0].properties.length, 3);
    assert.equal(ctx.types[0].properties[0].isReadonly, true);
    assert.equal(ctx.types[0].properties[2].isOptional, true);
  });

  it("should extract imports", () => {
    const source = `
import { readFile } from "node:fs/promises";
import path from "node:path";
import * as os from "node:os";
`;
    const ctx = analyzeFile("test.ts", source, "typescript");

    assert.equal(ctx.imports.length, 3);
    assert.equal(ctx.imports[0].source, "node:fs/promises");
    assert.deepEqual(ctx.imports[0].specifiers, ["readFile"]);
    assert.equal(ctx.imports[1].isDefault, true);
    assert.equal(ctx.imports[2].isNamespace, true);
  });

  it("should handle JavaScript files", () => {
    const source = `
export function add(a, b) {
  return a + b;
}`;
    const ctx = analyzeFile("test.js", source, "javascript");

    assert.equal(ctx.functions.length, 1);
    assert.equal(ctx.functions[0].parameters[0].type, null);
  });
});

describe("parseSpecText", () => {
  it("should map matching requirement lines to functions and constraints", () => {
    const spec = parseSpecText(
      "requirements.md",
      [
        "- applyDiscount must keep discount percentage in the 0-100 range",
        "- calculateTotal should never be negative",
        "- cart totals should be auditable",
      ].join("\n"),
      ["applyDiscount", "calculateTotal"],
    );

    assert.equal(spec.sourcePath, "requirements.md");
    assert.equal(spec.generalRequirements.length, 1);
    assert.equal(spec.functions.length, 2);
    assert.ok(spec.functions.some((fn) => fn.functionName === "applyDiscount" && fn.constraints.some((c) => c.kind === "range")));
    assert.ok(spec.functions.some((fn) => fn.functionName === "calculateTotal" && fn.constraints.some((c) => c.kind === "non-negative")));
  });

  it("should match unqualified spec lines for qualified methods", () => {
    const spec = parseSpecText(
      "requirements.md",
      "- add should never be negative",
      ["Calculator.add", "add"],
    );

    assert.equal(spec.functions.length, 1);
    assert.ok(spec.functions[0].constraints.some((constraint) => constraint.kind === "non-negative"));
  });
});

describe("detectLanguage", () => {
  it("should detect TypeScript", () => {
    assert.equal(detectLanguage("foo.ts"), "typescript");
    assert.equal(detectLanguage("foo.tsx"), "typescript");
  });

  it("should detect JavaScript", () => {
    assert.equal(detectLanguage("foo.js"), "javascript");
    assert.equal(detectLanguage("foo.mjs"), "javascript");
  });

  it("should detect Python", () => {
    assert.equal(detectLanguage("foo.py"), "python");
  });

  it("should return null for unknown", () => {
    assert.equal(detectLanguage("foo.rb"), null);
  });
});
