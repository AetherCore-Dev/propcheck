/**
 * Property Definition — the core data model of propcheck.
 *
 * A property is a testable invariant about a function's behavior,
 * inferred by an LLM and executed by a deterministic PBT engine.
 */

/** Categories of properties that propcheck can infer. */
export type PropertyCategory =
  | "roundtrip"         // decode(encode(x)) === x
  | "idempotent"        // f(f(x)) === f(x)
  | "conservation"      // sum is preserved across operations
  | "monotonic"         // sorted[i] <= sorted[i+1]
  | "equivalence"       // f(x) === g(x) for alternative impl
  | "type-preservation" // typeof(f(x)) === expectedType
  | "cross-function"    // relationship between two functions
  | "boundary"          // edge case behavior (result >= 0, etc.)
  | "metamorphic";      // f(transform(x)) relates to f(x)

export type PropertyStatus =
  | "accepted"
  | "risky"
  | "refined"
  | "quarantined"
  | "dropped";

export type PropertyRiskTag =
  | "float_exact_equality"
  | "tiny_abs_tolerance"
  | "missing_precondition"
  | "wide_numeric_domain"
  | "doc_domain_mismatch"
  | "roundtrip_numeric_fragility"
  | "metamorphic_scale_risk";

export interface ValidationEvidence {
  readonly smokePasses: number;
  readonly canaryPasses: number;
  readonly seedsTested: readonly number[];
  readonly lastValidatedAt: string;
}

/** Specifies how to generate random inputs for a parameter. */
export interface GeneratorSpec {
  readonly type: string;
  readonly constraints?: Readonly<Record<string, unknown>>;
}

/** A concrete input example, co-generated with the property. */
export interface SeedInput {
  readonly label: "normal" | "boundary" | "extreme";
  readonly value: unknown;
}

/**
 * A single property inferred by the LLM.
 *
 * All fields are readonly — PropertyDefinition is immutable.
 * To "update" a property, create a new object.
 */
export interface PropertyDefinition {
  readonly id: string;
  readonly targetFunction: string;
  readonly description: string;
  readonly category: PropertyCategory;
  readonly assertion: string;
  readonly generators: Readonly<Record<string, GeneratorSpec>>;
  readonly seedInputs: readonly SeedInput[];
  readonly score: number;
  readonly riskScore: number;
  readonly riskTags: readonly PropertyRiskTag[];
  readonly status: PropertyStatus;
  readonly validation?: ValidationEvidence;
  readonly humanVerified?: boolean;
  readonly confidence: number;
  readonly evidence: string;
  readonly sourceHash: string;
  readonly inferredAt: string;
  readonly modelId: string;
}

/**
 * A set of properties for a single source module.
 * Keyed by module path in .propcheck/properties.json.
 */
export interface PropertySet {
  readonly schemaVersion: 2;
  readonly module: string;
  readonly filePath: string;
  readonly properties: readonly PropertyDefinition[];
  readonly sourceHash: string;
  readonly inferredAt: string;
}
