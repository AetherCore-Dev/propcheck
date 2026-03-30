import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { inferCommand, canaryValidateProperties } from "../commands/infer";
import { runCommand } from "../commands/run";
import { badgeCommand } from "../commands/badge";
import { initStore, setProperties } from "@propcheck/store";
import { hashContent } from "@propcheck/common";
import type { PropertyDefinition, PropertySet } from "@propcheck/common";

class ExitSignal extends Error {
  constructor(readonly code: number) {
    super(`process.exit(${code})`);
  }
}

async function withTempProject(fn: (dir: string) => Promise<void>): Promise<void> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "propcheck-cli-"));
  const originalCwd = process.cwd();
  try {
    process.chdir(tmpDir);
    await fn(tmpDir);
  } finally {
    process.chdir(originalCwd);
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}

async function withInterceptedExit(fn: () => Promise<void>): Promise<number | null> {
  const originalExit = process.exit;
  try {
    (process as unknown as { exit: (code?: number) => never }).exit = ((code?: number) => {
      throw new ExitSignal(code ?? 0);
    }) as typeof process.exit;
    await fn();
    return null;
  } catch (error) {
    if (error instanceof ExitSignal) {
      return error.code;
    }
    throw error;
  } finally {
    (process as unknown as { exit: typeof process.exit }).exit = originalExit;
  }
}

async function createFakeHypothesis(rootDir: string): Promise<string> {
  const pyDepsDir = path.join(rootDir, "pydeps");
  const hypDir = path.join(pyDepsDir, "hypothesis");
  await fs.mkdir(hypDir, { recursive: true });

  await fs.writeFile(
    path.join(hypDir, "__init__.py"),
    [
      "from . import strategies",
      "",
      "def given(**kwargs):",
      "    def decorator(fn):",
      "        def wrapper():",
      "            values = {name: strategy() if callable(strategy) else strategy for name, strategy in kwargs.items()}",
      "            return fn(**values)",
      "        return wrapper",
      "    return decorator",
      "",
      "def settings(**kwargs):",
      "    def decorator(fn):",
      "        return fn",
      "    return decorator",
      "",
    ].join("\n"),
    "utf8",
  );

  await fs.writeFile(
    path.join(hypDir, "strategies.py"),
    [
      "def integers(min_value=None, max_value=None):",
      "    return lambda: min_value if min_value is not None else 1",
      "",
      "def floats(allow_nan=False, allow_infinity=False, min_value=None, max_value=None):",
      "    return lambda: float(min_value if min_value is not None else 1.5)",
      "",
      "def text(max_size=None):",
      "    return lambda: 'x' * min(max_size or 1, 1)",
      "",
      "def booleans():",
      "    return lambda: False",
      "",
      "def lists(element, max_size=None):",
      "    return lambda: [element()] if callable(element) else [element]",
      "",
      "def dictionaries(keys, values):",
      "    return lambda: {'k': values() if callable(values) else values}",
      "",
    ].join("\n"),
    "utf8",
  );

  return pyDepsDir;
}

async function createMathModule(projectDir: string): Promise<string> {
  const source = [
    "exports.add = (a, b) => a + b;",
    "",
  ].join("\n");
  await fs.writeFile(path.join(projectDir, "math.js"), source, "utf8");
  return source;
}

async function createScaleModule(projectDir: string): Promise<string> {
  const source = [
    "exports.scale = (x) => x * 0.1 + x * 0.2;",
    "",
  ].join("\n");
  await fs.writeFile(path.join(projectDir, "scale.js"), source, "utf8");
  return source;
}

function makeProperty(overrides: Partial<PropertyDefinition> = {}): PropertyDefinition {
  return {
    id: "prop_001",
    targetFunction: "add",
    description: "addition is commutative",
    category: "equivalence",
    assertion: "add(a, b) === add(b, a)",
    generators: { a: { type: "integer" }, b: { type: "integer" } },
    seedInputs: [{ label: "normal", value: { a: 1, b: 2 } }],
    score: 13,
    riskScore: 13,
    riskTags: [],
    status: "accepted",
    confidence: 0.9,
    evidence: "addition is commutative",
    sourceHash: "abc",
    inferredAt: "2026-03-30T00:00:00.000Z",
    modelId: "test-model",
    ...overrides,
  };
}

