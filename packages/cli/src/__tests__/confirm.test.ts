/**
 * Tests for interactive confirmation module.
 */

import { describe, it } from "node:test";
import * as assert from "node:assert/strict";

// We test the pure logic functions, not the readline interactive loop.
// The readline interaction would require mock stdin which is fragile.
// Instead we import and test the exported confirmProperties with
// a mocked stdin via Readable.

import { Readable, Writable } from "node:stream";
import * as readline from "node:readline";

// Import the module to test parseUserInput-like logic
// Since parseUserInput is not exported, we test via confirmProperties
// by providing automated stdin

import type { PropertyDefinition } from "@propcheck/common";

function makeProperty(id: string, overrides: Partial<PropertyDefinition> = {}): PropertyDefinition {
  return {
    id,
    targetFunction: "testFn",
    description: `Test property ${id}`,
    category: "boundary",
    assertion: `testFn(x) > 0`,
    generators: { x: { type: "integer", constraints: { min: 0, max: 100 } } },
    seedInputs: [
      { label: "normal", value: { x: 50 } },
      { label: "boundary", value: { x: 0 } },
      { label: "extreme", value: { x: 100 } },
    ],
    score: 12,
    riskScore: 12,
    riskTags: [],
    status: "accepted",
    confidence: 0.85,
    evidence: "Test evidence for property",
    sourceHash: "abc123",
    inferredAt: new Date().toISOString(),
    modelId: "mock",
    ...overrides,
  };
}

// Helper: create confirmProperties with mocked stdin
async function runConfirmWithInputs(
  properties: readonly PropertyDefinition[],
  inputs: string[],
): Promise<{ accepted: readonly PropertyDefinition[]; quarantined: readonly PropertyDefinition[]; dropped: readonly PropertyDefinition[] }> {
  const { confirmProperties } = await import("../commands/infer/confirm");

  // Create a readable stream that pushes answers one at a time on demand
  const answers = [...inputs];
  const inputStream = new Readable({
    read() {
      // Use setTimeout to defer push so readline has time to set up the question
      setTimeout(() => {
        const answer = answers.shift();
        if (answer !== undefined) {
          this.push(answer + "\n");
        } else {
          this.push(null);
        }
      }, 5);
    },
  });

  // Suppress output
  const nullOutput = new Writable({ write(_chunk, _enc, cb) { cb(); } });

  // Replace process.stdin temporarily
  const origStdin = process.stdin;
  const origStdout = process.stdout;
  const origLog = console.log;

  // Override at module level
  Object.defineProperty(process, "stdin", { value: inputStream, writable: true, configurable: true });
  Object.defineProperty(process, "stdout", { value: nullOutput, writable: true, configurable: true });
  console.log = () => {};

  try {
    // isTTY check would fail with our mock, so we call confirmProperties directly
    // It creates its own readline from process.stdin
    return await confirmProperties(properties);
  } finally {
    Object.defineProperty(process, "stdin", { value: origStdin, writable: true, configurable: true });
    Object.defineProperty(process, "stdout", { value: origStdout, writable: true, configurable: true });
    console.log = origLog;
  }
}

describe("confirmProperties", () => {
  it("should return empty results for empty properties", async () => {
    const { confirmProperties } = await import("../commands/infer/confirm");
    const result = await confirmProperties([]);
    assert.equal(result.accepted.length, 0);
    assert.equal(result.quarantined.length, 0);
    assert.equal(result.dropped.length, 0);
  });

  it("should accept all with 'a' input", async () => {
    const props = [makeProperty("prop_001"), makeProperty("prop_002")];
    const result = await runConfirmWithInputs(props, ["a", "a"]);
    assert.equal(result.accepted.length, 2);
    assert.equal(result.dropped.length, 0);
  });

  it("should accept on empty input (enter key)", async () => {
    const props = [makeProperty("prop_001")];
    const result = await runConfirmWithInputs(props, [""]);
    assert.equal(result.accepted.length, 1);
  });

  it("should quarantine with 'q' input", async () => {
    const props = [makeProperty("prop_001")];
    const result = await runConfirmWithInputs(props, ["q"]);
    assert.equal(result.quarantined.length, 1);
    assert.equal(result.quarantined[0].status, "quarantined");
  });

  it("should drop with 'd' input", async () => {
    const props = [makeProperty("prop_001")];
    const result = await runConfirmWithInputs(props, ["d"]);
    assert.equal(result.dropped.length, 1);
    assert.equal(result.dropped[0].status, "dropped");
  });

  it("should accept-all remaining with 'A' input", async () => {
    const props = [makeProperty("prop_001"), makeProperty("prop_002"), makeProperty("prop_003")];
    const result = await runConfirmWithInputs(props, ["A"]);
    assert.equal(result.accepted.length, 3, "All 3 should be accepted");
  });

  it("should handle mixed decisions", async () => {
    const props = [makeProperty("prop_001"), makeProperty("prop_002"), makeProperty("prop_003")];
    const result = await runConfirmWithInputs(props, ["a", "q", "d"]);
    assert.equal(result.accepted.length, 1);
    assert.equal(result.quarantined.length, 1);
    assert.equal(result.dropped.length, 1);
  });

  it("should re-prompt on unrecognized input then accept", async () => {
    const props = [makeProperty("prop_001")];
    // "xyz" is unrecognized → re-prompt, then "a" accepts
    const result = await runConfirmWithInputs(props, ["xyz", "a"]);
    assert.equal(result.accepted.length, 1);
  });
});
