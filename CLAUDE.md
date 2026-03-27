# propcheck — Project Memory

## What is propcheck
AI-powered Property-Based Testing CLI. LLM infers code properties → deterministic PBT engines (fast-check/Hypothesis) execute thousands of random inputs → find bugs your tests miss.

## Tech Stack
- TypeScript monorepo (npm workspaces, 8 packages, CJS output)
- Parser: TypeScript Compiler API (NOT tree-sitter)
- LLM: Anthropic Claude API (BYOK) + mock client for offline
- Engines: fast-check (TS/JS), Hypothesis (Python)
- CLI: commander.js + chalk v4
- Test runner: Node.js `--experimental-strip-types` for direct .ts import

## Project Status (2026-03-27)
**Phase 1 MVP: COMPLETE** — 52 files, 4,881 lines, 50 tests all passing.

### Validation Results (Opus-quality mock)
- 12 functions tested across 4 fixtures (TS + Python)
- 32 properties generated, **100% meaningful** (0 tautologies)
- **0% false positives** on correct code
- **Found real bugs** in cart-buggy.ts (discount range)
- 3 codegen bugs found (zero-param assertions) — needs fix

### What's NOT Done
- npm publish (tsup bundling not done)
- gh auth + GitHub push
- Real Anthropic API test (CodeBuddy key doesn't work directly)
- Codegen: zero-parameter assertion support
- Codegen: array literal in assertion (`[price]`)
- Trial-run validation (infer → quick run → filter false positives)
- Self-repair (3-round compile-error fix loop)
- `--changed` mode (git diff → only test changed functions)

## Key Architecture Decisions
1. TypeScript Compiler API over tree-sitter WASM (simpler, better types)
2. CJS output for CLI compatibility (not ESM)
3. `--experimental-strip-types` to run generated tests against .ts source
4. Mock client matches by `### funcName` prompt headings
5. Properties persisted in `.propcheck/properties.json` (infer once, run free)
6. Scoring: 15-point rubric with tautology/redundancy/triviality checks

## Commands
```bash
npx tsc --build                          # Build all packages
node packages/cli/dist/index.js --help   # CLI help
node packages/cli/dist/index.js init     # Create .propcheck/
node packages/cli/dist/index.js infer --mock <file>  # Infer with mock
node packages/cli/dist/index.js run <file>           # Run properties
node packages/cli/dist/index.js run --quick <file>   # 100 iterations
node packages/cli/dist/index.js run --json <file>    # JSON output
node packages/cli/dist/index.js badge                # README badge

# Run unit tests
for pkg in parser store llm engines; do
  cd packages/$pkg && node --test dist/**/*.test.js && cd ../..
done
```

## Next Priority: Fix codegen bugs → Trial-run validation pipeline
See research repo: `../ai-code-trust-research/plans/propcheck-blueprint.md`
