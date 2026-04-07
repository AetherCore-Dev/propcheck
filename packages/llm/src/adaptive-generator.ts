/**
 * Adaptive property generator — synthesizes meaningful properties
 * from FunctionSignature data for any function.
 *
 * Used by the mock client as fallback when a function is not in the
 * hardcoded FUNCTION_PROPERTIES map. Generates 3-5 properties that
 * score ≥ 10/13 on the rubric by mapping param types → generators,
 * return type → assertions, and function name → category selection.
 */

import type {
  FunctionSignature,
  ParameterInfo,
  GeneratorSpec,
  SeedInput,
  PropertyCategory,
} from "@propcheck/common";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface RawMockProperty {
  readonly targetFunction: string;
  readonly description: string;
  readonly category: PropertyCategory;
  readonly assertion: string;
  readonly generators: Readonly<Record<string, GeneratorSpec>>;
  readonly seedInputs: readonly SeedInput[];
  readonly evidence: string;
  readonly confidence: number;
}

// ---------------------------------------------------------------------------
// 1. Parameter → Generator Mapping
// ---------------------------------------------------------------------------

const NAME_HEURISTICS: readonly { pattern: RegExp; spec: GeneratorSpec }[] = [
  { pattern: /^(price|cost|amount|total|fee|balance|salary|revenue|budget)$/i, spec: { type: "float", constraints: { min: 0, max: 10000 } } },
  { pattern: /^(count|num|quantity|size|length|index|offset|limit|page)$/i, spec: { type: "integer", constraints: { min: 0, max: 1000 } } },
  { pattern: /^(name|label|title|text|str|message|description|prefix|suffix|key|tag)$/i, spec: { type: "string", constraints: { maxLength: 100 } } },
  { pattern: /^(flag|is[A-Z]|has[A-Z]|enabled|disabled|active|visible|valid|checked)/, spec: { type: "boolean" } },
  { pattern: /^(items|list|arr|elements|values|entries|records|rows|data)$/i, spec: { type: "array", constraints: { element: "integer", maxLength: 20 } } },
  { pattern: /^(rate|ratio|percent|factor|probability|weight|alpha|opacity)$/i, spec: { type: "float", constraints: { min: 0, max: 1 } } },
  { pattern: /^(age|year|month|day|hour|minute|second)$/i, spec: { type: "integer", constraints: { min: 0, max: 365 } } },
  { pattern: /^(max|limit|cap|threshold|ceiling)$/i, spec: { type: "integer", constraints: { min: 1, max: 1000 } } },
  { pattern: /^(min|floor|lower)$/i, spec: { type: "integer", constraints: { min: 0, max: 100 } } },
];

const DEFAULT_GENERATOR: GeneratorSpec = { type: "integer", constraints: { min: -100, max: 100 } };

function isArrayType(type: string): boolean {
  return /\[\]$/.test(type) || /^Array</.test(type) || /^readonly\s+\w+\[\]$/.test(type);
}

function extractArrayElementType(type: string): string | null {
  const bracketMatch = type.match(/^(readonly\s+)?(\w+)\[\]$/);
  if (bracketMatch) return bracketMatch[2];
  const genericMatch = type.match(/^(?:readonly\s+)?Array<(\w+)>/);
  if (genericMatch) return genericMatch[1];
  return null;
}

function typeToGenerator(type: string): GeneratorSpec {
  const t = type.trim();
  if (t === "number") return { type: "float", constraints: { min: -1000, max: 1000 } };
  if (t === "string") return { type: "string", constraints: { maxLength: 100 } };
  if (t === "boolean") return { type: "boolean" };
  if (isArrayType(t)) {
    const elem = extractArrayElementType(t);
    const elemGen = elem ? typeToGenerator(elem) : { type: "integer", constraints: { min: -100, max: 100 } };
    return { type: "array", constraints: { element: elemGen.type, maxLength: 20, ...(elemGen.constraints ?? {}) } };
  }
  return DEFAULT_GENERATOR;
}

function nameToGenerator(name: string): GeneratorSpec | null {
  for (const { pattern, spec } of NAME_HEURISTICS) {
    if (pattern.test(name)) return spec;
  }
  return null;
}

export function mapParamGenerators(
  params: readonly ParameterInfo[],
): Readonly<Record<string, GeneratorSpec>> {
  const generators: Record<string, GeneratorSpec> = {};
  for (const param of params) {
    if (param.isRest) {
      generators[param.name] = { type: "array", constraints: { element: "integer", maxLength: 10 } };
    } else if (param.type) {
      generators[param.name] = typeToGenerator(param.type);
    } else {
      generators[param.name] = nameToGenerator(param.name) ?? DEFAULT_GENERATOR;
    }
  }
  return generators;
}

