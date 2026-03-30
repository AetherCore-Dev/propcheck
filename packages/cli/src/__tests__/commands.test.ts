import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { inferCommand } from "../commands/infer";
import { runCommand } from "../commands/run";
import { badgeCommand } from "../commands/badge";
import { initStore, setProperties } from "@propcheck/store";
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
