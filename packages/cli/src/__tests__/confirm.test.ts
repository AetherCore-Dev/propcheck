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
): Promise<{
  accepted: readonly PropertyDefinition[];
  quarantined: readonly PropertyDefinition[];
  dropped: readonly PropertyDefinition[];
  logs: readonly string[];
}> {
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
  const logs: string[] = [];

  // Override at module level
  Object.defineProperty(process, "stdin", { value: inputStream, writable: true, configurable: true });
  Object.defineProperty(process, "stdout", { value: nullOutput, writable: true, configurable: true });
  console.log = (...args: unknown[]) => {
    logs.push(args.map((arg) => String(arg)).join(" "));
  };

  try {
    // isTTY check would fail with our mock, so we call confirmProperties directly
    // It creates its own readline from process.stdin
    const result = await confirmProperties(properties);
    return { ...result, logs };
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
    assert.equal(result.accepted[0].humanVerified, true);
  });

  it("should quarantine with 'q' input", async () => {
    const props = [makeProperty("prop_001")];
    const result = await runConfirmWithInputs(props, ["q"]);
    assert.equal(result.quarantined.length, 1);
    assert.equal(result.quarantined[0].status, "quarantined");
    assert.equal(result.quarantined[0].humanVerified, true);
  });

  it("should drop with 'd' input", async () => {
    const props = [makeProperty("prop_001")];
    const result = await runConfirmWithInputs(props, ["d"]);
    assert.equal(result.dropped.length, 1);
    assert.equal(result.dropped[0].status, "dropped");
    assert.equal(result.dropped[0].humanVerified, undefined);
  });

  it("should accept-all remaining with 'A' input", async () => {
    const props = [makeProperty("prop_001"), makeProperty("prop_002"), makeProperty("prop_003")];
    const result = await runConfirmWithInputs(props, ["A"]);
    assert.equal(result.accepted.length, 3, "All 3 should be accepted");
    assert.ok(result.accepted.every((prop) => prop.humanVerified === true));
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

  it("should show friendly conflict labels and evidence source during review", async () => {
    const props = [makeProperty("prop_001", {
      riskTags: ["spec_code_conflict"],
      status: "risky",
      evidenceSource: "mixed",
    })];
    const result = await runConfirmWithInputs(props, ["i"]);
    const output = result.logs.join("\n");
    assert.match(output, /spec conflict/);
    assert.match(output, /Evidence source: mixed/);
    assert.match(output, /Conflict rules require explicit \(i\)ntentional confirmation/i);
    assert.match(output, /confirm the behavior is intentional before accepting/i);
    assert.match(output, /Accepted as intentional/);
    assert.equal(result.accepted[0].humanVerified, true);
  });

  it("should require explicit intentional confirmation for conflict properties", async () => {
    const props = [makeProperty("prop_001", {
      riskTags: ["doc_domain_mismatch"],
      status: "risky",
    })];
    const result = await runConfirmWithInputs(props, ["", "i"]);
    const output = result.logs.join("\n");
    assert.equal(result.accepted.length, 1);
    assert.match(output, /Unrecognized: ""\. Use \(i\)ntentional/i);
    assert.match(output, /Accepted as intentional/);
  });

  it("accept-all should still stop for conflict properties", async () => {
    const props = [
      makeProperty("prop_001"),
      makeProperty("prop_002", { riskTags: ["spec_code_conflict"], status: "risky" }),
      makeProperty("prop_003"),
    ];
    const result = await runConfirmWithInputs(props, ["A", "i"]);
    const output = result.logs.join("\n");
    assert.equal(result.accepted.length, 3);
    assert.match(output, /Accepted as intentional/);
  });
});
