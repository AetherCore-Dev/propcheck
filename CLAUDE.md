# propcheck — Project Memory

## What is propcheck
AI-powered testing tool. AI reads your code once → discovers rules that should always be true → deterministic engines (fast-check/Hypothesis) throw thousands of random inputs at those rules → finds bugs your tests miss.

## Tech Stack
- TypeScript monorepo (npm workspaces, 8 packages, CJS output)
- Parser: TypeScript Compiler API (NOT tree-sitter)
- LLM: Anthropic Claude API (BYOK) + mock client for offline
- Engines: fast-check (TS/JS), Hypothesis (Python)
- CLI: commander.js + chalk v4
- Bundler: tsup (~320KB single-file bundle)
- Test runner: Node.js `--experimental-strip-types` for direct .ts import

## Project Status (2026-04-09)
**Phase 1 MVP: COMPLETE + Production Hardening** — full CLI pipeline verified end-to-end across CJS/ESM/no-type project configurations. 400 unit tests, 0 failures. All identified security/UX/coverage issues resolved (13/13 from 4-agent review). Adaptive mock generator enables `--mock` mode for any user code. Node 18/20/22+ cross-version compatibility. npm 0.4.4 published.

### What's Done
- Full CLI: `init`, `infer`, `run`, `badge`, `quality`, `props`, `property`, `fix` commands
- **Adaptive mock generator**: `--mock` mode generates meaningful properties for ANY function (not just hardcoded demos) via FunctionSignature analysis — 3-tier param→generator mapping, signal-based category selection, template-based assertion synthesis
- **`propcheck init` auto-setup**: creates `.propcheck/`, auto-configures `.gitignore`, shows actionable next steps
- **`propcheck fix`**: dual-agent auto-fix — diagnose violations (Tester Agent) → generate minimal fix (Generator Agent) → verify all properties pass
- **`propcheck infer --confirm`**: interactive review — accept/quarantine/drop each property before saving
- Property workflow: `propcheck props` lists inventory with status descriptions, `propcheck property` inspects/updates status with `humanVerified` tracking
- Trial-run validation: infer → quick 100x run → filter false positives
- Property lifecycle metadata: `accepted` / `risky` / `refined` / `quarantined` / `dropped`
- Risk-aware persistence: `riskTags`, `riskScore`, validation evidence stored in `.propcheck/properties.json`
- Canary validation + auto-weakening for fragile numeric properties before persistence
- `--changed` mode: git diff → only test changed source files (filters internal/build artifacts)
- `--quick` / `--thorough` / `--seed` / `--json` / `--skip` / `--only` / `--include-quarantined` / `--function` / `--ignore-stale` / `--confirm` flags
- tsup bundling: ~320KB single-file bundle
- Multi-language: TypeScript/JavaScript (fast-check) + Python (Hypothesis)
- Multi-provider: Anthropic direct API + OpenAI-compatible (OpenRouter, one-api, etc.)
- GitHub Action (composite action in .github/actions/propcheck/)
- CI workflow (3 platforms × 3 Node versions)
- Security hardening: assertion sanitizer, subprocess env isolation, path traversal protection, Zod config validation, API key redaction, import path escaping
- Mutation testing: `propcheck quality` command scaffolded
- GitHub repo: pushed to AetherCore-Dev/propcheck

### 0402 Audit Results
**Bugs found and fixed (6):**
1. `--only` filter: exit 0 on typo → now exit 2 with clear error
2. `--changed` mode: silent success when git unavailable → now exit 2 with git error
3. `fix` command: null pointer on verification failure → null guard added
4. `fix` command: predictable temp file names → random suffix for parallel safety
5. `fix --property`: misleading "all pass" for nonexistent ID → explicit "not found" error
6. `storeDir` path traversal: regex allowed `..` components → blocked with stricter regex

### 0403 UX Audit Results
**Issues found and fixed (8) from deep user experience testing:**
1. C1: `infer`/`fix` file-not-found masked by API key error → file check now runs first
2. C2: `run` didn't check file existence → clear "File not found" before property lookup
3. C3: `--changed` showed internal files (.propcheck/, dist-bundle/) → filtered to source only
4. H1: run output missing property ID → `[prop_001]` now shown for easy --skip/--only
5. H3: error messages truncated before storage (.slice(0,60)) → full storage, display-only truncation
6. H4: cleanup failures silently swallowed → warnings logged for non-ENOENT errors
7. H5: `--max-properties abc` silently defaulted → explicit validation with error message
8. H5: `--max-attempts abc` silently defaulted → explicit validation with error message

