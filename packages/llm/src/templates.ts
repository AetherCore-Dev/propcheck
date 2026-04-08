/**
 * Community property templates — reusable property patterns organized by domain.
 *
 * Each template defines property patterns for common function archetypes
 * (e.g., "sort function", "format function", "validator function").
 * Templates are matched by function name patterns and parameter signatures,
 * then instantiated with the actual function name and parameter names.
 *
 * Usage:
 *   const props = matchTemplates(functionSignature);
 *   // Returns 0-5 RawMockProperty[] ready for scoring
 */

import type { FunctionSignature, ParameterInfo } from "@propcheck/common";
import type { GeneratorSpec, SeedInput, PropertyCategory } from "@propcheck/common";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PropertyTemplate {
  /** Human-readable description template. Use {fn} for function name, {p0}, {p1} for params. */
  readonly description: string;
  readonly category: PropertyCategory;
  /** Assertion template. Use {fn} for function name, {p0}/{p1}/{p2} for params. */
  readonly assertion: string;
  /** Generator specs keyed by placeholder ({p0}, {p1}, etc.) */
  readonly generators: Readonly<Record<string, GeneratorSpec>>;
  /** Seed inputs */
  readonly seedInputs: readonly SeedInput[];
  readonly evidence: string;
  readonly confidence: number;
}

interface DomainTemplate {
  /** Domain name (e.g., "sorting", "formatting") */
  readonly domain: string;
  /** Function name patterns (regex) to match */
  readonly namePatterns: readonly RegExp[];
  /** Minimum number of parameters required */
  readonly minParams?: number;
  /** Required parameter type patterns */
  readonly paramTypePattern?: RegExp;
  /** Required return type pattern */
  readonly returnTypePattern?: RegExp;
  /** Property templates for this domain */
  readonly properties: readonly PropertyTemplate[];
}

