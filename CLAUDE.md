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

## Project Status (2026-03-31)
**Phase 1 MVP: COMPLETE + Hardening pass + Property Workflow MVP landed** — real provider path passing end-to-end, with risk-aware property persistence, canary validation, execution filtering, and human-in-the-loop property management now implemented.

### What's Done
- Full CLI: `init`, `infer`, `run`, `badge`, `quality`, `props`, `property` commands
- Property workflow: `propcheck props` lists inventory, `propcheck property` inspects/updates status with `humanVerified` tracking
- Trial-run validation: infer → quick 100x run → filter false positives
- Property lifecycle metadata: `accepted` / `risky` / `refined` / `quarantined` / `dropped`
- Risk-aware persistence: `riskTags`, `riskScore`, validation evidence stored in `.propcheck/properties.json`
- Canary validation + auto-weakening for fragile numeric properties before persistence
- `--changed` mode: git diff → only test changed files
- `--quick` / `--thorough` / `--seed` / `--json` / `--skip` / `--only` / `--include-quarantined` flags
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
- Full run results: **15/15 passed** after fixing real-provider array constraint mapping in `packages/engines/src/fast-check/fc-codegen.ts`
- Root cause fixed: some providers emit array element constraints as `elementType + min/max/maxLength`; old codegen incorrectly fell back to `fc.anything()` for those arrays
- Token usage: ~5,800-6,000 tokens, ~$0.06 per file

### Mock Validation Results
- 12 functions tested across 4 fixtures (TS + Python)
- 9 properties per file, all meaningful (0 tautologies)
- 0% false positives on correct code
- Found real bugs in cart-buggy.ts (discount > 100% → negative price)
- Full E2E verified: infer --mock → trial-run → persist → run → report

### What's NOT Done (Phase 2)
- npm publish follow-up / release automation polish
- Stronger canary coverage for multi-parameter interactions
- Interactive confirmation mode for property review (`propcheck infer --confirm`)
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
node packages/cli/dist/index.js props                          # List all properties
node packages/cli/dist/index.js props --status risky           # Filter by status
node packages/cli/dist/index.js props --json                   # JSON output
node packages/cli/dist/index.js property <file> <id>           # Inspect a property
node packages/cli/dist/index.js property <file> <id> --status quarantined  # Update status

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
1. `cd packages/cli && npm publish` (version bump for new commands)
2. Improve canary coverage for multi-parameter edge interactions
3. Interactive confirmation mode (`propcheck infer --confirm`)
4. Phase 2 distribution work: PR Bot, VS Code extension
