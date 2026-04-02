import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { inferCommand, canaryValidateProperties, autoWeakenProperty } from "../commands/infer";
import { runCommand } from "../commands/run";
import { badgeCommand } from "../commands/badge";
import { propsCommand } from "../commands/props";
import { propertyCommand } from "../commands/property";
import { initStore, setProperties, getProperties } from "@propcheck/store";
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

  it("should auto-weaken missing_precondition properties with generic try/catch wrapper", () => {
    const weakened = autoWeakenProperty(makeProperty({
      targetFunction: "validateInput",
      assertion: "validateInput(input) > 0",
      generators: { input: { type: "CustomInput" } },
      riskTags: ["missing_precondition"],
      riskScore: 12,
      status: "risky",
    }));

    assert.ok(weakened);
    if (!weakened) return;
    assert.equal(weakened.status, "refined");
    assert.match(weakened.assertion, /^\(\(\) => \{ try \{ return validateInput\(input\) > 0; \} catch \{ return true; \} \}\)\(\)$/);
    assert.ok(weakened.riskTags.includes("missing_precondition"));
  });

  it("should not double-wrap missing_precondition assertions already guarded with try/catch", () => {
    const originalAssertion = "(() => { try { return validateInput(input) > 0; } catch { return true; } })()";
    const weakened = autoWeakenProperty(makeProperty({
      targetFunction: "validateInput",
      assertion: originalAssertion,
      generators: { input: { type: "CustomInput" } },
      riskTags: ["missing_precondition"],
      riskScore: 12,
      status: "risky",
    }));

    assert.equal(weakened, null);
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

  it("propcheck props should list all properties grouped by module", async () => {
    await withTempProject(async (projectDir) => {
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (...args: unknown[]) => {
        logs.push(args.map(String).join(" "));
      };

      try {
        await initStore(projectDir);
        await setProperties(path.join(projectDir, ".propcheck"), "math.js", {
          schemaVersion: 2,
          module: "math.js",
          filePath: "math.js",
          properties: [
            makeProperty(),
            makeProperty({ id: "prop_002", description: "zero is identity", status: "risky", riskTags: ["float_exact_equality"], riskScore: 10 }),
          ],
          sourceHash: "abc",
          inferredAt: "2026-03-30T00:00:00.000Z",
        });

        await propsCommand(undefined, {});

        assert.ok(logs.some((line) => line.includes("math.js")));
        assert.ok(logs.some((line) => line.includes("prop_001")));
        assert.ok(logs.some((line) => line.includes("prop_002")));
        assert.ok(logs.some((line) => line.includes("2 total")));
      } finally {
        console.log = originalLog;
      }
    });
  });

  it("propcheck props --status should filter properties", async () => {
    await withTempProject(async (projectDir) => {
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (...args: unknown[]) => {
        logs.push(args.map(String).join(" "));
      };

      try {
        await initStore(projectDir);
        await setProperties(path.join(projectDir, ".propcheck"), "math.js", {
          schemaVersion: 2,
          module: "math.js",
          filePath: "math.js",
          properties: [
            makeProperty(),
            makeProperty({ id: "prop_002", description: "quarantined prop", status: "quarantined" }),
          ],
          sourceHash: "abc",
          inferredAt: "2026-03-30T00:00:00.000Z",
        });

        await propsCommand(undefined, { status: "quarantined" });

        const allOutput = logs.join("\n");
        assert.ok(allOutput.includes("prop_002"));
        assert.ok(!allOutput.includes("prop_001"));
      } finally {
        console.log = originalLog;
      }
    });
  });

  it("propcheck props --json should output structured JSON", async () => {
    await withTempProject(async (projectDir) => {
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (...args: unknown[]) => {
        logs.push(args.map(String).join(" "));
      };

      try {
        await initStore(projectDir);
        await setProperties(path.join(projectDir, ".propcheck"), "math.js", {
          schemaVersion: 2,
          module: "math.js",
          filePath: "math.js",
          properties: [makeProperty()],
          sourceHash: "abc",
          inferredAt: "2026-03-30T00:00:00.000Z",
        });

        await propsCommand(undefined, { json: true });

        const output = JSON.parse(logs[0]) as { modules: Array<{ filePath: string; properties: unknown[] }> };
        assert.equal(output.modules.length, 1);
        assert.equal(output.modules[0].filePath, "math.js");
        assert.equal(output.modules[0].properties.length, 1);
      } finally {
        console.log = originalLog;
      }
    });
  });

  it("propcheck property should display property detail", async () => {
    await withTempProject(async (projectDir) => {
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (...args: unknown[]) => {
        logs.push(args.map(String).join(" "));
      };

      try {
        await initStore(projectDir);
        await setProperties(path.join(projectDir, ".propcheck"), "math.js", {
          schemaVersion: 2,
          module: "math.js",
          filePath: "math.js",
          properties: [makeProperty()],
          sourceHash: "abc",
          inferredAt: "2026-03-30T00:00:00.000Z",
        });

        await propertyCommand("math.js", "prop_001", {});

        const allOutput = logs.join("\n");
        assert.ok(allOutput.includes("prop_001"));
        assert.ok(allOutput.includes("add"));
        assert.ok(allOutput.includes("addition is commutative"));
        assert.ok(allOutput.includes("add(a, b) === add(b, a)"));
      } finally {
        console.log = originalLog;
      }
    });
  });

  it("propcheck property --status should update status and set humanVerified", async () => {
    await withTempProject(async (projectDir) => {
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (...args: unknown[]) => {
        logs.push(args.map(String).join(" "));
      };

      try {
        await initStore(projectDir);
        await setProperties(path.join(projectDir, ".propcheck"), "math.js", {
          schemaVersion: 2,
          module: "math.js",
          filePath: "math.js",
          properties: [makeProperty({ status: "risky", riskTags: ["float_exact_equality"], riskScore: 10 })],
          sourceHash: "abc",
          inferredAt: "2026-03-30T00:00:00.000Z",
        });

        await propertyCommand("math.js", "prop_001", { status: "quarantined" });

        // Verify console output
        const allOutput = logs.join("\n");
        assert.ok(allOutput.includes("risky"));
        assert.ok(allOutput.includes("quarantined"));
        assert.ok(allOutput.includes("humanVerified"));

        // Verify persisted state
        const ps = await getProperties(path.join(projectDir, ".propcheck"), "math.js");
        assert.ok(ps);
        const updated = ps.properties.find((p) => p.id === "prop_001");
        assert.ok(updated);
        assert.equal(updated.status, "quarantined");
        assert.equal(updated.humanVerified, true);
      } finally {
        console.log = originalLog;
      }
    });
  });

  it("propcheck property --json should output structured JSON", async () => {
    await withTempProject(async (projectDir) => {
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (...args: unknown[]) => {
        logs.push(args.map(String).join(" "));
      };

      try {
        await initStore(projectDir);
        await setProperties(path.join(projectDir, ".propcheck"), "math.js", {
          schemaVersion: 2,
          module: "math.js",
          filePath: "math.js",
          properties: [makeProperty()],
          sourceHash: "abc",
          inferredAt: "2026-03-30T00:00:00.000Z",
        });

        await propertyCommand("math.js", "prop_001", { json: true });

        const output = JSON.parse(logs[0]) as { filePath: string; property: { id: string; status: string } };
        assert.equal(output.filePath, "math.js");
        assert.equal(output.property.id, "prop_001");
        assert.equal(output.property.status, "accepted");
      } finally {
        console.log = originalLog;
      }
    });
  });

  it("propcheck property should exit 2 for non-existent property ID", async () => {
    await withTempProject(async (projectDir) => {
      await initStore(projectDir);
      await setProperties(path.join(projectDir, ".propcheck"), "math.js", {
        schemaVersion: 2,
        module: "math.js",
        filePath: "math.js",
        properties: [makeProperty()],
        sourceHash: "abc",
        inferredAt: "2026-03-30T00:00:00.000Z",
      });

      const exitCode = await withInterceptedExit(async () => {
        await propertyCommand("math.js", "prop_999", {});
      });

      assert.equal(exitCode, 2);
    });
  });

  it("propcheck infer --function should filter to a single function", async () => {
    await withTempProject(async (projectDir) => {
      const source = [
        "export function add(a: number, b: number): number { return a + b; }",
        "",
        "export function multiply(a: number, b: number): number { return a * b; }",
        "",
      ].join("\n");
      await fs.writeFile(path.join(projectDir, "math.ts"), source, "utf8");

      await inferCommand("math.ts", { mock: true, function: "add", skipValidation: true });

      const store = JSON.parse(await fs.readFile(path.join(projectDir, ".propcheck", "properties.json"), "utf8")) as {
        modules: Record<string, PropertySet>;
      };

      assert.ok(store.modules["math.ts"]);
      const props = store.modules["math.ts"].properties;
      assert.ok(props.length >= 1);
      // All inferred properties should target "add", not "multiply"
      for (const p of props) {
        assert.equal(p.targetFunction, "add");
      }
    });
  });

  it("propcheck infer --function should accept comma-separated names", async () => {
    await withTempProject(async (projectDir) => {
      const source = [
        "export function add(a: number, b: number): number { return a + b; }",
        "",
        "export function multiply(a: number, b: number): number { return a * b; }",
        "",
        "export function subtract(a: number, b: number): number { return a - b; }",
        "",
      ].join("\n");
      await fs.writeFile(path.join(projectDir, "math.ts"), source, "utf8");

      await inferCommand("math.ts", { mock: true, function: "add,multiply", skipValidation: true });

      const store = JSON.parse(await fs.readFile(path.join(projectDir, ".propcheck", "properties.json"), "utf8")) as {
        modules: Record<string, PropertySet>;
      };

      assert.ok(store.modules["math.ts"]);
      const targetFns = new Set(store.modules["math.ts"].properties.map((p) => p.targetFunction));
      // Should not include "subtract"
      assert.ok(!targetFns.has("subtract"));
    });
  });

  it("propcheck infer --function should exit 2 for non-existent function name", async () => {
    await withTempProject(async (projectDir) => {
      const source = [
        "export function add(a: number, b: number): number { return a + b; }",
        "",
      ].join("\n");
      await fs.writeFile(path.join(projectDir, "math.ts"), source, "utf8");

      const exitCode = await withInterceptedExit(async () => {
        await inferCommand("math.ts", { mock: true, function: "nonExistent", skipValidation: true });
      });

      assert.equal(exitCode, 2);
    });
  });

  it("propcheck infer --function should match partial qualified names", async () => {
    await withTempProject(async (projectDir) => {
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (...args: unknown[]) => {
        logs.push(args.map(String).join(" "));
      };

      try {
        const source = [
          "export class Calculator {",
          "  add(a: number, b: number): number { return a + b; }",
          "  multiply(a: number, b: number): number { return a * b; }",
          "}",
          "",
        ].join("\n");
        await fs.writeFile(path.join(projectDir, "calc.ts"), source, "utf8");

        // Use partial name "add" to match "Calculator.add"
        await inferCommand("calc.ts", { mock: true, function: "add", skipValidation: true });

        const allOutput = logs.join("\n");
        assert.ok(allOutput.includes("Analyzing 1 functions"));
      } finally {
        console.log = originalLog;
      }
    });
  });

  // ── Regression tests for bug fixes (0402 audit) ──────────────

  describe("run --only regression", () => {
    it("should exit 2 when --only filter matches no properties", async () => {
      await withTempProject(async (projectDir) => {
        await initStore(projectDir);
        const source = "exports.add = (a, b) => a + b;\n";
        await fs.writeFile(path.join(projectDir, "math.js"), source, "utf8");
        await setProperties(path.join(projectDir, ".propcheck"), "math.js", {
          schemaVersion: 2,
          module: "math.js",
          filePath: "math.js",
          properties: [makeProperty()],
          sourceHash: hashContent(source),
          inferredAt: "2026-03-30T00:00:00.000Z",
        });

        const logs: string[] = [];
        const originalLog = console.log;
        const originalError = console.error;
        console.log = (...args: unknown[]) => { logs.push(args.map(String).join(" ")); };
        console.error = (...args: unknown[]) => { logs.push(args.map(String).join(" ")); };

        try {
          const exitCode = await withInterceptedExit(async () => {
            await runCommand("math.js", { only: "nonexistent_id" });
          });
          assert.equal(exitCode, 2);
          assert.ok(logs.some((line) => line.includes("No properties matched --only filter")));
        } finally {
          console.log = originalLog;
          console.error = originalError;
        }
      });
    });
  });

  describe("run --changed regression", () => {
    it("should exit 2 when git is not available", async () => {
      await withTempProject(async (projectDir) => {
        // tmpDir is NOT a git repo
        const logs: string[] = [];
        const originalError = console.error;
        console.error = (...args: unknown[]) => { logs.push(args.map(String).join(" ")); };

        try {
          const exitCode = await withInterceptedExit(async () => {
            await runCommand(undefined, { changed: true });
          });
          assert.equal(exitCode, 2);
          assert.ok(logs.some((line) => line.includes("git is not available")));
        } finally {
          console.error = originalError;
        }
      });
    });
  });
});