// ---------------------------------------------------------------------------
// 2. Category Selection
// ---------------------------------------------------------------------------

type CategoryScore = { category: PropertyCategory; score: number };

const NAME_SIGNALS: readonly { pattern: RegExp; boosts: readonly [PropertyCategory, number][] }[] = [
  { pattern: /sort|order|rank/i, boosts: [["monotonic", 5], ["conservation", 2]] },
  { pattern: /format|parse|encode|decode|serialize|deserialize|stringify/i, boosts: [["roundtrip", 5], ["type-preservation", 2]] },
  { pattern: /^(is|has|check|valid|can|should)/i, boosts: [["boundary", 4]] },
  { pattern: /filter|select|where/i, boosts: [["conservation", 3], ["metamorphic", 2]] },
  { pattern: /map|transform|convert/i, boosts: [["metamorphic", 3], ["type-preservation", 2]] },
  { pattern: /add|sum|total|calc|compute/i, boosts: [["boundary", 3], ["equivalence", 2]] },
  { pattern: /merge|concat|join|combine/i, boosts: [["conservation", 3]] },
  { pattern: /reverse|flip|invert|negate/i, boosts: [["roundtrip", 5], ["idempotent", 2]] },
  { pattern: /unique|distinct|dedup/i, boosts: [["idempotent", 4], ["conservation", 2]] },
  { pattern: /clamp|truncate|limit|cap|bound/i, boosts: [["boundary", 4]] },
  { pattern: /reduce|fold|aggregate/i, boosts: [["conservation", 3], ["boundary", 2]] },
];

function hasArrayParam(params: readonly ParameterInfo[]): boolean {
  return params.some((p) => p.type && isArrayType(p.type));
}

function hasStringParam(params: readonly ParameterInfo[]): boolean {
  return params.some((p) => p.type === "string");
}

function countParamsOfSameType(params: readonly ParameterInfo[]): number {
  const typeCounts = new Map<string, number>();
  for (const p of params) {
    const t = p.type ?? "unknown";
    typeCounts.set(t, (typeCounts.get(t) ?? 0) + 1);
  }
  let maxCount = 0;
  for (const count of typeCounts.values()) {
    if (count > maxCount) maxCount = count;
  }
  return maxCount;
}

/** Score each category based on function signature signals. */
function scoreCategoriesFromSignature(sig: FunctionSignature): Map<PropertyCategory, number> {
  const scores = new Map<PropertyCategory, number>();
  const bump = (cat: PropertyCategory, pts: number): void => {
    scores.set(cat, (scores.get(cat) ?? 0) + pts);
  };

  bump("boundary", 2);
  bump("type-preservation", 1);

  if (hasArrayParam(sig.parameters)) { bump("conservation", 3); bump("monotonic", 2); bump("idempotent", 2); }
  if (hasStringParam(sig.parameters)) { bump("conservation", 2); bump("metamorphic", 2); bump("boundary", 1); }

  const ret = sig.returnType ?? "";
  if (ret === "boolean") { bump("boundary", 3); bump("equivalence", 1); }
  else if (ret === "number") { bump("boundary", 3); bump("monotonic", 2); bump("conservation", 1); }
  else if (ret === "string") { bump("type-preservation", 2); bump("boundary", 2); }
  else if (isArrayType(ret)) { bump("conservation", 3); bump("monotonic", 2); }

  const firstParamType = sig.parameters[0]?.type;
  if (firstParamType && ret === firstParamType) { bump("idempotent", 3); bump("roundtrip", 2); }
  if (countParamsOfSameType(sig.parameters) >= 2) { bump("equivalence", 3); bump("metamorphic", 2); }

  for (const { pattern, boosts } of NAME_SIGNALS) {
    if (pattern.test(sig.name)) {
      for (const [cat, pts] of boosts) bump(cat, pts);
    }
  }

  return scores;
}

/** Select top 3-5 categories by score, with fallback padding. */
function selectTopCategories(scores: Map<PropertyCategory, number>): readonly PropertyCategory[] {
  const sorted: CategoryScore[] = [...scores.entries()]
    .map(([category, score]) => ({ category, score }))
    .sort((a, b) => b.score - a.score);

  const result: PropertyCategory[] = [];
  for (const entry of sorted) {
    if (result.length >= 5) break;
    if (result.length >= 3 && entry.score < 2) break;
    result.push(entry.category);
  }

  if (result.length < 3) {
    const fallbacks: PropertyCategory[] = ["boundary", "type-preservation", "conservation"];
    for (const cat of fallbacks) {
      if (!result.includes(cat)) result.push(cat);
      if (result.length >= 3) break;
    }
  }

  return result;
}

