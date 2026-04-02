# propcheck — Project Memory

## What is propcheck
AI-powered Property-Based Testing CLI. LLM infers code properties → deterministic PBT engines (fast-check/Hypothesis) execute thousands of random inputs → find bugs your tests miss.

## Tech Stack
- TypeScript monorepo (npm workspaces, 8 packages, CJS output)
- Parser: TypeScript Compiler API (NOT tree-sitter)
- LLM: Anthropic Claude API (BYOK) + mock client for offline
- Engines: fast-check (TS/JS), Hypothesis (Python)
- CLI: commander.js + chalk v4
- Bundler: tsup (~273KB single-file bundle)
- Test runner: Node.js `--experimental-strip-types` for direct .ts import

## Project Status (2026-04-02)
**Phase 1 MVP: COMPLETE + Hardening + Property Workflow + Fix Command + 0402 Audit Pass** — full CLI pipeline verified end-to-end. 295 unit tests across all 8 packages with 0 failures. 6 bugs found and fixed in 0402 audit.

### What's Done
- Full CLI: `init`, `infer`, `run`, `badge`, `quality`, `props`, `property`, `fix` commands
- **`propcheck fix`**: dual-agent auto-fix — diagnose violations (Tester Agent) → generate minimal fix (Generator Agent) → verify all properties pass
- Property workflow: `propcheck props` lists inventory, `propcheck property` inspects/updates status with `humanVerified` tracking
- Trial-run validation: infer → quick 100x run → filter false positives
- Property lifecycle metadata: `accepted` / `risky` / `refined` / `quarantined` / `dropped`
- Risk-aware persistence: `riskTags`, `riskScore`, validation evidence stored in `.propcheck/properties.json`
- Canary validation + auto-weakening for fragile numeric properties before persistence
- `--changed` mode: git diff → only test changed files
- `--quick` / `--thorough` / `--seed` / `--json` / `--skip` / `--only` / `--include-quarantined` / `--function` flags
- tsup bundling: ~273KB single-file bundle
- Multi-language: TypeScript/JavaScript (fast-check) + Python (Hypothesis)
- Multi-provider: Anthropic direct API + OpenAI-compatible (OpenRouter, one-api, etc.)
- GitHub Action (composite action in .github/actions/propcheck/)
- CI workflow (3 platforms × 3 Node versions)
- Security hardening: assertion sanitizer, subprocess env isolation, path traversal protection, Zod config validation
- Mutation testing: `propcheck quality` command scaffolded
- GitHub repo: pushed to AetherCore-Dev/propcheck

### 0402 Audit Results
**Bugs found and fixed:**
1. `--only` filter: exit 0 on typo → now exit 2 with clear error
2. `--changed` mode: silent success when git unavailable → now exit 2 with git error
3. `fix` command: null pointer on verification failure → null guard added
4. `fix` command: predictable temp file names → random suffix for parallel safety
5. `fix --property`: misleading "all pass" for nonexistent ID → explicit "not found" error
6. `storeDir` path traversal: regex allowed `..` components → blocked with stricter regex

**Test coverage expansion (98 → 295 tests):**
- assertion-sanitizer: 48 tests (all 38 dangerous patterns + edge cases)
- config/loader: 21 tests (4-layer merge, env vars, Zod validation, path traversal)
- result-parser: 10 tests (JSON line parsing, result mapping)
- git utilities: 7 tests (error/ok status discrimination, function overlap)
- reporter: 19 tests (JSON output, formatters, workflow reporters)
- autoWeakenProperty: 12 tests (recursion guard, all risk tags, immutability)
- scoring/risk detection: 32 tests (tautology, all 7 risk tag detectors, redundancy)
- response-parser edge cases: 15 tests (injection blocking, normalization, limits)
- property-store edge cases: 9 tests (concurrent writes, legacy hydration, corruption)
- CLI regression: 2 tests (--only exit code, --changed git error)

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
- npm publish 0.3.0 (version bump for fix command + all recent features)
- Interactive confirmation mode for property review (`propcheck infer --confirm`)
- PR Comment Bot (auto-comment propcheck results on PRs)
- VS Code extension
- Community property templates
- CI coverage reporting (c8/istanbul)

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
node packages/cli/dist/index.js infer --mock --function add,multiply <file>
node packages/cli/dist/index.js run <file>
node packages/cli/dist/index.js run --changed
node packages/cli/dist/index.js run --quick <file>
node packages/cli/dist/index.js run --json <file>
node packages/cli/dist/index.js run --only prop_001,prop_002 <file>
node packages/cli/dist/index.js badge
node packages/cli/dist/index.js props                          # List all properties
node packages/cli/dist/index.js props --status risky           # Filter by status
node packages/cli/dist/index.js props --json                   # JSON output
node packages/cli/dist/index.js property <file> <id>           # Inspect a property
node packages/cli/dist/index.js property <file> <id> --status quarantined  # Update status
node packages/cli/dist/index.js fix --mock <file>              # Auto-fix violations
node packages/cli/dist/index.js fix --mock --apply <file>      # Fix and apply

# Real LLM inference (OpenAI-compatible provider)
PROPCHECK_API_KEY=sk-xxx node packages/cli/dist/index.js infer \
  --provider openai-compatible \
  --model claude-opus-4-6 \
  --base-url https://your-proxy.com/v1 \
  <file>

# CLI (bundled — same commands via dist-bundle)
node packages/cli/dist-bundle/index.js --help

# Run unit tests (295 tests across 8 packages)
node packages/parser/dist/__tests__/parser.test.js                          # 12 tests
node packages/store/dist/__tests__/store.test.js                            # 14 tests
node packages/store/dist/__tests__/store-edge.test.js                       # 9 tests
node packages/llm/dist/__tests__/llm.test.js                               # 23 tests
node packages/llm/dist/__tests__/scoring-edge.test.js                       # 32 tests
node packages/llm/dist/__tests__/response-parser-edge.test.js               # 15 tests
node packages/engines/dist/__tests__/e2e.test.js                            # E2E
node packages/engines/dist/__tests__/fc-codegen.test.js                     # 30 tests
node packages/engines/dist/__tests__/hyp-codegen.test.js                    # 9 tests
node packages/engines/dist/__tests__/result-parser.test.js                  # 10 tests
node packages/common/dist/__tests__/assertion-sanitizer.test.js             # 48 tests
node packages/common/dist/__tests__/git.test.js                             # 7 tests
node packages/config/dist/__tests__/config.test.js                          # 21 tests
node packages/reporter/dist/__tests__/reporter.test.js                      # 19 tests
node packages/cli/dist/__tests__/commands.test.js                           # 24 tests
node packages/cli/dist/__tests__/auto-weaken.test.js                        # 12 tests

# Record demo GIF
vhs < demo.tape

# npm publish (when ready)
cd packages/cli && npm publish
```

## Next Priority
1. Rebuild tsup bundle + npm publish 0.3.0 (version bump for fix command + all recent features)
2. Interactive confirmation mode (`propcheck infer --confirm`)
3. CI coverage reporting (c8/istanbul) to track actual line coverage
4. Phase 2 distribution work: PR Bot, VS Code extension
