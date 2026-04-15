# Changelog

All notable changes to propcheck are documented in this file.

## [0.6.0] - 2026-04-15

### Added
- **CLI provider mode**: `--provider cli --cli-command codebuddy` invokes any external CLI tool as the LLM backend via stdin pipe — no API key needed. Supports any tool that accepts `-p --output-format text -` arguments.
- **Adversarial prompt engineering**: SYSTEM_PROMPT rewritten to instruct LLM to "find where the code BREAKS" — includes adversarial thinking steps, anti-patterns list (typeof, identity tautology, implementation mirroring), and boundary-pushing generator requirements.
- **Auto-refinement (Round 2)**: Automatically triggers a second LLM inference round when quality issues are detected (>30% weak properties, many filtered, or bugs found with other quality issues). Includes execution feedback summary to guide improvements.
- **Boundary expansion**: Automatically widens numeric generator ranges by 50% (minimum ±10) to discover boundary-sensitive bugs. Also expands array element constraints. Properties that fail with wider ranges are preserved as high-value findings.
- **Source-code semantic analyzer** (`source-analyzer.ts`): Lightweight regex-based function body scanner that detects 18 semantic signals (hasSort, hasHash, hasPathOps, hasSubtraction, hasDivision, etc.). Used by `isCategorySafe()` to prevent false positives from algebraic property categories.
- **Code-Derived Property Inference (CDPI)** (`code-derived-inference.ts`): Extracts provable properties directly from source code — guard clauses, return type analysis, sort/filter/reduce/clamp/toFixed patterns, and purity detection. Used as primary engine in mock mode.
- **Quality gate enhancements**: New `isIdentityTautology()` detects `f(x) === f(x)` patterns (direct and IIFE-wrapped). New `isTypeofTrivial()` detects typeof-only assertions while allowing compound expressions.
- **SeedInput label normalization**: LLM-generated labels like "empty string", "unicode", "max_value" are now automatically normalized to the `normal`/`boundary`/`extreme` enum.

### Fixed
- **CDPI boolean identity tautology**: CDPI was generating `f(x) === f(x)` for boolean pure functions — exactly the pattern the scoring penalizes. Changed to variable-based determinism check: `const r1 = f(x); const r2 = f(x); return r1 === r2`.
- **`extractFunctionBody` brace matching**: Brace depth counting now skips `{}`/`}` inside string literals, template literals, single-line comments (`//`), and block comments (`/* */`). Previously, a string like `"hello { world }"` would cause premature body truncation.
- **`extractGuards` nested parentheses**: Guard condition extraction now uses depth-aware parenthesis matching instead of `[^)]+` regex. Previously, conditions like `if (x > 0 && fn(y))` were truncated at the inner `)`.
- **`shouldAutoRefine` over-trigger**: Previously triggered Round 2 on ANY bug found, even when all other properties were strong. Now only triggers when bugs co-occur with weak/failed properties.
- **Auto-refinement classification mismatch**: The inline IIFE in `infer.ts` now builds classifications that properly match `shouldAutoRefine`'s expected shape (was producing only "weak"/"strong" kinds, missing "bug_found"/"failed").
- **`buildFeedbackSummary` missing options**: `FeedbackOptions` (filteredCount, boundaryFailures) are now passed through from `runValidationPipeline` to `runRefinementLoop`, improving Round 2 prompt quality.
- **CLI prompt discarding system prompt**: `buildTextPrompt` in cli-client.ts now includes the full SYSTEM_PROMPT (adversarial framing, categories, anti-patterns, rules) instead of a simplified 4-line substitute.
- **SeedInput label "max" conflict**: "max" was matched by both "boundary" and "extreme" conditions. Fixed by checking extreme patterns first.
- **`hasConservativeRanges` too narrow**: Now detects more common documented-range patterns including `[0,255]`, `[0,360]`, `[-100,100]`, `[1,N]`, and symmetric ranges.
- **Boundary expansion misses array elements**: `expandGeneratorRanges` now also expands numeric constraints inside `array` generator `elementConstraints`.
- **Dead code**: Removed unused `runCliProcess` function from cli-client.ts.
- **Mock false positive rate (43%)**: Root cause was adaptive generator blindly generating idempotent/commutative/monotonic properties. Fixed with source-analyzer semantic guards + CDPI as primary engine.
- **EngineError crash**: Added try-catch in `run.ts` and `validation.ts` for graceful EngineError handling.
- **Counterexample display showing `(...)`**: Fixed regex and added direct `e.counterexample` access.
- **"Dropped unsafe property" noise**: Consolidated individual warnings into single summary count.

