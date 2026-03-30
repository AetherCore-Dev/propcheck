# Changelog

All notable changes to propcheck are documented in this file.

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
