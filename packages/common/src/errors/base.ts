/**
 * Base error class for all propcheck errors.
 *
 * Provides structured error context for debugging and user-friendly messages.
 */
export class PropcheckError extends Error {
  readonly code: string;
  readonly context: Readonly<Record<string, unknown>>;

  constructor(
    message: string,
    code: string,
    context: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "PropcheckError";
    this.code = code;
    this.context = Object.freeze({ ...context });

    // Maintain proper stack trace in V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, PropcheckError);
    }
  }
}
