<div align="center">

# propcheck

**Your tests pass. Your coverage is 100%. Your code has bugs.**

propcheck finds them.

[![npm](https://img.shields.io/npm/v/propcheck?style=flat-square&color=cb3837)](https://www.npmjs.com/package/propcheck)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/AetherCore-Dev/propcheck?style=flat-square)](https://github.com/AetherCore-Dev/propcheck)
[![propcheck](https://img.shields.io/badge/propcheck-verified-brightgreen?style=flat-square)](https://github.com/AetherCore-Dev/propcheck)

</div>

---

![propcheck demo](demo.gif)

> Demo uses `--mock` for a clean, deterministic recording. Real LLM inference is also validated against OpenAI-compatible `/v1` endpoints, with the current `examples/price-utils.ts` pipeline passing **15/15** inferred properties end-to-end.

### Before: All Tests Pass

```
$ node --test examples/price-utils.test.ts

  ✔ applyDiscount (4 tests)
  ✔ calculateTotal (4 tests)
  ✔ formatPrice (4 tests)

  tests 12  pass 12  fail 0  duration_ms 89
```

### After: propcheck Finds What Tests Miss

```
$ propcheck run examples/price-utils.ts

  examples/price-utils.ts
  ✗ applyDiscount: Discounted price should be non-negative   FAIL
    Counterexample: applyDiscount(49.99, 150)
    A $49.99 item with 150% "discount" produces -$24.99 (negative price!)
    Shrunk to minimal case (93 shrink steps)
    Seed: 0 (reproduce with --seed 0)
  ✓ applyDiscount: Zero discount returns original price      PASS (1000/1000)
  ✓ applyDiscount: 100% discount results in zero price       PASS (1000/1000)
  ✓ calculateTotal: Total of empty array is zero             PASS (1000/1000)
  ✓ calculateTotal: Total is non-negative for valid prices   PASS (1000/1000)
  ✓ formatPrice: Output always has exactly 2 decimal places  PASS (1000/1000)
  ✓ formatPrice: Roundtrip within rounding tolerance         PASS (1000/1000)

  Properties: 9 | Passed: 8 | Failed: 1 | Duration: 0.2s
```

> 12 unit tests. 100% line coverage. All green. **propcheck still found a bug in 0.2 seconds.**

---

## How It Works

```
1. INFER — LLM discovers properties of your code          ($0.05, one-time)
2. RUN   — 1,000 random inputs per property, every commit  ($0, forever)
3. FAIL  — Shrink to minimal counterexample                (0.2 seconds)
```

The LLM is a **one-time cost**. After inference, properties persist in `.propcheck/properties.json`. Every CI run is free — pure deterministic fuzzing via [fast-check](https://github.com/dubzzz/fast-check) and [Hypothesis](https://hypothesis.readthedocs.io/).

Supports both **Anthropic direct API** and **OpenAI-compatible `/v1` endpoints** (OpenRouter, one-api/new-api, custom proxy gateways).

Latest real-provider validation: **Claude Opus 4.6 → 15 inferred properties → 15/15 pass on `examples/price-utils.ts`**.

## Quick Start

### Try it now (no API key needed)

```bash
npx propcheck init                                    # Create .propcheck/ directory
npx propcheck infer --mock examples/price-utils.ts    # Infer properties using mock LLM
npx propcheck run examples/price-utils.ts             # Run 1,000 random inputs per property
```

### With real LLM inference

```bash
export PROPCHECK_API_KEY=sk-ant-...                   # Anthropic API key
npx propcheck infer examples/price-utils.ts           # ~$0.05 one-time cost
npx propcheck run examples/price-utils.ts             # Free forever after inference
```

<details>
<summary><strong>Using OpenAI-compatible providers (OpenRouter, one-api, etc.)</strong></summary>

```bash
PROPCHECK_API_KEY=sk-or-... \
  npx propcheck infer \
  --provider openai-compatible \
  --model claude-opus-4-6 \
  --base-url https://your-proxy.example/v1 \
  examples/price-utils.ts
```

**Privacy:** propcheck sends your source code to the configured LLM provider for inference. Use `--base-url` to point to a self-hosted endpoint if needed. After inference, all test execution is local — no data leaves your machine.

</details>

## What propcheck discovers

| Category | Example | What it catches |
|----------|---------|-----------------|
| **boundary** | `result >= 0` | Negative prices, overflow |
| **roundtrip** | `decode(encode(x)) === x` | Data loss in serialization |
| **idempotent** | `sort(sort(x)) === sort(x)` | Unstable sorting |
| **conservation** | `sum(transfer(a,b,n)) === sum(a)+sum(b)` | Money disappearing |
| **monotonic** | `if a <= b then f(a) <= f(b)` | Ordering violations |
| **metamorphic** | `f(2x) ~ 2*f(x)` | Scaling inconsistencies |

## Features

- **Multi-language** — TypeScript, JavaScript, Python (Rust/Go planned)
- **Multi-provider LLM support** — Anthropic direct API or OpenAI-compatible `/v1` endpoints
- **Zero-config CI** — `propcheck run --changed` only tests git-modified files
- **Mutation testing** — `propcheck quality` measures how strong your properties are
- **Real-world validated** — Claude Opus 4.6 via an OpenAI-compatible proxy currently passes **15/15** inferred properties on `examples/price-utils.ts`
- **Self-repair** — Trial-run validation auto-repairs generated test code for compile/runtime failures up to 3 rounds before persistence
- **Risk-aware persistence** — properties now carry `status`, `riskTags`, `riskScore`, and validation evidence in `.propcheck/properties.json`
- **Canary validation + auto-weakening** — risky numeric properties are canary-checked before persistence and fragile float assertions can be refined into tolerant checks automatically
- **Refinement loop** — `--refine` strengthens weak properties via iterative LLM feedback and re-validation
- **Property workflow** — `propcheck props` lists inventory, `propcheck property` inspects/updates status with `humanVerified` tracking
- **PR Bot** — Auto-comments propcheck results on every Pull Request *(coming soon)*

## Run Modes

```bash
propcheck run --quick                             # 100 iterations — fast feedback while coding
propcheck run                                     # 1,000 iterations — default for CI
propcheck run --thorough                          # 10,000 iterations — pre-release deep check
propcheck run --changed                           # Only test files changed in git diff
propcheck run --seed 42                           # Reproducible runs
propcheck run --json                              # Machine-readable output for CI
propcheck run --skip prop_001,prop_002            # Skip specific property IDs
propcheck run --only prop_009                     # Run only selected property IDs
propcheck run --include-quarantined               # Include quarantined properties in a run
propcheck run --no-color                          # Disable colored output (for CI logs)
propcheck quality examples/price-utils.ts         # Mutation testing — measure property strength
propcheck props                                   # List all properties with status overview
propcheck props --status risky                    # Filter by status
propcheck props --json                            # Machine-readable output
propcheck property src/cart.ts prop_001           # Inspect a single property
propcheck property src/cart.ts prop_001 --status quarantined  # Update status (marks humanVerified)
```

## Exit Codes

| Code | Meaning | CI Action |
|------|---------|-----------|
| `0` | All properties passed | ✅ Merge OK |
| `1` | One or more properties failed | ❌ Block merge, review counterexamples |
| `2` | Invalid input, missing files, or config error | ❌ Fix configuration |

```yaml
# GitHub Actions example
- run: npx propcheck run src/cart.ts
  # Exit 0 = green, exit 1 = red (property failure), exit 2 = red (config error)
```

## Risk Tags Explained

When propcheck infers properties, it tags potentially fragile ones:

| Risk Tag | What It Means | What To Do |
|----------|---------------|------------|
| `float_exact_equality` | Uses `===` on floating-point numbers — may fail due to rounding | Consider `approxEqual()` or accept as risky |
| `wide_numeric_domain` | Tests unbounded numbers (no min/max) — may timeout or overflow | Add constraints in `.propcheckrc` or review generators |
| `missing_precondition` | Assumes input constraints not enforced by the code | Add input validation or accept the risk |
| `tiny_abs_tolerance` | Uses tolerance like `1e-12` — too strict for most floats | Will be auto-relaxed to `1e-6` |
| `doc_domain_mismatch` | Property contradicts function documentation | Review: is the doc or the property wrong? |
| `roundtrip_numeric_fragility` | Roundtrip test (parse → format → parse) with exact equality | Use approximate comparison |
| `metamorphic_scale_risk` | Scale relationship test without tolerance margin | Add tolerance for floating-point scale tests |

## Property lifecycle

Inferred properties are no longer treated as a flat list. propcheck now persists review metadata per property in `.propcheck/properties.json`:

- `accepted` — normal property, safe to run
- `risky` — kept, but tagged as fragile or domain-sensitive
- `refined` — automatically weakened from an over-strong assertion into a more stable one
- `quarantined` — excluded from normal `run` output unless you pass `--include-quarantined`
- `dropped` — removed from execution after validation / repair could not make it runnable

Additional metadata now includes:

- `riskTags` — exact float equality, tiny tolerances, missing preconditions, wide numeric domains, and related heuristics
- `riskScore` — risk-adjusted score used alongside the normal quality score
- `validation` — smoke/canary evidence recorded at inference time

This reduces CI noise: fragile properties are filtered or refined before they start failing every run.

### Managing properties

```bash
# List all properties with status summary
propcheck props

# Filter by status or target file
propcheck props --status risky
propcheck props examples/price-utils.ts

# Inspect a single property in detail
propcheck property examples/price-utils.ts prop_003

# Update status (automatically sets humanVerified = true)
propcheck property examples/price-utils.ts prop_001 --status quarantined
propcheck property examples/price-utils.ts prop_001 --status accepted

# Machine-readable output for scripting
propcheck props --json
propcheck property examples/price-utils.ts prop_001 --json
```

The `--status` flag on `propcheck property` sets `humanVerified: true` on the property, distinguishing human-reviewed decisions from LLM-inferred defaults.

## CI/CD — Auto-review every PR

Add `.github/workflows/propcheck.yml` to your repo:

```yaml
name: propcheck
on: [pull_request]
jobs:
  propcheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: AetherCore-Dev/propcheck/.github/actions/propcheck@main
        with:
          target: "src/"
          mode: "quick"
```

Or use outputs for custom PR comments:

```yaml
      - uses: AetherCore-Dev/propcheck/.github/actions/propcheck@main
        id: pbt
        with:
          target: "src/"
      - run: echo "${{ steps.pbt.outputs.passed }} passed, ${{ steps.pbt.outputs.failed }} failed"
```

Every PR reviewer sees propcheck results. **Distribution built into the workflow.**

## Mutation Testing

How strong are your properties? Inject code mutations, see how many your properties catch:

```
$ propcheck quality examples/price-utils.ts

  Mutation Testing: examples/price-utils.ts
  Generated 7 mutants (+ → -, > → >=, 0 → 1, ...)
  Testing against 9 properties...

  Killed:         7 (100.0%)
  Survived:       0 (0.0%)
  Mutation score: 100.0%

  ✓ All mutants killed! Your properties are comprehensive.
```

## Badge

```markdown
[![propcheck](https://img.shields.io/badge/propcheck-verified-brightgreen)](https://github.com/AetherCore-Dev/propcheck)
```

Generate: `npx propcheck badge`

## Supported Languages

| Language | Parser | PBT Engine | Status | Requirements |
|----------|--------|------------|--------|-------------|
| TypeScript / JavaScript | TS Compiler API | fast-check | **Ready** | Node.js 18+ |
| Python | Type hints + docstrings | Hypothesis | **Ready** | Node.js 18+ & Python 3.8+ with `pip install hypothesis` |
| Rust | — | proptest | Planned | — |
| Go | — | rapid | Planned | — |

> **Note for Python users:** propcheck CLI runs on Node.js but generates and executes Hypothesis tests using your local Python. You need both runtimes installed.

```bash
# Python setup
pip install hypothesis                            # Required for Python property execution
npx propcheck infer --mock my_module.py           # Infer properties
npx propcheck run my_module.py                    # Runs via Hypothesis under the hood
```

## Configuration

Create `.propcheckrc` in your project root (generated by `propcheck init`):

```json
{
  "provider": "anthropic",
  "model": "claude-sonnet-4-20250514",
  "baseURL": null,
  "maxPropertiesPerFunction": 5,
  "minScore": 10,
  "defaultMode": "default",
  "timeout": 30000,
  "storeDir": ".propcheck",
  "mock": false
}
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `provider` | `"anthropic"` \| `"openai-compatible"` | `"anthropic"` | LLM provider |
| `model` | string | `"claude-sonnet-4-20250514"` | Model name |
| `baseURL` | string \| null | `null` | Custom API endpoint (for proxies/OpenRouter) |
| `apiKey` | string \| null | `null` | API key (prefer env var `PROPCHECK_API_KEY`) |
| `maxPropertiesPerFunction` | 1-20 | `5` | Max properties inferred per function |
| `minScore` | 0-13 | `10` | Minimum quality score to keep a property |
| `defaultMode` | `"quick"` \| `"default"` \| `"thorough"` | `"default"` | Default run mode |
| `timeout` | 1000-300000 | `30000` | Per-test timeout in milliseconds |
| `storeDir` | string | `".propcheck"` | Directory for property storage |
| `mock` | boolean | `false` | Use mock LLM (no API key needed) |

**Environment variables** (override `.propcheckrc`):

| Variable | Fallback | Description |
|----------|----------|-------------|
| `PROPCHECK_API_KEY` | — | API key (highest priority) |
| `ANTHROPIC_API_KEY` | `PROPCHECK_API_KEY` | Anthropic-specific key |
| `OPENAI_API_KEY` | `ANTHROPIC_API_KEY` | OpenAI-compatible key |
| `PROPCHECK_MOCK=true` | — | Enable mock mode |
| `PROPCHECK_BASE_URL` | — | Custom API endpoint |
| `PROPCHECK_PROVIDER` | — | Provider override |

<details>
<summary><strong>Architecture</strong></summary>

```
┌──────────────────────────────────────────────┐
│            propcheck                          │
│                                              │
│   LLM (brain)         Engine (hands)         │
│   ┌──────────┐        ┌──────────────┐       │
│   │ Claude   │──────> │ fast-check   │       │
│   │ infer    │  .propcheck/          │       │
│   │ once     │  properties.json      │       │
│   └──────────┘        │ Hypothesis   │       │
│     $0.05              │ 1000+ inputs │       │
│     one-time           │ shrinking    │       │
│                        └──────────────┘       │
│                          $0 forever           │
└──────────────────────────────────────────────┘
```

</details>

<details>
<summary><strong>Research Foundation</strong></summary>

Built on peer-reviewed techniques from 5 top papers:

| Paper | Institution | Key Contribution | propcheck Feature |
|-------|-------------|-----------------|-------------------|
| [Agentic PBT](https://arxiv.org/abs/2510.09907) | Anthropic / NeurIPS 2025 | 6-step cycle, 56-86% precision | Core inference pipeline |
| [PGS](https://arxiv.org/abs/2506.18315) | BUAA | Properties > code accuracy | `propcheck fix` (coming) |
| [ClassInvGen](https://arxiv.org/abs/2502.18917) | Stanford / Microsoft | Co-generation: 77%->100% | Seed input generation |
| [FUEL](https://arxiv.org/abs/2506.17642) | Nanjing University | Feedback loops, 14 CVEs | `--refine` flag |
| [Quokka](https://arxiv.org/abs/2509.21629) | Stanford / SRI | SMT formal verification | Future: `propcheck verify` |

</details>

## Contributing

PRs welcome. See [CHANGELOG.md](CHANGELOG.md) for what's been done.

```bash
git clone https://github.com/AetherCore-Dev/propcheck.git
cd propcheck && npm install && npx tsc --build
node packages/cli/dist/index.js --help
```

## License

MIT
