# propcheck — Project Memory

## What is propcheck
AI-powered Property-Based Testing CLI. LLM infers code properties → deterministic PBT engines (fast-check/Hypothesis) execute thousands of random inputs → find bugs your tests miss.

## Tech Stack
- TypeScript monorepo (npm workspaces, 8 packages, CJS output)
- Parser: TypeScript Compiler API (NOT tree-sitter)
- LLM: Anthropic Claude API (BYOK) + mock client for offline
- Engines: fast-check (TS/JS), Hypothesis (Python)
- CLI: commander.js + chalk v4
- Bundler: tsup (~180KB single-file bundle)
- Test runner: Node.js `--experimental-strip-types` for direct .ts import

## Project Status (2026-03-29)
**Phase 1 MVP: COMPLETE + Real LLM Validated** — 63 files, ~6,800 lines, 54 tests all passing.

### What's Done
- Full CLI: `init`, `infer`, `run`, `badge`, `quality` commands
- Trial-run validation: infer → quick 100x run → filter false positives
- `--changed` mode: git diff → only test changed files
- `--quick` / `--thorough` / `--seed` / `--json` flags
- tsup bundling: ~191KB single-file bundle
- Multi-language: TypeScript/JavaScript (fast-check) + Python (Hypothesis)
- Multi-provider: Anthropic direct API + OpenAI-compatible (OpenRouter, one-api, etc.)
- GitHub Action (composite action in .github/actions/propcheck/)
- CI workflow (3 platforms × 3 Node versions)
- Security hardening: assertion sanitizer, subprocess env isolation, path traversal protection, Zod config validation
- Mutation testing: `propcheck quality` command scaffolded
- GitHub repo: pushed to AetherCore-Dev/propcheck

### Real LLM Validation Results (2026-03-29, Claude Opus 4.6 via OpenAI-compatible proxy)
- 3 functions in `examples/price-utils.ts` → 15 high-quality properties inferred in a single pass
- Property categories: boundary, monotonic, equivalence, conservation, metamorphic, idempotent, type-preservation
- All 15 properties passed trial-run validation (100 iterations each)
- Full run results: 12 passed, 3 failed — remaining failures are model-side over-strong properties / floating-point edge cases, not codegen or parser bugs
- Real bug detection pipeline is working end-to-end; mock demo remains the cleanest recording path
- Token usage: ~5,800-6,000 tokens, ~$0.06 per file

### Mock Validation Results
- 12 functions tested across 4 fixtures (TS + Python)
- 9 properties per file, all meaningful (0 tautologies)
- 0% false positives on correct code
- Found real bugs in cart-buggy.ts (discount > 100% → negative price)
- Full E2E verified: infer --mock → trial-run → persist → run → report

### What's NOT Done (Phase 2)
- npm publish (package ready, needs `npm publish` from cli/)
- Self-repair with real LLM (code scaffolded, mock validated)
- Refinement loop (FUEL-style: infer → run → analyze → re-infer)
- PR Comment Bot (auto-comment propcheck results on PRs)
- VS Code extension
- Community property templates

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

# Real LLM inference (OpenAI-compatible provider)
PROPCHECK_API_KEY=sk-xxx node packages/cli/dist/index.js infer \
  --provider openai-compatible \
  --model claude-opus-4-6 \
  --base-url https://your-proxy.com/v1 \
  <file>

# CLI (bundled — same commands via dist-bundle)
node packages/cli/dist-bundle/index.js --help

# Run unit tests
for pkg in parser store llm engines; do
  cd packages/$pkg && node --test dist/**/*.test.js && cd ../..
done

# Record demo GIF
vhs < demo.tape

# npm publish (when ready)
cd packages/cli && npm publish
```

## Next Priority
1. `cd packages/cli && npm publish`
2. Phase 2: self-repair (real LLM validation), refinement loop, PR Bot, VS Code extension