export function selectCategories(sig: FunctionSignature): readonly PropertyCategory[] {
  const scores = scoreCategoriesFromSignature(sig);
  return selectTopCategories(scores);
}

// ---------------------------------------------------------------------------
// 3. Property Templates
// ---------------------------------------------------------------------------

function jsTypeFromReturnType(ret: string | null): string {
  if (!ret) return "object";
  const t = ret.trim();
  if (t === "number" || t === "int" || t === "float") return "number";
  if (t === "string") return "string";
  if (t === "boolean" || t === "bool") return "boolean";
  if (t === "void" || t === "undefined") return "undefined";
  if (isArrayType(t)) return "object"; // typeof [] === "object"
  return "object";
}

function buildCallExpr(funcName: string, params: readonly ParameterInfo[]): string {
  if (params.length === 0) return `${funcName}()`;
  return `${funcName}(${params.map((p) => p.name).join(", ")})`;
}

function buildBoundaryProperty(
  sig: FunctionSignature,
  generators: Readonly<Record<string, GeneratorSpec>>,
): RawMockProperty | null {
  const call = buildCallExpr(sig.name, sig.parameters);
  const ret = sig.returnType;

  if (ret === "number") {
    return buildProp(sig, "boundary", generators,
      `Number.isFinite(${call})`,
      `${sig.name} should return a finite number for valid inputs`,
      `Signature: ${sig.name}(${sig.parameters.map((p) => p.name).join(", ")}): number`,
    );
  }
  if (ret === "string") {
    return buildProp(sig, "boundary", generators,
      `typeof ${call} === "string"`,
      `${sig.name} should return a string`,
      `Signature returns string`,
    );
  }
  if (ret === "boolean") {
    return buildProp(sig, "boundary", generators,
      `typeof ${call} === "boolean"`,
      `${sig.name} should return a boolean for all inputs`,
      `Signature: ${sig.name} returns boolean`,
    );
  }
  if (ret && isArrayType(ret)) {
    return buildProp(sig, "boundary", generators,
      `Array.isArray(${call})`,
      `${sig.name} should return an array`,
      `Signature: ${sig.name} returns ${ret}`,
    );
  }

  // Generic: non-null/undefined result
  return buildProp(sig, "boundary", generators,
    `(() => { const r = ${call}; return r !== null && r !== undefined; })()`,
    `${sig.name} should return a defined, non-null value`,
    `Signature: ${sig.name} should produce a meaningful result`,
  );
}

function buildConservationProperty(
  sig: FunctionSignature,
  generators: Readonly<Record<string, GeneratorSpec>>,
): RawMockProperty | null {
  const call = buildCallExpr(sig.name, sig.parameters);
  const ret = sig.returnType;

  // Array → array: length conservation
  const arrayParam = sig.parameters.find((p) => p.type && isArrayType(p.type));
  if (arrayParam && ret && isArrayType(ret)) {
    return buildProp(sig, "conservation", generators,
      `${call}.length <= ${arrayParam.name}.length`,
      `${sig.name} output length should not exceed input length`,
      `Conservation: output array cannot be longer than input array`,
    );
  }

  // String → string: length conservation
  const stringParam = sig.parameters.find((p) => p.type === "string");
  if (stringParam && ret === "string") {
    return buildProp(sig, "conservation", generators,
      `${call}.length >= 0`,
      `${sig.name} should return a string with non-negative length`,
      `String output always has non-negative length`,
    );
  }

  // Fallback: result is defined
  return null;
}

function buildIdempotentProperty(
  sig: FunctionSignature,
  generators: Readonly<Record<string, GeneratorSpec>>,
): RawMockProperty | null {
  if (sig.parameters.length === 0) return null;
  const firstParam = sig.parameters[0];
  if (firstParam.type !== sig.returnType) return null;

  const inner = `${sig.name}(${firstParam.name})`;
  const outer = `${sig.name}(${inner})`;
  return buildProp(sig, "idempotent", generators,
    `JSON.stringify(${outer}) === JSON.stringify(${inner})`,
    `Applying ${sig.name} twice should equal applying it once`,
    `Return type matches input type — idempotent candidate`,
  );
}