### Changed
- Mock client pipeline: 4-layer architecture — (0) cross-function detection always runs, (1) CDPI primary, (2) templates supplement if < 3, (3) adaptive generator fallback if < 2.
- Scoring rubric: max score remains 13 points, but tautology detection now covers identity patterns and typeof-only trivial detection is more precise.
- Config: `PropcheckConfig.provider` union extended with `"cli"`; added `cliCommand` and `cliArgs` fields.
- E2E smoke test timeout increased from 60s to 120s (CDPI generates more properties).

## [0.5.0] - 2026-04-09

### Added
- **`propcheck check` command**: one-command experience — auto init + infer --mock + run. Lowest-friction entry point for new users (`propcheck check src/file.ts`)
- **Multi-file run summary**: when testing multiple files, a final `Total: X files | Y properties | Z passed | W failed` line is printed
- **Property ID sorting**: properties now display in consistent ID order (prop_001, prop_002, ...) instead of arbitrary validation order
- **E2E smoke tests**: 4 end-to-end tests verify full `infer --mock → run` pipeline, `run --json`, and `check` command
- **fast-check startup detection**: CLI now checks for fast-check at startup with clear install instructions (matches existing TypeScript check)
- **Two-param math templates**: new `math-2param` domain correctly handles functions like `calculateTax(price, rate)` with all parameters

### Fixed
- **False positive: multi-param math functions** — math template used `{fn}({p0})` dropping extra params; `calculateTax(price, rate)` was called as `calculateTax(price)` causing `rate=undefined → NaN → FAIL`. Fixed with `maxParams` constraint on single-param math domain and new 2-param domain
- **Trivial `typeof` assertions pass scoring** — `typeof x === "number"` was not detected as trivial because the check required absence of `===`. New regex `^typeof\s+.+\s*[!=]==\s*["'][a-z]+["']\s*$` correctly catches pure typeof assertions while allowing compound expressions
- **Adaptive generator `typeof` pollution** — `buildBoundaryProperty` and `buildTypePreservationProperty` generated `typeof fn(x) === "string"` / `"boolean"`. Replaced with meaningful assertions: `.length >= 0` for strings, `=== self` for booleans, `Number.isFinite()` for numbers
- **Validation templates low quality** — replaced `typeof {fn}({p0}) === 'boolean'` with determinism, empty-string rejection, and complement-set distinguishability properties
- **Idempotent assertion missing params** — `buildIdempotentProperty` generated `clamp(clamp(value))` instead of `clamp(clamp(value, min, max), min, max)`. Now passes all parameters via `buildCallExpr`
- **`check` command init noise** — `check` printed full `initCommand()` output including "Next steps: propcheck infer..." hints. Now uses `initStore()` directly for silent initialization

## [0.4.3] - 2026-04-08

### Added
- **`propcheck templates` command**: list all 10 community property template domains (18 templates total) with `--json` support
- **PR Comment Bot**: GitHub Action (`.github/actions/propcheck-comment/`) auto-posts property test results on PRs — validated on PR #1
- **Community property templates**: 10 domains (sorting, formatting, validation, clamping, math, filtering, string-transform, parsing, mapping, deduplicate) auto-matched in `--mock` mode
- **15 template tests**: domain matching, instantiation, generator/seed resolution, edge cases

### Security
- **Comment injection prevention**: `toSafeComment()` now strips `*/` (JS) and `"""` (Python) to prevent breakout
- **Subprocess env isolation**: `filterSensitiveEnv()` blocks 10 sensitive key patterns (API keys, tokens, secrets) from test subprocesses
- **PR Action hardening**: `node -e` uses `process.env` instead of shell-interpolated paths; `fail-on-violation` uses proper string comparison

### Fixed
- **Null dereference**: `fix` command verification result now has null guard
- **Unsafe assertion**: `config.apiKey!` replaced with safe ternary
- **Immutability violation**: `padToMinimumProperties` returns new array instead of mutating
- **Score cap**: mock-refinement capped at 13 (was incorrectly 15)
- **Validation timing**: `--max-attempts` validated before expensive LLM calls

