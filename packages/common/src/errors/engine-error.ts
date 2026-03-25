import { PropcheckError } from "./base";

/** Error during PBT engine execution (fast-check, Hypothesis, etc). */
export class EngineError extends PropcheckError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "ENGINE_ERROR", context);
    this.name = "EngineError";
  }
}