### 0407 Phase 2 Polish Results
**UX improvements (8):**
1. `--function` filter error now shows full function signatures (`add(a: number, b?: number): number`)
2. `--status` filter error shows sorted options with lifecycle descriptions
3. Error messages standardized with `Error:` prefix across all commands
4. Shared `status-info.ts` eliminates status description duplication between `props` and `property`
5. File size guard moved into `resolveTarget()` (single stat call, no redundant I/O)
6. `mock-fix.ts` dead code removed (funcPattern regex that always matched "prop")
7. `fc-runner.ts` .mts cleanup errors now warn instead of silent swallow
8. `--max-attempts 0` now rejected (was silently treated as 3)

**Test coverage expansion (361 → 400 tests):**
- mock-fix: 12 tests (mockDiagnoseViolation, mockGenerateFix)
- mock-refinement: 10 tests (weak strengthening, bug_found, ID uniqueness)
- fc-runner: 5 tests (.mts lifecycle, cleanup-under-failure, path injection)
- autoWeakenProperty: +10 edge cases (string literals, nested parens, array generators, tolerance patterns)
- fc-codegen: +2 tests (block comment terminator sanitization, ESM fallback for old Node)
- process-runner: +10 tests (filterSensitiveEnv — API key, token, secret blocklist)

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

### What's NOT Done (Phase 2 Roadmap)
- PR Comment Bot (auto-comment propcheck results on PRs)
- VS Code extension
- Community property templates
- CI coverage reporting (c8/istanbul)

## Key Architecture Decisions
1. TypeScript Compiler API over tree-sitter WASM (simpler, better types)
2. CJS output for CLI compatibility (not ESM)
3. `--experimental-strip-types` (Node 22.6+) or `ts.transpileModule` fallback (Node 18/20) to run generated tests against .ts source
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
node packages/cli/dist/index.js infer --mock --confirm <file>
node packages/cli/dist/index.js run <file>
node packages/cli/dist/index.js run --changed
node packages/cli/dist/index.js run --quick <file>
node packages/cli/dist/index.js run --json <file>
node packages/cli/dist/index.js run --only prop_001,prop_002 <file>
node packages/cli/dist/index.js run --ignore-stale <file>
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

# Run unit tests (400 tests across 8 packages)
node packages/parser/dist/__tests__/parser.test.js                          # 12 tests
node packages/store/dist/__tests__/store.test.js                            # 14 tests
node packages/store/dist/__tests__/store-edge.test.js                       # 9 tests
node packages/llm/dist/__tests__/llm.test.js                               # 23 tests
node packages/llm/dist/__tests__/scoring-edge.test.js                       # 32 tests
node packages/llm/dist/__tests__/response-parser-edge.test.js               # 15 tests
node packages/llm/dist/__tests__/adaptive-generator.test.js                 # 40 tests
node packages/llm/dist/__tests__/mock-fix.test.js                           # 12 tests
node packages/llm/dist/__tests__/mock-refinement.test.js                    # 10 tests
node packages/engines/dist/__tests__/e2e.test.js                            # E2E
node packages/engines/dist/__tests__/fc-codegen.test.js                     # 31 tests
node packages/engines/dist/__tests__/hyp-codegen.test.js                    # 9 tests
node packages/engines/dist/__tests__/result-parser.test.js                  # 10 tests
node packages/engines/dist/__tests__/fc-runner.test.js                      # 5 tests
node packages/engines/dist/__tests__/process-runner.test.js                 # 10 tests
node packages/common/dist/__tests__/assertion-sanitizer.test.js             # 48 tests
node packages/common/dist/__tests__/git.test.js                             # 7 tests
node packages/config/dist/__tests__/config.test.js                          # 21 tests
node packages/reporter/dist/__tests__/reporter.test.js                      # 19 tests
node packages/cli/dist/__tests__/commands.test.js                           # 24 tests
node packages/cli/dist/__tests__/auto-weaken.test.js                        # 31 tests
node packages/cli/dist/__tests__/init.test.js                               # 4 tests
node packages/cli/dist/__tests__/confirm.test.js                            # 8 tests
node packages/cli/dist/__tests__/fix.test.js                                # 5 tests

# Record demo GIF
vhs < demo.tape

# npm publish (when ready)
cd packages/cli && npm publish
```

## Next Priority
1. PR Comment Bot
2. CI coverage reporting (c8/istanbul)
3. VS Code extension