describe("cli commands", () => {
  it("should infer and validate Python properties when Hypothesis is available", async () => {
    await withTempProject(async (projectDir) => {
      const originalPythonPath = process.env["PYTHONPATH"];
      const pyDepsDir = await createFakeHypothesis(projectDir);
      process.env["PYTHONPATH"] = originalPythonPath ? `${pyDepsDir}${path.delimiter}${originalPythonPath}` : pyDepsDir;

      try {
        await fs.writeFile(
          path.join(projectDir, "math.py"),
          [
            "def add(a: int, b: int) -> int:",
            "    return a + b",
            "",
          ].join("\n"),
          "utf8",
        );

        await inferCommand("math.py", { mock: true });

        const store = JSON.parse(await fs.readFile(path.join(projectDir, ".propcheck", "properties.json"), "utf8")) as {
          modules: Record<string, PropertySet>;
        };

        assert.ok(store.modules["math.py"]);
        assert.ok(store.modules["math.py"].properties.length >= 1);
      } finally {
        if (originalPythonPath === undefined) {
          delete process.env["PYTHONPATH"];
        } else {
          process.env["PYTHONPATH"] = originalPythonPath;
        }
      }
    });
  });

  it("should exit with code 2 when run has no inferred properties", async () => {
    await withTempProject(async () => {
      const exitCode = await withInterceptedExit(async () => {
        await runCommand(undefined, {});
      });

      assert.equal(exitCode, 2);
    });
  });

  it("should quarantine risky properties that fail canary validation", async () => {
    await withTempProject(async (projectDir) => {
      const source = await createMathModule(projectDir);
      await initStore(projectDir);

      const result = await canaryValidateProperties(
        [makeProperty({
          assertion: "add(a, b) === 0",
          generators: { a: { type: "float" }, b: { type: "float" } },
          riskScore: 8,
          riskTags: ["float_exact_equality"],
          status: "risky",
          sourceHash: hashContent(source),
        })],
        path.join(projectDir, "math.js"),
        path.join(projectDir, ".propcheck"),
        "javascript",
      );

      assert.equal(result.validated.length, 0);
      assert.equal(result.quarantined.length, 1);
      assert.equal(result.quarantined[0].prop.status, "quarantined");
      assert.ok(result.quarantined[0].reason.length > 0);
    });
  });

  it("should auto-weaken fragile float equality properties during canary validation", async () => {
    await withTempProject(async (projectDir) => {
      const source = await createScaleModule(projectDir);
      await initStore(projectDir);

      const result = await canaryValidateProperties(
        [makeProperty({
          targetFunction: "scale",
          assertion: "scale(x) === x * 0.3",
          generators: { x: { type: "float" } },
          riskScore: 7,
          riskTags: ["float_exact_equality", "wide_numeric_domain"],
          status: "risky",
          sourceHash: hashContent(source),
        })],
        path.join(projectDir, "scale.js"),
        path.join(projectDir, ".propcheck"),
        "javascript",
      );

      assert.equal(result.quarantined.length, 0);
      assert.equal(result.validated.length, 1);
      assert.equal(result.validated[0].status, "refined");
      assert.match(result.validated[0].assertion, /approxEqual/);
    });
  });

  it("should auto-weaken tiny absolute tolerances to stable approx checks", async () => {
    await withTempProject(async (projectDir) => {
      const source = await createScaleModule(projectDir);
      await initStore(projectDir);

      const result = await canaryValidateProperties(
        [makeProperty({
          targetFunction: "scale",
          assertion: "Math.abs(scale(x) - x * 0.3) < 1e-18",
          generators: { x: { type: "float" } },
          riskScore: 7,
          riskTags: ["tiny_abs_tolerance", "wide_numeric_domain"],
          status: "risky",
          sourceHash: hashContent(source),
        })],
        path.join(projectDir, "scale.js"),
        path.join(projectDir, ".propcheck"),
        "javascript",
      );

      assert.equal(result.quarantined.length, 0);
      assert.equal(result.validated.length, 1);
      assert.equal(result.validated[0].status, "refined");
      assert.match(result.validated[0].assertion, /approxEqual\(.*1e-6, 1e-6\)/);
    });
  });

  it("should skip quarantined properties by default", async () => {
    await withTempProject(async (projectDir) => {
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (...args: unknown[]) => {
        logs.push(args.map(String).join(" "));
      };

      try {
        const source = await createMathModule(projectDir);
        await initStore(projectDir);
        await setProperties(path.join(projectDir, ".propcheck"), "math.js", {
          schemaVersion: 2,
          module: "math.js",
          filePath: "math.js",
          properties: [
            makeProperty(),
            makeProperty({ id: "prop_002", description: "quarantined property", status: "quarantined" }),
          ],
          sourceHash: hashContent(source),
          inferredAt: "2026-03-30T00:00:00.000Z",
        });

        const exitCode = await withInterceptedExit(async () => {
          await runCommand("math.js", {});
        });

        assert.equal(exitCode, 0);
        assert.ok(logs.some((line) => line.includes("Skipping 1 quarantined property in math.js")));
      } finally {
        console.log = originalLog;
      }
    });
  });

  it("should include skipped dropped properties in JSON output", async () => {
    await withTempProject(async (projectDir) => {
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (...args: unknown[]) => {
        logs.push(args.map(String).join(" "));
      };

      try {
        const source = await createMathModule(projectDir);
        await initStore(projectDir);
        await setProperties(path.join(projectDir, ".propcheck"), "math.js", {
          schemaVersion: 2,
          module: "math.js",
          filePath: "math.js",
          properties: [makeProperty({ status: "dropped" })],
          sourceHash: hashContent(source),
          inferredAt: "2026-03-30T00:00:00.000Z",
        });

        const exitCode = await withInterceptedExit(async () => {
          await runCommand("math.js", { json: true });
        });

        assert.equal(exitCode, 0);
        const report = JSON.parse(logs[0]) as {
          skipped: Array<{ propertyId: string; reason: string; propertyStatus: string }>;
          summary: { skipped: number; total: number };
        };
        assert.equal(report.summary.total, 0);
        assert.equal(report.summary.skipped, 1);
        assert.deepEqual(report.skipped, [{ propertyId: "prop_001", reason: "dropped", propertyStatus: "dropped" }]);
      } finally {
        console.log = originalLog;
      }
    });
  });

  it("should honor --skip filters and exit cleanly when nothing remains", async () => {
    await withTempProject(async (projectDir) => {
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (...args: unknown[]) => {
        logs.push(args.map(String).join(" "));
      };

      try {
        const source = await createMathModule(projectDir);
        await initStore(projectDir);
        await setProperties(path.join(projectDir, ".propcheck"), "math.js", {
          schemaVersion: 2,
          module: "math.js",
          filePath: "math.js",
          properties: [makeProperty()],
          sourceHash: hashContent(source),
          inferredAt: "2026-03-30T00:00:00.000Z",
        });

        const exitCode = await withInterceptedExit(async () => {
          await runCommand("math.js", { skip: "prop_001" });
        });

        assert.equal(exitCode, 0);
        assert.ok(logs.some((line) => line.includes("No runnable properties remain after applying status and CLI filters")));
      } finally {
        console.log = originalLog;
      }
    });
  });

  it("should print a badge after properties have been stored", async () => {
    await withTempProject(async (projectDir) => {
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (...args: unknown[]) => {
        logs.push(args.map(String).join(" "));
      };

      try {
        await initStore(projectDir);
        await setProperties(path.join(projectDir, ".propcheck"), "math.ts", {
          schemaVersion: 2,
          module: "math.ts",
          filePath: "math.ts",
          properties: [makeProperty()],
          sourceHash: "abc",
          inferredAt: "2026-03-30T00:00:00.000Z",
        });

        const exitCode = await withInterceptedExit(async () => {
          await badgeCommand();
        });

        assert.equal(exitCode, null);
        assert.ok(logs.some((line) => line.includes("Add this badge")));
        assert.ok(logs.some((line) => line.includes("img.shields.io")));
      } finally {
        console.log = originalLog;
      }
    });
  });
});
