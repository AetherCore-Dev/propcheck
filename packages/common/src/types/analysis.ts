/**
 * Analysis types — output from parser, input to LLM.
 */

/** Languages supported by propcheck. */
export type SupportedLanguage = "typescript" | "javascript" | "python" | "rust";

/** A single function parameter with optional type info. */
export interface ParameterInfo {
  readonly name: string;
  readonly type: string | null;
  readonly defaultValue: string | null;
  readonly isOptional: boolean;
  readonly isRest: boolean;
}

/** Source location for a code element. */
export interface SourceLocation {
  readonly startLine: number;
  readonly endLine: number;
  readonly startColumn: number;
  readonly endColumn: number;
}

/** A function extracted from source code. */
export interface FunctionSignature {
  readonly name: string;
  readonly qualifiedName: string;
  readonly parameters: readonly ParameterInfo[];
  readonly returnType: string | null;
  readonly docstring: string | null;
  readonly visibility: "public" | "private" | "internal";
  readonly isAsync: boolean;
  readonly isGenerator: boolean;
  readonly loc: SourceLocation;
}

/** A type/interface definition extracted from source. */
export interface TypeDefinition {
  readonly name: string;
  readonly kind: "interface" | "type" | "enum" | "class";
  readonly properties: readonly TypeProperty[];
  readonly loc: SourceLocation;
}

/** A single property within a type definition. */
export interface TypeProperty {
  readonly name: string;
  readonly type: string;
  readonly isOptional: boolean;
  readonly isReadonly: boolean;
}

/** An import statement extracted from source. */
export interface ImportInfo {
  readonly source: string;
  readonly specifiers: readonly string[];
  readonly isDefault: boolean;
  readonly isNamespace: boolean;
}

/** Signals extracted from different analysis sources. */
export interface AstSignal {
  readonly kind: string;
  readonly detail: string;
}

export interface TypeSignal {
  readonly functionName: string;
  readonly paramTypes: readonly string[];
  readonly returnType: string | null;
}

export interface DocSignal {
  readonly functionName: string;
  readonly description: string;
  readonly paramDocs: Readonly<Record<string, string>>;
  readonly returnDoc: string | null;
  readonly throws: readonly string[];
  readonly examples: readonly string[];
}

export interface SpecConstraint {
  readonly subject: string;
  readonly kind: "non-negative" | "positive" | "range";
  readonly detail: string;
  readonly min?: number;
  readonly max?: number;
}

export interface SpecSignal {
  readonly functionName: string;
  readonly requirements: readonly string[];
  readonly constraints: readonly SpecConstraint[];
}

export interface SpecContext {
  readonly sourcePath: string;
  readonly rawText: string;
  readonly generalRequirements: readonly string[];
  readonly functions: readonly SpecSignal[];
}

/**
 * Complete analysis context sent to the LLM.
 * Combines all signals from parser + analyzer.
 */
export interface AnalysisContext {
  readonly filePath: string;
  readonly language: SupportedLanguage;
  readonly sourceCode: string;
  readonly functions: readonly FunctionSignature[];
  readonly types: readonly TypeDefinition[];
  readonly imports: readonly ImportInfo[];
  readonly spec?: SpecContext;
  readonly signals: {
    readonly ast: readonly AstSignal[];
    readonly type: readonly TypeSignal[];
    readonly doc: readonly DocSignal[];
  };
}
