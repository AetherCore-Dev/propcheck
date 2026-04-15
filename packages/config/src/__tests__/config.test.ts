import { describe, it, beforeEach, afterEach } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { inspectConfig, loadConfig, validateConfig } from "../loader";
import { DEFAULTS } from "../defaults";

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "propcheck-config-test-"));
}

describe("loadConfig", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should return defaults when no config file exists", () => {
    const config = loadConfig(tmpDir);
    assert.equal(config.model, DEFAULTS.model);
    assert.equal(config.provider, DEFAULTS.provider);
    assert.equal(config.mock, false);
    assert.equal(config.storeDir, ".propcheck");
  });

  it("should load .propcheckrc and merge with defaults", () => {
    fs.writeFileSync(
      path.join(tmpDir, ".propcheckrc"),
      JSON.stringify({ model: "gpt-4", minScore: 8 }),
    );

    const config = loadConfig(tmpDir);
    assert.equal(config.model, "gpt-4");
    assert.equal(config.minScore, 8);
    // Other values should be defaults
    assert.equal(config.provider, DEFAULTS.provider);
  });

  it("should warn and use defaults for invalid .propcheckrc", () => {
    fs.writeFileSync(path.join(tmpDir, ".propcheckrc"), "not json");

    // Should not throw
    const config = loadConfig(tmpDir);
    assert.equal(config.model, DEFAULTS.model);
  });

  it("should warn and use defaults for .propcheckrc with invalid fields", () => {
    fs.writeFileSync(
      path.join(tmpDir, ".propcheckrc"),
      JSON.stringify({ minScore: 999 }), // Out of range (max 13)
    );

    const config = loadConfig(tmpDir);
    assert.equal(config.minScore, DEFAULTS.minScore); // Should fall back
  });

  it("should reject .propcheckrc with unknown fields (strict schema)", () => {
    fs.writeFileSync(
      path.join(tmpDir, ".propcheckrc"),
      JSON.stringify({ unknownField: "value" }),
    );

    const config = loadConfig(tmpDir);
    // strict() rejects unknown fields, so defaults apply
    assert.equal(config.model, DEFAULTS.model);
  });

  it("should apply CLI overrides over .propcheckrc", () => {
    fs.writeFileSync(
      path.join(tmpDir, ".propcheckrc"),
      JSON.stringify({ model: "from-rc" }),
    );

    const config = loadConfig(tmpDir, { model: "from-cli" });
    assert.equal(config.model, "from-cli");
  });

  it("should apply mock override", () => {
    const config = loadConfig(tmpDir, { mock: true });
    assert.equal(config.mock, true);
  });

  it("should apply provider and baseURL overrides", () => {
    const config = loadConfig(tmpDir, {
      provider: "openai-compatible",
      baseURL: "https://proxy.example.com/v1",
    });
    assert.equal(config.provider, "openai-compatible");
    assert.equal(config.baseURL, "https://proxy.example.com/v1");
  });

  it("should return a frozen config object", () => {
    const config = loadConfig(tmpDir);
    assert.ok(Object.isFrozen(config));
  });

  it("should reject storeDir with path traversal", () => {
    fs.writeFileSync(
      path.join(tmpDir, ".propcheckrc"),
      JSON.stringify({ storeDir: "../escape" }),
    );

    const config = loadConfig(tmpDir);
    // Zod regex now blocks ".." components — entire rc is rejected, fallback to defaults
    assert.equal(config.storeDir, DEFAULTS.storeDir);
  });

  it("should reject storeDir starting with dot-dot in nested path", () => {
    fs.writeFileSync(
      path.join(tmpDir, ".propcheckrc"),
      JSON.stringify({ storeDir: "ok/../escape" }),
    );

    const config = loadConfig(tmpDir);
    assert.equal(config.storeDir, DEFAULTS.storeDir);
  });

  it("should accept valid storeDir like .propcheck", () => {
    fs.writeFileSync(
      path.join(tmpDir, ".propcheckrc"),
      JSON.stringify({ storeDir: ".propcheck" }),
    );

    const config = loadConfig(tmpDir);
    assert.equal(config.storeDir, ".propcheck");
  });
});