## [0.4.2] - 2026-04-07

### Improved
- **`--function` error messages**: now show full function signatures (`add(a: number, b?: number): number`) instead of bare names
- **`--status` validation errors**: show sorted lifecycle options with descriptions (e.g. `accepted — Verified and active`)
- **Error message consistency**: all commands now use standardized `Error:` prefix formatting
- **Shared status definitions**: extracted `status-info.ts` — single source of truth for `props` and `property` commands
- **File size guard placement**: moved into `resolveTarget()` to use existing `stat` call (no redundant I/O)

### Fixed
- **`--max-attempts 0` silently defaulted to 3**: now properly rejected with `"must be an integer (1-5)"` error
- **`mock-fix.ts` dead code**: removed `funcPattern` regex that always matched `"prop"` instead of the actual function name
- **`fc-runner.ts` silent cleanup**: `.mts` cleanup errors now emit warnings (consistent with `fix.ts` pattern)
- **`formatFunctionSignature` optional marker**: `?` now placed correctly before type (`name?: type` not `name: type?`)

### Added
- **37 new tests**: mock-fix (12), mock-refinement (10), fc-runner lifecycle (5), auto-weaken edge cases (10)

## [0.4.1] - 2026-04-07

### Security
- **API key redaction**: error messages now strip Bearer tokens, `sk-*` keys, and `key=` params before display — prevents accidental key leakage in logs/terminals
- **Import path escaping**: `importPathStr` in generated test files now uses `JSON.stringify` — prevents code injection via filenames containing quotes
- **Fix command hardening**: source file size check (500KB limit) before LLM call; LLM response size limit (1MB); `.bak` backup before `--apply` (timestamped to prevent overwrite)
- **Config security**: removed `apiKey` from `.propcheckrc` schema — keys must use env vars to prevent accidental git commits

### Fixed
- **Python yield detection**: `isGenerator` now correctly detects `yield` in function bodies while excluding nested `def` blocks
- **Numeric option validation**: `--max-properties 5abc` now properly rejected (was silently parsed as 5)
- **Exit code consistency**: `run --changed` with no properties now exits 2 (was 0, misleading CI)
- **Stale file warning**: shows `--ignore-stale` hint; new `--ignore-stale` flag to suppress

### Added
- **`--ignore-stale` flag**: suppress stale source file warnings in `run` command
- **Mock + API key warning**: `--mock` mode now notes when a real API key is set but unused
- **Exit codes in help**: `propcheck --help` now documents exit codes 0/1/2
- **Init directory descriptions**: `propcheck init` output explains each directory's purpose
- **JSON schema documentation**: `docs/tutorial.md` now includes full JSON output schema for CI integration
- **26 new tests**: fix command E2E (5), weakening metadata (9), init .gitignore (4), confirm interactive (8)

## [0.4.0] - 2026-04-07

