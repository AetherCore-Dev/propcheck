/**
 * Tests for process-runner.ts — env filtering.
 */

import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import { filterSensitiveEnv } from "../shared/process-runner";

describe("filterSensitiveEnv", () => {
  it("passes through safe env vars like NODE_PATH", () => {
    const result = filterSensitiveEnv({ NODE_PATH: "/usr/lib/node", FOO: "bar" });
    assert.equal(result["NODE_PATH"], "/usr/lib/node");
    assert.equal(result["FOO"], "bar");
  });

  it("blocks PROPCHECK_API_KEY", () => {
    const result = filterSensitiveEnv({ PROPCHECK_API_KEY: "sk-secret", NODE_PATH: "/x" });
    assert.equal(result["PROPCHECK_API_KEY"], undefined);
    assert.equal(result["NODE_PATH"], "/x");
  });

  it("blocks ANTHROPIC_API_KEY", () => {
    const result = filterSensitiveEnv({ ANTHROPIC_API_KEY: "sk-ant-xxx" });
    assert.equal(result["ANTHROPIC_API_KEY"], undefined);
  });

  it("blocks OPENAI_API_KEY", () => {
    const result = filterSensitiveEnv({ OPENAI_API_KEY: "sk-xxx" });
    assert.equal(result["OPENAI_API_KEY"], undefined);
  });

  it("blocks GITHUB_TOKEN and GH_TOKEN", () => {
    const result = filterSensitiveEnv({ GITHUB_TOKEN: "ghp_xxx", GH_TOKEN: "gho_xxx" });
    assert.equal(result["GITHUB_TOKEN"], undefined);
    assert.equal(result["GH_TOKEN"], undefined);
  });

  it("blocks NPM_TOKEN", () => {
    const result = filterSensitiveEnv({ NPM_TOKEN: "npm_xxx" });
    assert.equal(result["NPM_TOKEN"], undefined);
  });

  it("blocks AWS_SECRET_ACCESS_KEY", () => {
    const result = filterSensitiveEnv({ AWS_SECRET_ACCESS_KEY: "xxx" });
    assert.equal(result["AWS_SECRET_ACCESS_KEY"], undefined);
  });

  it("blocks API_KEY and SECRET variants (case-insensitive)", () => {
    const result = filterSensitiveEnv({
      API_KEY: "key1",
      PROPCHECK_SECRET_TOKEN: "s1",
      PROPCHECK_APIKEY: "k2",
    });
    assert.equal(result["API_KEY"], undefined);
    assert.equal(result["PROPCHECK_SECRET_TOKEN"], undefined);
    assert.equal(result["PROPCHECK_APIKEY"], undefined);
  });

  it("returns empty object for empty input", () => {
    const result = filterSensitiveEnv({});
    assert.deepEqual(result, {});
  });

  it("does not mutate input", () => {
    const input = { ANTHROPIC_API_KEY: "secret", SAFE: "ok" };
    filterSensitiveEnv(input);
    assert.equal(input["ANTHROPIC_API_KEY"], "secret");
    assert.equal(input["SAFE"], "ok");
  });
});