interface RawTemplateProperty {
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
// Domain Templates
// ---------------------------------------------------------------------------

const DOMAIN_TEMPLATES: readonly DomainTemplate[] = [
  // === Sorting / Ordering ===
  {
    domain: "sorting",
    namePatterns: [/sort/i, /order/i, /rank/i],
    returnTypePattern: /\[\]|Array/,
    properties: [
      {
        description: "{fn} preserves array length (conservation)",
        category: "conservation",
        assertion: "{fn}({p0}).length === {p0}.length",
        generators: { "{p0}": { type: "array", constraints: { element: "integer", maxLength: 20 } } },
        seedInputs: [
          { label: "normal", value: { "{p0}": [3, 1, 4, 1, 5] } },
          { label: "boundary", value: { "{p0}": [] } },
          { label: "extreme", value: { "{p0}": [1] } },
        ],
        evidence: "Sorting must not add or remove elements",
        confidence: 0.95,
      },
      {
        description: "{fn} is idempotent — sorting twice gives same result",
        category: "idempotent",
        assertion: "JSON.stringify({fn}({fn}({p0}))) === JSON.stringify({fn}({p0}))",
        generators: { "{p0}": { type: "array", constraints: { element: "integer", maxLength: 20 } } },
        seedInputs: [
          { label: "normal", value: { "{p0}": [5, 2, 8, 1] } },
          { label: "boundary", value: { "{p0}": [] } },
          { label: "extreme", value: { "{p0}": [42] } },
        ],
        evidence: "Applying sort twice should yield same result as once",
        confidence: 0.92,
      },
      {
        description: "{fn} produces monotonically non-decreasing output",
        category: "monotonic",
        assertion: "{fn}({p0}).every((v, i, a) => i === 0 || a[i-1] <= v)",
        generators: { "{p0}": { type: "array", constraints: { element: "integer", maxLength: 20 } } },
        seedInputs: [
          { label: "normal", value: { "{p0}": [3, 1, 4] } },
          { label: "boundary", value: { "{p0}": [] } },
          { label: "extreme", value: { "{p0}": [-100, 100, 0] } },
        ],
        evidence: "Sort output should be ordered",
        confidence: 0.90,
      },
    ],
  },

  // === Formatting / Parsing ===
  {
    domain: "formatting",
    namePatterns: [/format/i, /stringify/i, /serialize/i, /tostring/i, /display/i],
    returnTypePattern: /string/i,
    properties: [
      {
        description: "{fn} returns a non-empty string for valid input",
        category: "boundary",
        assertion: "{fn}({p0}).length > 0",
        generators: { "{p0}": { type: "float", constraints: { min: 0, max: 100000 } } },
        seedInputs: [
          { label: "normal", value: { "{p0}": 42.5 } },
          { label: "boundary", value: { "{p0}": 0 } },
          { label: "extreme", value: { "{p0}": 99999.99 } },
        ],
        evidence: "Formatted output should never be empty",
        confidence: 0.90,
      },
      {
        description: "{fn} output is deterministic — same input gives same output",
        category: "idempotent",
        assertion: "{fn}({p0}) === {fn}({p0})",
        generators: { "{p0}": { type: "float", constraints: { min: -1000, max: 1000 } } },
        seedInputs: [
          { label: "normal", value: { "{p0}": 3.14 } },
          { label: "boundary", value: { "{p0}": 0 } },
          { label: "extreme", value: { "{p0}": -999.99 } },
        ],
        evidence: "Pure function must be deterministic",
        confidence: 0.95,
      },
    ],
  },

  // === Parsing / Decoding ===
  {
    domain: "parsing",
    namePatterns: [/parse/i, /decode/i, /deserialize/i, /fromstring/i],
    properties: [
      {
        description: "{fn} returns a finite number for numeric strings",
        category: "boundary",
        assertion: "Number.isFinite({fn}(String({p0})))",
        generators: { "{p0}": { type: "float", constraints: { min: -1000, max: 1000 } } },
        seedInputs: [
          { label: "normal", value: { "{p0}": 42 } },
          { label: "boundary", value: { "{p0}": 0 } },
          { label: "extreme", value: { "{p0}": -999 } },
        ],
        evidence: "Parser should produce finite numbers for valid numeric input",
        confidence: 0.85,
      },
    ],
  },

  // === Validation / Checking ===
  {
    domain: "validation",
    namePatterns: [/^is[A-Z]/i, /^has[A-Z]/i, /^can[A-Z]/i, /valid/i, /check/i, /verify/i],
    returnTypePattern: /boolean/i,
    properties: [
      {
        description: "{fn} returns a boolean value",
        category: "type-preservation",
        assertion: "typeof {fn}({p0}) === 'boolean'",
        generators: { "{p0}": { type: "string", constraints: { maxLength: 100 } } },
        seedInputs: [
          { label: "normal", value: { "{p0}": "test@example.com" } },
          { label: "boundary", value: { "{p0}": "" } },
          { label: "extreme", value: { "{p0}": "x".repeat(100) } },
        ],
        evidence: "Validators must return boolean, not truthy/falsy",
        confidence: 0.95,
      },
      {
        description: "{fn} is deterministic — same input gives same result",
        category: "idempotent",
        assertion: "{fn}({p0}) === {fn}({p0})",
        generators: { "{p0}": { type: "string", constraints: { maxLength: 100 } } },
        seedInputs: [
          { label: "normal", value: { "{p0}": "hello" } },
          { label: "boundary", value: { "{p0}": "" } },
          { label: "extreme", value: { "{p0}": "   " } },
        ],
        evidence: "Pure validation function must be deterministic",
        confidence: 0.93,
      },
    ],
  },

  // === Filtering / Mapping ===
  {
    domain: "filtering",
    namePatterns: [/filter/i, /select/i, /exclude/i, /remove/i, /reject/i],
    returnTypePattern: /\[\]|Array/,
    properties: [
      {
        description: "{fn} result length is at most the input length (conservation)",
        category: "conservation",
        assertion: "{fn}({p0}).length <= {p0}.length",
        generators: { "{p0}": { type: "array", constraints: { element: "integer", maxLength: 30 } } },
        seedInputs: [
          { label: "normal", value: { "{p0}": [1, 2, 3, 4, 5] } },
          { label: "boundary", value: { "{p0}": [] } },
          { label: "extreme", value: { "{p0}": [0] } },
        ],
        evidence: "Filtering cannot produce more elements than input",
        confidence: 0.95,
      },
      {
        description: "{fn} is idempotent — filtering twice gives same result",
        category: "idempotent",
        assertion: "JSON.stringify({fn}({fn}({p0}))) === JSON.stringify({fn}({p0}))",
        generators: { "{p0}": { type: "array", constraints: { element: "integer", maxLength: 20 } } },
        seedInputs: [
          { label: "normal", value: { "{p0}": [1, -1, 2, -2, 0] } },
          { label: "boundary", value: { "{p0}": [] } },
          { label: "extreme", value: { "{p0}": [999] } },
        ],
        evidence: "Applying filter twice should yield same result as once",
        confidence: 0.88,
      },
    ],
  },

  // === Clamping / Bounding ===
  {
    domain: "clamping",
    namePatterns: [/clamp/i, /bound/i, /limit/i, /constrain/i, /cap/i],
    properties: [
      {
        description: "{fn} result is within bounds",
        category: "boundary",
        assertion: "{fn}({p0}, {p1}, {p2}) >= {p1} && {fn}({p0}, {p1}, {p2}) <= {p2}",
        generators: {
          "{p0}": { type: "float", constraints: { min: -1000, max: 1000 } },
          "{p1}": { type: "float", constraints: { min: -100, max: 0 } },
          "{p2}": { type: "float", constraints: { min: 0, max: 100 } },
        },
        seedInputs: [
          { label: "normal", value: { "{p0}": 50, "{p1}": 0, "{p2}": 100 } },
          { label: "boundary", value: { "{p0}": 0, "{p1}": 0, "{p2}": 100 } },
          { label: "extreme", value: { "{p0}": -999, "{p1}": -100, "{p2}": 100 } },
        ],
        evidence: "Clamped value must be within [min, max] bounds",
        confidence: 0.95,
      },
      {
        description: "{fn} is idempotent — clamping a clamped value gives same result",
        category: "idempotent",
        assertion: "{fn}({fn}({p0}, {p1}, {p2}), {p1}, {p2}) === {fn}({p0}, {p1}, {p2})",
        generators: {
          "{p0}": { type: "float", constraints: { min: -1000, max: 1000 } },
          "{p1}": { type: "float", constraints: { min: -100, max: 0 } },
          "{p2}": { type: "float", constraints: { min: 0, max: 100 } },
        },
        seedInputs: [
          { label: "normal", value: { "{p0}": 50, "{p1}": 0, "{p2}": 100 } },
          { label: "boundary", value: { "{p0}": -100, "{p1}": -100, "{p2}": 100 } },
          { label: "extreme", value: { "{p0}": 999, "{p1}": -100, "{p2}": 100 } },
        ],
        evidence: "Clamping is idempotent by definition",
        confidence: 0.93,
      },
    ],
  },

  // === Math / Calculation ===
  {
    domain: "math",
    namePatterns: [/calc/i, /compute/i, /sum/i, /total/i, /average/i, /mean/i, /tax/i, /discount/i, /fee/i, /price/i, /cost/i],
    returnTypePattern: /number/i,
    properties: [
      {
        description: "{fn} returns a finite number",
        category: "boundary",
        assertion: "Number.isFinite({fn}({p0}))",
        generators: { "{p0}": { type: "float", constraints: { min: 0, max: 10000 } } },
        seedInputs: [
          { label: "normal", value: { "{p0}": 100 } },
          { label: "boundary", value: { "{p0}": 0 } },
          { label: "extreme", value: { "{p0}": 9999.99 } },
        ],
        evidence: "Numeric calculations should return finite values",
        confidence: 0.92,
      },
    ],
  },

  // === String transformation ===
  {
    domain: "string-transform",
    namePatterns: [/trim/i, /strip/i, /clean/i, /normalize/i, /sanitize/i, /escape/i],
    returnTypePattern: /string/i,
    properties: [
      {
        description: "{fn} output length is at most input length",
        category: "conservation",
        assertion: "{fn}({p0}).length <= {p0}.length",
        generators: { "{p0}": { type: "string", constraints: { maxLength: 200 } } },
        seedInputs: [
          { label: "normal", value: { "{p0}": "  hello  " } },
          { label: "boundary", value: { "{p0}": "" } },
          { label: "extreme", value: { "{p0}": "   " } },
        ],
        evidence: "Trimming/cleaning should not increase string length",
        confidence: 0.88,
      },
      {
        description: "{fn} is idempotent — applying twice gives same result",
        category: "idempotent",
        assertion: "{fn}({fn}({p0})) === {fn}({p0})",
        generators: { "{p0}": { type: "string", constraints: { maxLength: 200 } } },
        seedInputs: [
          { label: "normal", value: { "{p0}": "  hello world  " } },
          { label: "boundary", value: { "{p0}": "" } },
          { label: "extreme", value: { "{p0}": "already clean" } },
        ],
        evidence: "Normalization should be stable after first application",
        confidence: 0.85,
      },
    ],
  },

  // === Mapping / Transformation ===
  {
    domain: "mapping",
    namePatterns: [/map/i, /transform/i, /convert/i],
    returnTypePattern: /\[\]|Array/,
    properties: [
      {
        description: "{fn} preserves array length (one-to-one mapping)",
        category: "conservation",
        assertion: "{fn}({p0}).length === {p0}.length",
        generators: { "{p0}": { type: "array", constraints: { element: "integer", maxLength: 20 } } },
        seedInputs: [
          { label: "normal", value: { "{p0}": [1, 2, 3] } },
          { label: "boundary", value: { "{p0}": [] } },
          { label: "extreme", value: { "{p0}": [0] } },
        ],
        evidence: "Map operation produces same number of elements",
        confidence: 0.90,
      },
    ],
  },

  // === Unique / Deduplicate ===
  {
    domain: "deduplicate",
    namePatterns: [/unique/i, /dedup/i, /distinct/i],
    returnTypePattern: /\[\]|Array/,
    properties: [
      {
        description: "{fn} result has no duplicates",
        category: "boundary",
        assertion: "new Set({fn}({p0})).size === {fn}({p0}).length",
        generators: { "{p0}": { type: "array", constraints: { element: "integer", maxLength: 20 } } },
        seedInputs: [
          { label: "normal", value: { "{p0}": [1, 2, 2, 3, 3, 3] } },
          { label: "boundary", value: { "{p0}": [] } },
          { label: "extreme", value: { "{p0}": [1, 1, 1, 1, 1] } },
        ],
        evidence: "Deduplication output must contain unique elements only",
        confidence: 0.95,
      },
      {
        description: "{fn} result length is at most input length",
        category: "conservation",
        assertion: "{fn}({p0}).length <= {p0}.length",
        generators: { "{p0}": { type: "array", constraints: { element: "integer", maxLength: 20 } } },
        seedInputs: [
          { label: "normal", value: { "{p0}": [1, 2, 3] } },
          { label: "boundary", value: { "{p0}": [] } },
          { label: "extreme", value: { "{p0}": [42] } },
        ],
        evidence: "Removing duplicates cannot add elements",
        confidence: 0.95,
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Template matching & instantiation
// ---------------------------------------------------------------------------

/**
 * Instantiate a template string by replacing placeholders with actual values.
 */
function instantiate(
  template: string,
  fnName: string,
  paramNames: readonly string[],
): string {
  let result = template.replace(/\{fn\}/g, fnName);
  for (let i = 0; i < paramNames.length; i++) {
    result = result.replace(new RegExp(`\\{p${i}\\}`, "g"), paramNames[i]);
  }
  return result;
}

/**
 * Instantiate generator specs by replacing placeholder keys with actual param names.
 */
function instantiateGenerators(
  generators: Readonly<Record<string, GeneratorSpec>>,
  paramNames: readonly string[],
): Record<string, GeneratorSpec> {
  const result: Record<string, GeneratorSpec> = {};
  for (const [key, spec] of Object.entries(generators)) {
    let actualKey = key;
    for (let i = 0; i < paramNames.length; i++) {
      actualKey = actualKey.replace(`{p${i}}`, paramNames[i]);
    }
    result[actualKey] = spec;
  }
  return result;
}

/**
 * Instantiate seed inputs by replacing placeholder keys with actual param names.
 */
function instantiateSeedInputs(
  seeds: readonly SeedInput[],
  paramNames: readonly string[],
): SeedInput[] {
  return seeds.map((seed) => {
    if (typeof seed.value !== "object" || seed.value === null) return seed;
    const newValue: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(seed.value as Record<string, unknown>)) {
      let actualKey = key;
      for (let i = 0; i < paramNames.length; i++) {
        actualKey = actualKey.replace(`{p${i}}`, paramNames[i]);
      }
      newValue[actualKey] = val;
    }
    return { ...seed, value: newValue };
  });
}

/**
 * Check if a domain template matches the given function signature.
 */
function matchesDomain(
  domain: DomainTemplate,
  sig: FunctionSignature,
): boolean {
  // Check name pattern
  const nameMatch = domain.namePatterns.some((p) => p.test(sig.name));
  if (!nameMatch) return false;

  // Check min params
  if (domain.minParams !== undefined && sig.parameters.length < domain.minParams) return false;

  // Check return type pattern
  if (domain.returnTypePattern && sig.returnType) {
    if (!domain.returnTypePattern.test(sig.returnType)) return false;
  }

  // Check param type pattern
  if (domain.paramTypePattern) {
    const hasMatchingParam = sig.parameters.some(
      (p) => p.type && domain.paramTypePattern!.test(p.type),
    );
    if (!hasMatchingParam) return false;
  }

  return true;
}

/**
 * Match a function signature against all domain templates and return
 * instantiated properties ready for scoring.
 *
 * @returns 0-5 properties that match the function's domain
 */
export function matchTemplates(sig: FunctionSignature): readonly RawTemplateProperty[] {
  const paramNames = sig.parameters.map((p) => p.name);
  const results: RawTemplateProperty[] = [];

  for (const domain of DOMAIN_TEMPLATES) {
    if (!matchesDomain(domain, sig)) continue;

    for (const template of domain.properties) {
      // Check if we have enough params for this template
      const maxParamIdx = Math.max(
        ...Array.from(template.assertion.matchAll(/\{p(\d+)\}/g)).map((m) => Number(m[1])),
        -1,
      );
      if (maxParamIdx >= paramNames.length) continue;

      results.push({
        targetFunction: sig.name,
        description: instantiate(template.description, sig.name, paramNames),
        category: template.category,
        assertion: instantiate(template.assertion, sig.name, paramNames),
        generators: instantiateGenerators(template.generators, paramNames),
        seedInputs: instantiateSeedInputs(template.seedInputs, paramNames),
        evidence: template.evidence,
        confidence: template.confidence,
      });
    }

    // Limit to 5 properties max per function
    if (results.length >= 5) break;
  }

  return results.slice(0, 5);
}

/**
 * Get all available domain names for documentation/listing.
 */
export function getAvailableDomains(): readonly string[] {
  return DOMAIN_TEMPLATES.map((d) => d.domain);
}

/**
 * Get template count per domain for stats.
 */
export function getTemplateStats(): ReadonlyArray<{ domain: string; templates: number; patterns: readonly string[] }> {
  return DOMAIN_TEMPLATES.map((d) => ({
    domain: d.domain,
    templates: d.properties.length,
    patterns: d.namePatterns.map((p) => p.source),
  }));
}
