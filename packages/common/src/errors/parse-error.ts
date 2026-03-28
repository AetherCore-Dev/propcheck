import { PropcheckError } from "./base";

/** Error during source code parsing (TypeScript Compiler API / regex). */
export class ParseError extends PropcheckError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "PARSE_ERROR", context);
    this.name = "ParseError";
  }
}
