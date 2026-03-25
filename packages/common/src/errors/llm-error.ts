import { PropcheckError } from "./base";

/** Error during LLM API call (Anthropic SDK). */
export class LlmError extends PropcheckError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "LLM_ERROR", context);
    this.name = "LlmError";
  }
}
