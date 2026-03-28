# propcheck — Project Memory

## What is propcheck
AI-powered Property-Based Testing CLI. LLM infers code properties → deterministic PBT engines (fast-check/Hypothesis) execute thousands of random inputs → find bugs your tests miss.

## Tech Stack
- TypeScript monorepo (npm workspaces, 8 packages, CJS output)
- Parser: TypeScript Compiler API (NOT tree-sitter)
- LLM: Anthropic Claude API (BYOK) + mock client for offline
- Engines: fast-check (TS/JS), Hypothesis (Python)
- CLI: commander.js + chalk v4
- Bundler: tsup (144KB single-file bundle, 73KB compressed)
- Test runner: Node.js `--experimental-strip-types` for direct .ts import

## Project Status (2026-03-27)
**Phase 1 MVP: COMPLETE + npm-ready** — 52 files, 4,881 lines, 50 tests all passing.

### What's Done
- Full CLI: `init`, `infer`, `run`, `badge` commands
- Trial-run validation: infer → quick 100x run → filter false positives
- `--changed` mode: git diff → only test changed files
- `--quick` / `--thorough` / `--seed` / `--json` flags
- tsup bundling: 144KB single-file, 73KB npm package
- Multi-language: TypeScript/JavaScript (fast-check) + Python (Hypothesis)
- GitHub Action (composite action in .github/actions/propcheck/)
- CI workflow (3 platforms × 3 Node versions)

### Validation Results (Opus-quality mock)
- 12 functions tested across 4 fixtures (TS + Python)
- 9 properties per file, all meaningful (0 tautologies)
- 0% false positives on correct code
- Found real bugs in cart-buggy.ts (discount > 100% → negative price)
- Full E2E verified: infer --mock → trial-run → persist → run → report

### What's NOT Done (Phase 2)
- gh auth + GitHub push (need user to authenticate)
- npm publish (package ready, needs `npm publish` from cli/)
- Real Anthropic API validation (mock covers quality, real API untested)
- Self-repair (3-round compile-error fix loop — needs real LLM)
- Refinement loop (FUEL-style: infer → run → analyze → re-infer)
- VS Code extension
- Community property templates
- Mutation testing `propcheck quality`

## Key Architecture Decisions
1. TypeScript Compiler API over tree-sitter WASM (simpler, better types)
2. CJS output for CLI compatibility (not ESM)
3. `--experimental-strip-types` to run generated tests against .ts source
4. Mock client matches by `### funcName` prompt headings
5. Properties persisted in `.propcheck/properties.json` (infer once, run free)
6. Scoring: 13-point rubric with tautology/redundancy/triviality checks
7. tsup bundles all workspace packages; external: chalk, commander, zod, @anthropic-ai/sdk
8. fast-check = peer dependency; typescript = optional peer dependency

## Commands
```bash
# Build + bundle
npx tsc --build                                    # Build all packages
cd packages/cli && npx tsup                        # Bundle for distribution

# CLI (dev mode — from tsc output)
node packages/cli/dist/index.js --help
node packages/cli/dist/index.js init
node packages/cli/dist/index.js infer --mock <file>
node packages/cli/dist/index.js run <file>
node packages/cli/dist/index.js run --changed
node packages/cli/dist/index.js run --quick <file>
node packages/cli/dist/index.js run --json <file>
node packages/cli/dist/index.js badge

# CLI (bundled — same commands via dist-bundle)
node packages/cli/dist-bundle/index.js --help

# Run unit tests
for pkg in parser store llm engines; do
  cd packages/$pkg && node --test dist/**/*.test.js && cd ../..
done

# npm publish (when ready)
cd packages/cli && npm publish
```

## Next Priority
1. `gh auth login` + `gh repo create propcheck --public`
2. `cd packages/cli && npm publish`
3. Real Anthropic API test with ANTHROPIC_API_KEY
4. Phase 2: refinement loop, self-repair, VS Code extension

See research: `../ai-code-trust-research/plans/propcheck-blueprint.md`