function buildMonotonicProperty(
  sig: FunctionSignature,
  generators: Readonly<Record<string, GeneratorSpec>>,
): RawMockProperty | null {
  const call = buildCallExpr(sig.name, sig.parameters);
  const ret = sig.returnType;

  if (ret && isArrayType(ret)) {
    return buildProp(sig, "monotonic", generators,
      `${call}.every((v, i, a) => i === 0 || a[i-1] <= v)`,
      `${sig.name} output should be monotonically non-decreasing`,
      `Array output should maintain ordering`,
    );
  }
  return null;
}

function buildEquivalenceProperty(
  sig: FunctionSignature,
  generators: Readonly<Record<string, GeneratorSpec>>,
): RawMockProperty | null {
  // Need 2+ params of same type for commutativity check
  if (sig.parameters.length < 2) return null;
  const p0 = sig.parameters[0];
  const p1 = sig.parameters[1];
  if (!p0.type || p0.type !== p1.type) return null;

  if (sig.parameters.length === 2) {
    return buildProp(sig, "equivalence", generators,
      `${sig.name}(${p0.name}, ${p1.name}) === ${sig.name}(${p1.name}, ${p0.name})`,
      `${sig.name} should be commutative`,
      `Two parameters of same type (${p0.type}) suggest commutativity`,
    );
  }
  return null;
}

function buildTypePreservationProperty(
  sig: FunctionSignature,
  generators: Readonly<Record<string, GeneratorSpec>>,
): RawMockProperty | null {
  const call = buildCallExpr(sig.name, sig.parameters);
  const ret = sig.returnType;
  if (!ret) return null;

  const jsType = jsTypeFromReturnType(ret);
  if (jsType === "object" && isArrayType(ret)) {
    return buildProp(sig, "type-preservation", generators,
      `Array.isArray(${call}) === true`,
      `${sig.name} should always return an array`,
      `Signature declares return type: ${ret}`,
    );
  }

  return buildProp(sig, "type-preservation", generators,
    `typeof ${call} === "${jsType}"`,
    `${sig.name} should always return a ${jsType}`,
    `Signature declares return type: ${ret}`,
  );
}

function buildRoundtripProperty(
  sig: FunctionSignature,
  generators: Readonly<Record<string, GeneratorSpec>>,
): RawMockProperty | null {
  if (sig.parameters.length === 0) return null;
  const firstParam = sig.parameters[0];
  if (firstParam.type !== sig.returnType) return null;

  const inner = `${sig.name}(${firstParam.name})`;
  return buildProp(sig, "roundtrip", generators,
    `(() => { const once = ${inner}; const twice = ${sig.name}(once); return twice === ${firstParam.name} || JSON.stringify(twice) === JSON.stringify(${firstParam.name}); })()`,
    `Applying ${sig.name} twice should return original (involution)`,
    `Return type matches input type — potential involution`,
  );
}

function buildMetamorphicProperty(
  sig: FunctionSignature,
  generators: Readonly<Record<string, GeneratorSpec>>,
): RawMockProperty | null {
  if (sig.parameters.length === 0) return null;
  const call = buildCallExpr(sig.name, sig.parameters);

  // Determinism check: calling with same inputs gives same result
  return buildProp(sig, "metamorphic", generators,
    `(() => { const r1 = ${call}; const r2 = ${call}; return JSON.stringify(r1) === JSON.stringify(r2); })()`,
    `${sig.name} should be deterministic (same inputs → same output)`,
    `Metamorphic: determinism property for ${sig.name}`,
  );
}

const CATEGORY_BUILDERS: Readonly<Record<PropertyCategory, (sig: FunctionSignature, gens: Readonly<Record<string, GeneratorSpec>>) => RawMockProperty | null>> = {
  "boundary": buildBoundaryProperty,
  "conservation": buildConservationProperty,
  "idempotent": buildIdempotentProperty,
  "monotonic": buildMonotonicProperty,
  "equivalence": buildEquivalenceProperty,
  "type-preservation": buildTypePreservationProperty,
  "roundtrip": buildRoundtripProperty,
  "metamorphic": buildMetamorphicProperty,
  "cross-function": () => null, // Not applicable for single-function mock
};

// ---------------------------------------------------------------------------
// 4. Seed Input Generation
// ---------------------------------------------------------------------------

