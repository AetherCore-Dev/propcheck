/**
 * Edge case tests for property store persistence.
 */
import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  getProperties,
  getAllProperties,
  setProperties,
  removeProperties,
  isStale,
  initStore,
} from "../index";
import type { PropertySet, PropertyDefinition } from "@propcheck/common";

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "propcheck-store-edge-"));
}

function makeProp(overrides: Partial<PropertyDefinition> = {}): PropertyDefinition {
  return {
    id: "prop_001",
    targetFunction: "add",
    description: "test",
    category: "boundary",
    assertion: "add(a, b) >= 0",
    generators: { a: { type: "integer" } },
    seedInputs: [{ label: "normal", value: 1 }],
    score: 13,
    riskScore: 0,
    riskTags: [],
    status: "accepted",
    confidence: 0.9,
    evidence: "test",
    sourceHash: "abc",
    inferredAt: "2026-01-01",
    modelId: "test",
    ...overrides,
  };
}

function makePropertySet(overrides: Partial<PropertySet> = {}): PropertySet {
  return {
    schemaVersion: 2,
    module: "math.ts",
    filePath: "math.ts",
    properties: [makeProp()],
    sourceHash: "abc",
    inferredAt: "2026-01-01",
    ...overrides,
  };
}

describe("property-store — edge cases", () => {
  it("should handle concurrent writes to different modules", async () => {
    const tmpDir = makeTmpDir();
    const storeDir = path.join(tmpDir, ".propcheck");
    await initStore(tmpDir);

    // Write two modules "simultaneously" (sequentially but both to same file)
    await setProperties(storeDir, "a.ts", makePropertySet({ module: "a.ts", filePath: "a.ts" }));
    await setProperties(storeDir, "b.ts", makePropertySet({ module: "b.ts", filePath: "b.ts" }));

    // Both should exist
    const a = await getProperties(storeDir, "a.ts");
    const b = await getProperties(storeDir, "b.ts");
    assert.ok(a);
    assert.ok(b);
    assert.equal(a.filePath, "a.ts");
    assert.equal(b.filePath, "b.ts");

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should handle removing a non-existent module gracefully", async () => {
    const tmpDir = makeTmpDir();
    const storeDir = path.join(tmpDir, ".propcheck");
    await initStore(tmpDir);

    // Remove module that doesn't exist — should not throw
    await removeProperties(storeDir, "nonexistent.ts");

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should overwrite existing module properties", async () => {
    const tmpDir = makeTmpDir();
    const storeDir = path.join(tmpDir, ".propcheck");
    await initStore(tmpDir);

    await setProperties(storeDir, "math.ts", makePropertySet({
      properties: [makeProp({ id: "prop_001" })],
    }));

    // Overwrite with new property
    await setProperties(storeDir, "math.ts", makePropertySet({
      properties: [makeProp({ id: "prop_002", description: "updated" })],
    }));

    const result = await getProperties(storeDir, "math.ts");
    assert.ok(result);
    assert.equal(result.properties.length, 1);
    assert.equal(result.properties[0].id, "prop_002");

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should return empty array from getAllProperties for fresh store", async () => {
    const tmpDir = makeTmpDir();
    const storeDir = path.join(tmpDir, ".propcheck");
    await initStore(tmpDir);

    const all = await getAllProperties(storeDir);
    assert.equal(all.length, 0);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should detect staleness correctly", () => {
    const ps = makePropertySet({ sourceHash: "abc123" });
    assert.equal(isStale(ps, "abc123"), false);
    assert.equal(isStale(ps, "different"), true);
  });

  it("should hydrate legacy properties without riskScore/riskTags", async () => {
    const tmpDir = makeTmpDir();
    const storeDir = path.join(tmpDir, ".propcheck");
    await initStore(tmpDir);

    // Write raw JSON with legacy format (missing riskScore/riskTags/status)
    const legacyData = {
      version: 1,
      modules: {
        "math.ts": {
          module: "math.ts",
          filePath: "math.ts",
          properties: [{
            id: "prop_001",
            targetFunction: "add",
            description: "test",
            category: "boundary",
            assertion: "add(a, b) >= 0",
            generators: { a: { type: "integer" } },
            seedInputs: [{ label: "normal", value: 1 }],
            score: 13,
            confidence: 0.9,
            evidence: "test",
            sourceHash: "abc",
            inferredAt: "2026-01-01",
            modelId: "test",
            // NOTE: no riskScore, riskTags, or status
          }],
          sourceHash: "abc",
          inferredAt: "2026-01-01",
        },
      },
    };
    fs.writeFileSync(
      path.join(storeDir, "properties.json"),
      JSON.stringify(legacyData, null, 2),
    );

    const result = await getProperties(storeDir, "math.ts");
    assert.ok(result);
    assert.equal(result.schemaVersion, 2); // Upgraded
    assert.equal(result.properties[0].status, "accepted"); // Default
    assert.ok(Array.isArray(result.properties[0].riskTags));
    assert.equal(typeof result.properties[0].riskScore, "number");

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should throw for corrupted JSON file", async () => {
    const tmpDir = makeTmpDir();
    const storeDir = path.join(tmpDir, ".propcheck");
    await initStore(tmpDir);

    fs.writeFileSync(path.join(storeDir, "properties.json"), "NOT JSON{{{");

    await assert.rejects(
      () => getProperties(storeDir, "math.ts"),
      /Failed to read properties/,
    );

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should throw for unsupported future version", async () => {
    const tmpDir = makeTmpDir();
    const storeDir = path.join(tmpDir, ".propcheck");
    await initStore(tmpDir);

    const futureData = { version: 999, modules: {} };
    fs.writeFileSync(
      path.join(storeDir, "properties.json"),
      JSON.stringify(futureData),
    );

    await assert.rejects(
      () => getProperties(storeDir, "math.ts"),
      /Unsupported properties file version/,
    );

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should handle multiple modules in getAllProperties", async () => {
    const tmpDir = makeTmpDir();
    const storeDir = path.join(tmpDir, ".propcheck");
    await initStore(tmpDir);

    await setProperties(storeDir, "a.ts", makePropertySet({ module: "a.ts", filePath: "a.ts" }));
    await setProperties(storeDir, "b.ts", makePropertySet({ module: "b.ts", filePath: "b.ts" }));
    await setProperties(storeDir, "c.ts", makePropertySet({ module: "c.ts", filePath: "c.ts" }));

    const all = await getAllProperties(storeDir);
    assert.equal(all.length, 3);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