describe("loadConfig — environment variables", () => {
  const savedEnv: Record<string, string | undefined> = {};
  const envKeys = [
    "PROPCHECK_API_KEY", "ANTHROPIC_API_KEY", "OPENAI_API_KEY",
    "PROPCHECK_MOCK", "PROPCHECK_BASE_URL", "ANTHROPIC_BASE_URL",
    "OPENAI_BASE_URL", "PROPCHECK_PROVIDER",
  ];

  beforeEach(() => {
    for (const key of envKeys) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of envKeys) {
      if (savedEnv[key] !== undefined) {
        process.env[key] = savedEnv[key];
      } else {
        delete process.env[key];
      }
    }
  });

  it("should read PROPCHECK_API_KEY", () => {
    const tmpDir = makeTmpDir();
    process.env["PROPCHECK_API_KEY"] = "sk-test-123";
    const config = loadConfig(tmpDir);
    assert.equal(config.apiKey, "sk-test-123");
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should prefer PROPCHECK_API_KEY over ANTHROPIC_API_KEY", () => {
    const tmpDir = makeTmpDir();
    process.env["PROPCHECK_API_KEY"] = "propcheck-key";
    process.env["ANTHROPIC_API_KEY"] = "anthropic-key";
    const config = loadConfig(tmpDir);
    assert.equal(config.apiKey, "propcheck-key");
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should read PROPCHECK_MOCK=true", () => {
    const tmpDir = makeTmpDir();
    process.env["PROPCHECK_MOCK"] = "true";
    const config = loadConfig(tmpDir);
    assert.equal(config.mock, true);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should auto-detect openai-compatible provider from baseURL", () => {
    const tmpDir = makeTmpDir();
    fs.writeFileSync(
      path.join(tmpDir, ".propcheckrc"),
      JSON.stringify({ baseURL: "https://openrouter.ai/api/v1" }),
    );
    const config = loadConfig(tmpDir);
    assert.equal(config.provider, "openai-compatible");
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should warn for invalid PROPCHECK_PROVIDER values", () => {
    const tmpDir = makeTmpDir();
    process.env["PROPCHECK_PROVIDER"] = "openai";
    const inspection = inspectConfig(tmpDir);
    assert.equal(inspection.config.provider, DEFAULTS.provider);
    assert.match(inspection.warnings.join("\n"), /PROPCHECK_PROVIDER has invalid value/);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should track config sources during inspection", () => {
    const tmpDir = makeTmpDir();
    process.env["PROPCHECK_API_KEY"] = "sk-test-123";
    fs.writeFileSync(
      path.join(tmpDir, ".propcheckrc"),
      JSON.stringify({ model: "gpt-4.1-mini" }),
    );

    const inspection = inspectConfig(tmpDir);
    assert.equal(inspection.fields.apiKey.source, "env");
    assert.equal(inspection.fields.model.source, "rc");
    assert.equal(inspection.fields.provider.source, "default");
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

describe("validateConfig", () => {
  it("should require API key for infer command when not mock", () => {
    const config = { ...DEFAULTS, mock: false, apiKey: null };
    const errors = validateConfig(config as any, "infer");
    assert.equal(errors.length, 1);
    assert.match(errors[0], /API key/);
  });

  it("should require API key for fix command when not mock", () => {
    const config = { ...DEFAULTS, mock: false, apiKey: null };
    const errors = validateConfig(config as any, "fix");
    assert.equal(errors.length, 1);
  });

  it("should not require API key when mock=true", () => {
    const config = { ...DEFAULTS, mock: true, apiKey: null };
    const errors = validateConfig(config as any, "infer");
    assert.equal(errors.length, 0);
  });

  it("should not require API key for run command", () => {
    const config = { ...DEFAULTS, mock: false, apiKey: null };
    const errors = validateConfig(config as any, "run");
    assert.equal(errors.length, 0);
  });

  it("should not require API key for init command", () => {
    const config = { ...DEFAULTS, mock: false, apiKey: null };
    const errors = validateConfig(config as any, "init");
    assert.equal(errors.length, 0);
  });
});
