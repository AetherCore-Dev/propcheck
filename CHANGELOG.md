# Changelog

All notable changes to propcheck are documented in this file.

## [Unreleased]

### Known Issues (codegen layer)
- Zero-parameter assertions (`calculateTotal([]) === 0`) fail — `fc.property` requires >= 1 arbitrary
- Array literal assertions (`calculateTotal([price])`) generate invalid fast-check code
- `fc.double()` generates negative values even when business logic expects non-negative — needs `min: 0` constraint propagation

### Next: Trial-run validation pipeline
- Infer → quick run (100x) → auto-filter false positives
- 3-round self-repair for compile-failing properties
- `--changed` mode (git diff → only test changed functions)

## [0.1.0] - 2026-03-27

### Phase 1 MVP — Complete

First working version. Full `init -> infer -> run -> report` pipeline.

### Added

- **CLI**: `propcheck init`, `propcheck infer`, `propcheck run`, `propcheck badge`
- **Parser**: TypeScript Compiler API extractor (functions, types, JSDoc with @param/@returns)
- **Parser**: Python regex-based extractor (functions, type hints, docstrings)
- **LLM**: Claude API integration with BYOK (Anthropic SDK, tool_use structured output)
- **LLM**: Mock client for offline testing (`--mock` flag or `PROPCHECK_MOCK=true`)
- **LLM**: 15-point scoring rubric with tautology/redundancy/triviality detection
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
