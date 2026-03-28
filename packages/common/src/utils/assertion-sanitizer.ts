/**
 * Assertion sanitizer — whitelist-validates LLM-generated assertions
 * before embedding them into executable test code.
 *
 * Prevents code injection from malicious or compromised LLM output.
 */

/** Patterns that MUST NOT appear in assertions (code injection vectors). */
const DANGEROUS_PATTERNS: readonly RegExp[] = [
  /\brequire\s*\(/,          // Node.js require
  /\bimport\s*\(/,           // Dynamic import
  /\bprocess\b/,             // process object access
  /\beval\s*\(/,             // eval()
  /\bFunction\s*\(/,         // Function constructor
  /\b__dirname\b/,           // Directory access
  /\b__filename\b/,          // File access
  /\bglobal\b/,              // Global object
  /\bglobalThis\b/,         // GlobalThis
  /\bchild_process\b/,       // Child process module
  /\bexecSync\b/,            // Synchronous exec
  /\bspawnSync\b/,           // Synchronous spawn
  /`/,                        // Template literals (can execute expressions)
  /\bfs\b\s*\./,             // File system access
  /\bnet\b\s*\./,            // Network access
  /\bhttp\b\s*\./,           // HTTP access
  /\bos\b\s*\./,             // OS module access
  /\bfetch\s*\(/,            // fetch() API — async data exfiltration
  /\bXMLHttpRequest\b/,      // XHR constructor
  /\bWebSocket\b/,           // WebSocket constructor
  /\bsetTimeout\s*\(/,       // Async side-effect via timer
  /\bsetInterval\s*\(/,      // Async side-effect via timer
  /\bPromise\s*\./,          // Promise chain (can wrap exfil calls)
  /\bnew\s+Function\b/,      // new Function()
  /;\s*\w/,                   // Statement separator followed by identifier (multi-statement)
  /[\r\n\u2028\u2029]/,      // Newlines / line separators (multi-statement via newline)
  /\/\//,                     // Single-line comment (could prematurely end assertion line)
  /\/\*/,                     // Block comment open (could swallow surrounding code)
];

/** Maximum allowed assertion length. */
const MAX_ASSERTION_LENGTH = 500;

/**
 * Validate that an assertion string is safe to embed in generated test code.
 *
 * Returns { valid: true } or { valid: false, reason: string }.
 */
export function validateAssertion(assertion: string): { readonly valid: true } | { readonly valid: false; readonly reason: string } {
  if (!assertion || assertion.trim().length === 0) {
    return { valid: false, reason: "Assertion is empty" };
  }

  if (assertion.length > MAX_ASSERTION_LENGTH) {
    return { valid: false, reason: `Assertion too long (${assertion.length} chars, max ${MAX_ASSERTION_LENGTH})` };
  }

  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(assertion)) {
      return { valid: false, reason: `Assertion contains disallowed pattern: ${pattern.source}` };
    }
  }

  return { valid: true };
}

/**
 * Validate a generator key is a safe JavaScript identifier.
 */
export function validateGeneratorKey(key: string): boolean {
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key);
}
