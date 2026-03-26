import { describe, it, before, after } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import type { PropertySet, PropertyDefinition } from "@propcheck/common";
import {
  getProperties,
  getAllProperties,
  setProperties,
  isStale,
  removeProperties,
} from "../property-store";
import { initStore } from "../init";
import { writeTestFile, readTestFile, listTestFiles } from "../test-file-store";
import { getSeeds, addSeeds } from "../corpus-store";

function makeProp(id: string, fn: string): PropertyDefinition {
  return {
    id,
    targetFunction: fn,
    description: `Property ${id}`,
    category: "boundary",
    assertion: `result >= 0`,
    generators: { x: { type: "integer" } },
    seedInputs: [{ label: "normal", value: 5 }],
    score: 12,
    confidence: 0.8,
    evidence: "return type",
    sourceHash: "abc123",
    inferredAt: "2026-03-25T00:00:00Z",
    modelId: "claude-sonnet-4-20250514",
  };
}

function makePropertySet(module: string): PropertySet {
  return {
    module,
    filePath: module,
    properties: [makeProp("prop_001", "add"), makeProp("prop_002", "subtract")],
    sourceHash: "abc123",
    inferredAt: "2026-03-25T00:00:00Z",
  };
}

describe("property-store", () => {
  let tmpDir: string;
  let storeDir: string;

  before(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "propcheck-test-"));
    storeDir = path.join(tmpDir, ".propcheck");
    await initStore(tmpDir);
  });

  after(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("should return null for non-existent module", async () => {
    const result = await getProperties(storeDir, "nonexistent.ts");
    assert.equal(result, null);
  });

  it("should write and read properties round-trip", async () => {
    const ps = makePropertySet("src/cart.ts");
    await setProperties(storeDir, "src/cart.ts", ps);

    const read = await getProperties(storeDir, "src/cart.ts");
    assert.notEqual(read, null);
    assert.equal(read!.module, "src/cart.ts");
    assert.equal(read!.properties.length, 2);
    assert.equal(read!.properties[0].id, "prop_001");
  });

  it("should get all properties", async () => {
    const ps2 = makePropertySet("src/auth.ts");
    await setProperties(storeDir, "src/auth.ts", ps2);

    const all = await getAllProperties(storeDir);
    assert.ok(all.length >= 2);
  });

  it("should detect staleness", () => {
    const ps = makePropertySet("src/cart.ts");
    assert.equal(isStale(ps, "abc123"), false);
    assert.equal(isStale(ps, "def456"), true);
  });

  it("should remove properties", async () => {
    await removeProperties(storeDir, "src/auth.ts");
    const result = await getProperties(storeDir, "src/auth.ts");
    assert.equal(result, null);
  });
});

describe("init", () => {
  it("should create .propcheck directory structure", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "propcheck-init-"));
    try {
      const result = await initStore(tmpDir);
      assert.equal(result.created, true);

      const stat = await fs.stat(path.join(tmpDir, ".propcheck"));
      assert.ok(stat.isDirectory());

      const props = await fs.readFile(
        path.join(tmpDir, ".propcheck", "properties.json"),
        "utf8",
      );
      const parsed = JSON.parse(props);
      assert.equal(parsed.version, 1);
      assert.deepEqual(parsed.modules, {});

      // Subdirs exist
      for (const sub of ["tests", "corpus", "reports"]) {
        const s = await fs.stat(path.join(tmpDir, ".propcheck", sub));
        assert.ok(s.isDirectory());
      }
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("should not re-create existing store", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "propcheck-init2-"));
    try {
      await initStore(tmpDir);
      const result = await initStore(tmpDir);
      assert.equal(result.created, false);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});

describe("test-file-store", () => {
  let tmpDir: string;
  let storeDir: string;

  before(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "propcheck-tf-"));
    storeDir = path.join(tmpDir, ".propcheck");
    await initStore(tmpDir);
  });

  after(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("should write and read test files", async () => {
    const content = 'import { fc } from "fast-check";\nfc.assert(true);';
    await writeTestFile(storeDir, "cart.fc.ts", content);
    const read = await readTestFile(storeDir, "cart.fc.ts");
    assert.equal(read, content);
  });

  it("should list test files", async () => {
    const files = await listTestFiles(storeDir);
    assert.ok(files.includes("cart.fc.ts"));
  });
});

describe("corpus-store", () => {
  let tmpDir: string;
  let storeDir: string;

  before(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "propcheck-cs-"));
    storeDir = path.join(tmpDir, ".propcheck");
    await initStore(tmpDir);
  });

  after(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("should return empty for non-existent seeds", async () => {
    const seeds = await getSeeds(storeDir, "unknown");
    assert.equal(seeds.length, 0);
  });

  it("should add and get seeds", async () => {
    await addSeeds(storeDir, "add", [
      { label: "normal", value: 5 },
      { label: "boundary", value: 0 },
    ]);
    const seeds = await getSeeds(storeDir, "add");
    assert.equal(seeds.length, 2);
  });

  it("should deduplicate seeds", async () => {
    await addSeeds(storeDir, "add", [
      { label: "normal", value: 5 },
      { label: "extreme", value: 999999 },
    ]);
    const seeds = await getSeeds(storeDir, "add");
    assert.equal(seeds.length, 3); // 5 deduplicated, 999999 added
  });
});