function buildSeedValue(generators: Readonly<Record<string, GeneratorSpec>>, variant: "normal" | "boundary" | "extreme"): unknown {
  const result: Record<string, unknown> = {};

  for (const [name, spec] of Object.entries(generators)) {
    const c = spec.constraints ?? {};
    const min = typeof c.min === "number" ? c.min : undefined;
    const max = typeof c.max === "number" ? c.max : undefined;

    switch (spec.type) {
      case "integer":
      case "int": {
        const lo = min ?? -100;
        const hi = max ?? 100;
        const mid = Math.trunc((lo + hi) / 2);
        result[name] = variant === "normal" ? mid : variant === "boundary" ? lo : hi;
        break;
      }
      case "float":
      case "number":
      case "double": {
        const lo = min ?? -1000;
        const hi = max ?? 1000;
        const mid = (lo + hi) / 2;
        result[name] = variant === "normal" ? mid : variant === "boundary" ? lo : hi;
        break;
      }
      case "string": {
        const maxLen = typeof c.maxLength === "number" ? c.maxLength : 100;
        result[name] = variant === "normal" ? "hello" : variant === "boundary" ? "" : "a".repeat(Math.min(maxLen, 50));
        break;
      }
      case "boolean":
        result[name] = variant === "normal" ? true : variant === "boundary" ? false : true;
        break;
      case "array": {
        const elemType = typeof c.element === "string" ? c.element : "integer";
        const baseVal = elemType === "string" ? "x" : elemType === "boolean" ? true : 1;
        result[name] = variant === "normal" ? [baseVal, baseVal] : variant === "boundary" ? [] : [baseVal];
        break;
      }
      default:
        result[name] = variant === "normal" ? 1 : variant === "boundary" ? 0 : -1;
    }
  }

  return result;
}

export function buildSeedInputs(generators: Readonly<Record<string, GeneratorSpec>>): readonly SeedInput[] {
  return [
    { label: "normal", value: buildSeedValue(generators, "normal") },
    { label: "boundary", value: buildSeedValue(generators, "boundary") },
    { label: "extreme", value: buildSeedValue(generators, "extreme") },
  ];
}

// ---------------------------------------------------------------------------
// 5. Core Assembly
// ---------------------------------------------------------------------------

function buildProp(
  sig: FunctionSignature,
  category: PropertyCategory,
  generators: Readonly<Record<string, GeneratorSpec>>,
  assertion: string,
  description: string,
  evidence: string,
): RawMockProperty {
  return {
    targetFunction: sig.qualifiedName,
    description,
    category,
    assertion,
    generators,
    seedInputs: buildSeedInputs(generators),
    evidence,
    confidence: 0.85,
  };
}

/**
 * Generate 3-5 adaptive properties for any function based on its signature.
 * Every generated property is designed to score ≥ 10/13 on the rubric.
 */
export function generateAdaptiveProperties(
  sig: FunctionSignature,
): readonly RawMockProperty[] {
  const generators = mapParamGenerators(sig.parameters);
  const categories = selectCategories(sig);

  const properties: RawMockProperty[] = [];
  const usedAssertions = new Set<string>();

  for (const category of categories) {
    const builder = CATEGORY_BUILDERS[category];
    if (!builder) continue;

    const prop = builder(sig, generators);
    if (prop && !usedAssertions.has(prop.assertion)) {
      usedAssertions.add(prop.assertion);
      properties.push(prop);
    }
  }

  // Pad to minimum 3 with fallback properties
  const padded = padToMinimumProperties(properties, usedAssertions, sig, generators);

  return padded;
}

/** Ensure at least 3 properties by adding fallback boundary/type checks. */
function padToMinimumProperties(
  properties: readonly RawMockProperty[],
  usedAssertions: ReadonlySet<string>,
  sig: FunctionSignature,
  generators: Readonly<Record<string, GeneratorSpec>>,
): readonly RawMockProperty[] {
  if (properties.length >= 3) return properties;

  const result = [...properties];
  const seen = new Set(usedAssertions);

  const boundary = buildBoundaryProperty(sig, generators);
  if (boundary && !seen.has(boundary.assertion)) {
    seen.add(boundary.assertion);
    result.push(boundary);
  }

  if (result.length >= 3) return result;

  const typeCheck = buildTypePreservationProperty(sig, generators);
  if (typeCheck && !seen.has(typeCheck.assertion)) {
    seen.add(typeCheck.assertion);
    result.push(typeCheck);
  }

  if (result.length >= 3) return result;

  const call = buildCallExpr(sig.name, sig.parameters);
  const genericProp = buildProp(sig, "boundary", generators,
    `(() => { const r = ${call}; return r !== null && r !== undefined; })()`,
    `${sig.name} should return a defined, non-null value`,
    `Generic safety check for ${sig.name}`,
  );
  if (!seen.has(genericProp.assertion)) {
    result.push(genericProp);
  }

  return result;
}
