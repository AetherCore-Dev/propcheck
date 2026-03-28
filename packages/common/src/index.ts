// === Types ===
export type {
  PropertyCategory,
  GeneratorSpec,
  SeedInput,
  PropertyDefinition,
  PropertySet,
} from "./types/property";

export type {
  SupportedLanguage,
  ParameterInfo,
  SourceLocation,
  FunctionSignature,
  TypeDefinition,
  TypeProperty,
  ImportInfo,
  AstSignal,
  TypeSignal,
  DocSignal,
  AnalysisContext,
} from "./types/analysis";

export type {
  RunConfig,
  PropertyResult,
  PropertyFailure,
  PropertyError,
  PropertyOutcome,
  ExecutionResult,
  Diagnosis,
} from "./types/execution";

export { RUN_MODE_ITERATIONS } from "./types/execution";

export type {
  GeneratedTest,
  PrerequisiteCheck,
  EngineAdapter,
} from "./types/engine";

export type { PropcheckConfig } from "./types/config";
export { DEFAULT_CONFIG } from "./types/config";

// === Errors ===
export { PropcheckError } from "./errors/base";
export { ParseError } from "./errors/parse-error";
export { LlmError } from "./errors/llm-error";
export { EngineError } from "./errors/engine-error";

// === Utils ===
export { hashContent } from "./utils/hash";
export {
  toForwardSlash,
  resolveForward,
  relativeForward,
  importPath,
} from "./utils/path";
export {
  getChangedFiles,
  getChangedFunctions,
} from "./utils/git";
export type { ChangedFile } from "./utils/git";
export { validateAssertion, validateGeneratorKey } from "./utils/assertion-sanitizer";