### Added
- **Adaptive mock property generator**: `--mock` mode now generates meaningful properties for ANY function, not just the ~11 hardcoded demo functions. Uses function signature analysis (param types, return type, function name) to select appropriate property categories and generate assertions that score ≥ 10/13 on the quality rubric. This was the #1 adoption blocker — new users running `propcheck infer --mock myFile.ts` no longer see "No properties inferred".
- **Auto-configure .gitignore**: `propcheck init` now automatically adds `.propcheck/tests/`, `.propcheck/corpus/`, and `.propcheck/reports/` to `.gitignore` (idempotent — won't duplicate entries).
- **Improved init next steps**: `propcheck init` output now shows 3 actionable commands (mock demo, real AI, run tests) instead of a generic "run infer" message.
- **`propcheck infer --confirm`**: interactive confirmation mode — review each discovered property before saving. Accept, quarantine, or drop individual rules. Supports: `a` (accept), `q` (quarantine), `d` (drop), `A` (accept all remaining), `Q` (quit). Gracefully skips in non-TTY environments (CI/piped input).
- **Tutorial**: `docs/tutorial.md` — step-by-step guide from install to CI integration.
- **Real API validation script**: `scripts/validate-real-api.sh` for end-to-end testing with a real LLM provider.
- **40 new tests**: comprehensive adaptive generator test suite (generator mapping, category selection, property building, scoring integration, prompt parsing, edge cases).

### Fixed
- Mock client no longer returns a tautology fallback (`typeof result !== 'undefined'`) for unknown functions — this always scored 7/13 and was filtered out, silently producing zero results.

## [Unreleased] - 2026-04-06

### Added
- **`propcheck fix` command**: dual-agent auto-fix for property violations — Tester Agent diagnoses each failure (real bug vs false positive), Generator Agent produces minimal source fix, verification loop re-runs all properties against fixed code
- **`--function` flag for targeted inference**: `propcheck infer --function parseAmount,buildAuth src/protocol.ts` restricts inference to named functions
- **Custom object/optional/enum generators**: structured `fc.record()`, `fc.option()`, `fc.constantFrom()` codegen from LLM specs
- **ESM `.cjs` compatibility**: generated fast-check test files use `.fc.cjs` extension in `"type": "module"` projects
- **Property ID in run output**: `✓ [prop_002] applyDiscount: ...` — enables easy copy-paste to `--skip`/`--only`
- **`--no-color` flag**: global flag to disable ANSI colors for CI log readability
- **Next-step hints**: run output now shows actionable suggestions when rules fail (fix, skip, quarantine)

### Improved (0403 UX Polish — 3 rounds)
- **README restructured**: collapsed details, Quick Start is first section, first screen is clean (hook → try → how → CI)
- **Zero-jargon output**: "properties" → "rules", "Inferred" → "Discovered", "Self-repaired" → "Fixed ... too strict", "trial run" → "quick test", "Tokens:" → "AI usage:"
- **Human-friendly risk tags everywhere**: `risk:float_exact_equality` → `(float ===)` across run, props, property detail
- **Score display**: `score: 11/13` → `★ 11/13` with color coding (green/yellow/red)
- **Removed [MOCK] debug output** from mock client
- **VHS demo rewritten**: 4-scene narrative (tests pass → discover → reveal → CTA), removed source code view and title card, added call-to-action ending
- **CLI help rewritten**: all command descriptions and option text in user-first language

### Fixed (0405 Compatibility — 3 critical + 4 code quality)
- **P0: CJS+TS project support**: `"type": "commonjs"` projects (Node 24 default) now work — codegen generates ESM `.mjs` test files that import `.mts` copies of target files
- **P1: Missing typescript crash**: friendly "npm install typescript" error instead of MODULE_NOT_FOUND crash
- **P3: Directory scanning**: `propcheck run src/` and `propcheck infer src/` recursively scan for source files
- **M2: Deep equality**: replaced `JSON.stringify` comparison with proper `deepEqual()` utility
- **M3: Type guard**: added `isSupportedLanguage()` type guard, eliminated all `as TrialRunLanguage` casts
- **M4: Dedup mkdir**: extracted `ensureTestsDir()` helper, removed 3 duplicate patterns
- **P6: infer.ts split**: 1175 → 530 lines — extracted `infer/weakening.ts` (183 lines) and `infer/validation.ts` (303 lines)
- **Node 18 compat**: ESM test files use `fileURLToPath(import.meta.url)` instead of `import.meta.dirname` (Node 21+)

### Fixed (0402 Audit — 6 bugs)
- **`--only` filter silent success**: `propcheck run --only typo_id` now exits 2 with clear error instead of silent exit 0 — prevents CI false green
- **`--changed` mode git failure**: `propcheck run --changed` in non-git directories now exits 2 with explicit error instead of reporting "no changes detected"
- **`fix` command null pointer**: verification result null guard prevents crash when test file generation fails mid-attempt
- **`fix` command temp file collision**: parallel `propcheck fix` on same file no longer overwrites each other's temp files (random suffix added)
- **`fix --property` misleading message**: nonexistent property ID now shows "not found" with available IDs instead of "all properties pass"
- **`storeDir` path traversal (security)**: `.propcheckrc` `storeDir: "../escape"` was accepted by regex — now blocked by requiring non-dot first character in each path segment

### Fixed (0403 UX Audit — 8 issues)
- **File-not-found masked by API key error**: `infer`/`fix` commands now check file existence BEFORE config validation — users see "File not found" instead of misleading "API key required"
- **`run` missing file check**: `propcheck run typo.ts` now shows "File not found" instead of "No properties found" → eliminates confusing debug loop
- **`--changed` shows internal files**: `.propcheck/`, `node_modules/`, `dist/`, `dist-bundle/` and non-source extensions now filtered from changed file list
- **Error messages truncated in storage**: `.slice(0, 60)` removed from stored error reasons — full messages preserved in `properties.json`, truncation only in display layer
- **Cleanup failures silently swallowed**: temp file `unlink` errors now logged as warnings (except expected ENOENT)
- **CLI numeric args silently defaulting**: `--max-properties`, `--min-score`, `--max-attempts` now reject non-numeric input with clear error instead of silently using defaults

### Changed
- **Assertion qualifier codegen**: method calls and JS globals no longer incorrectly prefixed with `target.`
- **Array `items` generator mapping**: both `elementType` and `items: { type, constraints }` formats now produce correctly typed fast-check generators
- Test suite expanded from 98 → **295 tests** across all 8 packages (3x increase)
- New test suites: assertion-sanitizer (48), config/loader (21), result-parser (10), git utilities (7), reporter (19), autoWeakenProperty (12), scoring edge cases (32), response-parser edge cases (15), store edge cases (9), CLI regression (2)
- `getChangedFiles()` now returns `{ status, files }` discriminated union instead of bare array — callers can distinguish "no changes" from "git error"
- tsup bundle size: ~191KB → ~273KB (includes fix command + new generators)

## [Unreleased] - 2026-03-30

### Added
- **Property lifecycle metadata**: persisted `status`, `riskTags`, `riskScore`, and validation evidence on every stored property
- **Canary validation + auto-weakening**: risky properties now run through targeted canary inputs before persistence and can be auto-refined instead of immediately becoming noisy failures
- **Run observability**: JSON and CLI summaries now report skipped properties explicitly, including `quarantined`, `dropped`, and CLI-filtered entries

### Fixed
- **Tiny tolerance weakening**: brittle numeric assertions like `Math.abs(a - b) < 1e-9` now weaken into stable `approxEqual(...)` checks instead of preserving the original ultra-small threshold
- **Risk-tag false positives**: `approxEqual(...)` assertions are no longer re-tagged as `float_exact_equality`
- **Legacy store migration**: old `properties.json` files missing `riskScore` now recompute it from persisted `riskTags`
- **Future schema protection**: the store rejects unsupported future `properties.json` versions instead of silently normalizing them
- **Dropped-property execution**: `propcheck run` now skips `dropped` properties consistently

### Changed
- README, CLI README, release notes, and project memory now document the property lifecycle model and new execution controls
- `propcheck run --json` output now distinguishes executed vs skipped properties for CI consumers

## [0.2.0] - 2026-03-29

### Added
- **tsup bundling**: single-file ~191KB CLI bundle
- **`--changed` mode**: `propcheck run --changed` only tests properties for git-changed files
- **Trial-run validation**: infer → quick 100x run → auto-filter false positives before persisting
- **CLI regression tests**: coverage for Python infer validation, empty-run exit behavior, and badge output
- npm-ready `package.json` with peer dependencies (fast-check, typescript)

### Fixed (codegen + validation hardening — 2026-03-29/30)
- **Assertion qualifier bug**: method calls (`.test(`, `.every(`, `.abs(`) and JS globals (`parseFloat`, `parseInt`) were incorrectly rewritten as `target.method(` — used negative lookbehind `(?<!\\.)` and expanded builtin allowlist to fix
- **`implies` keyword**: real LLMs produce `A implies B` in assertions; codegen now normalizes to `!(A) || (B)` (valid JS logical implication)
- **String-format generators**: real LLMs return generators as `"float(0, 10000)"` strings instead of structured objects; added `parseStringGenerator()` normalizer in response-parser to handle both formats
- **LLM error handling**: API errors (401, network failures) now show user-friendly messages instead of raw stack traces
- **Real-provider array constraints**: `fc-codegen.ts` now treats array constraints like `{ elementType: "float", min, max, maxLength }` as constrained element generators instead of falling back to `fc.anything()`
- **Over-strong property scoring**: fragile float assertions now receive score penalties before persistence (tiny tolerances, exact float equality, brittle parse/format roundtrips)
- Zero-parameter assertions now use `fc.constant(null)` dummy arbitrary instead of fragile boolean check
- Array literal assertions (`calculateTotal([price])`) verified working — `[price]` is valid JS in lambda scope
- `fc.double()` defaults to `min: 0, noDefaultInfinity: true` for unconstrained generators — prevents false failures on non-negative business logic
- Added `noDefaultInfinity: true` to all double generators
- **Python validation gap**: Python properties now go through the same trial-run validation path instead of being persisted unchecked
- **Hypothesis assertion translation**: JS-style assertions are now normalized for Python (`===`, `!==`, `&&`, `||`, `!`, `.length`, `Math.abs`, `parseFloat`, `parseInt`)
- **Refinement loop**: `--refine` now uses execution feedback to generate stronger properties instead of re-running the original inference prompt

### Changed
- VHS demo.tape: added opening title card, increased font to 18px, taller window (700px), disabled cursor blink, suppressed Node.js warnings
- README / CLI README / release notes: synchronized feature status for self-repair, refinement, Python validation, and npm publishing
- Real validation status: `examples/price-utils.ts` now passes **15/15** inferred properties end-to-end with Claude Opus 4.6 via an OpenAI-compatible proxy
- npm package: published `propcheck@0.2.0` to npmjs.org

### Next
- Trusted Publishing / release automation
- VS Code extension
- PR Bot polish and Rust/Go support

## [0.1.0] - 2026-03-27

### Phase 1 MVP — Complete

First working version. Full `init -> infer -> run -> report` pipeline.

### Added

- **CLI**: `propcheck init`, `propcheck infer`, `propcheck run`, `propcheck badge`
- **Parser**: TypeScript Compiler API extractor (functions, types, JSDoc with @param/@returns)
- **Parser**: Python regex-based extractor (functions, type hints, docstrings)
- **LLM**: Claude API integration with BYOK (Anthropic SDK, tool_use structured output)
- **LLM**: Mock client for offline testing (`--mock` flag or `PROPCHECK_MOCK=true`)
- **LLM**: 13-point scoring rubric with tautology/redundancy/triviality detection
- **LLM**: Co-generation prompt (properties + seed inputs simultaneously)
- **Engines**: fast-check adapter (codegen + Node.js runner + counterexample parsing)
- **Engines**: Hypothesis adapter (codegen + pytest runner)
- **Store**: `.propcheck/properties.json` persistence with atomic writes
- **Store**: Source hash staleness detection
- **Store**: Corpus store for seed input caching
- **Reporter**: Colored terminal output (chalk v4)
- **Reporter**: JSON output for CI (`--json`)
- **Reporter**: Counterexample display with shrink steps and reproduction seed
- **Run modes**: `--quick` (100x), default (1000x), `--thorough` (10000x), `--seed`
- **Badge**: `propcheck badge` generates shields.io markdown snippet
- **CI**: GitHub Actions workflow (Node 18/20/22, Windows/macOS/Linux)
- **CI**: Composite GitHub Action for users (`.github/actions/propcheck/`)
- **Docs**: README with quick start, architecture, research foundation

### Fixed

- JSDoc extraction: file-level comments no longer attached to first function (line proximity heuristic)
- TS import resolution: generated tests use `--experimental-strip-types` + `.ts` extension
- Mock client: precise matching by `### funcName` heading instead of loose substring
- Shell deprecation: `spawn()` with `shell: false` eliminates DEP0190 warning
- Prompt quality: source code + @param/@returns/@throws tags included in LLM context

### Architecture

```
propcheck (8 packages, 52 files, 4,881 lines TypeScript)
  @propcheck/common    — shared types, errors, utilities
  @propcheck/config    — layered config loader (env > file > defaults)
  @propcheck/parser    — TS Compiler API + Python regex extraction
  @propcheck/store     — .propcheck/ directory persistence
  @propcheck/llm       — Claude API client + mock + scoring
  @propcheck/engines   — fast-check + Hypothesis adapters
  @propcheck/reporter  — CLI colored output + JSON
  propcheck (cli)      — commander.js CLI entry point
```

### Test Results

- 50 unit tests: 12 parser + 12 store + 11 llm + 15 engines — all passing
- E2E verified on 4 test fixtures:
  - `cart-buggy.ts`: 2 bugs found (discount > 100%, negative discount) ✓
  - `sort-utils.ts`: 3/3 properties pass (correct code, no false positives) ✓
  - `string-utils.ts`: 2/2 properties pass ✓
  - `calculator.py`: 2/2 properties pass via Hypothesis ✓
