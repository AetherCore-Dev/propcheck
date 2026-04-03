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
1. INFER — AI reads your code and figures out what should always be true    ($0.05, one-time)
2. RUN   — Throws 1,000 random inputs at each rule, every commit           (free, forever)
3. FAIL  — When a rule breaks, shows you the exact input that caused it    (0.2 seconds)
```

propcheck uses AI **once** to discover rules about your code (e.g., "prices should never be negative"). Those rules are saved locally. From then on, every test run is free — no AI needed, just fast random testing.

> **Cost:** ~$0.05 per file for the one-time AI analysis. All subsequent runs are free.
> **Privacy:** Your code is sent to the AI provider only during `infer`. All test execution happens locally.

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

## What propcheck catches

| Rule Type | Example | Real Bug It Finds |
|-----------|---------|-------------------|
| **Boundary** | "Price should never be negative" | 150% discount → negative price |
| **Roundtrip** | "Encode then decode gives back the same data" | Data lost during serialization |
| **Idempotent** | "Sorting twice gives the same result as sorting once" | Unstable sort order |
| **Conservation** | "Transfer money between accounts — total stays the same" | Money disappearing in transfers |
| **Monotonic** | "Bigger input → bigger output" | Ordering violations |
| **Scaling** | "Double the input → roughly double the output" | Broken scaling logic |

## Features

- **Works with your stack** — TypeScript, JavaScript, Python (Rust/Go planned)
- **Bring your own AI** — Anthropic, OpenRouter, or any OpenAI-compatible API
- **CI-ready** — `propcheck run --changed` only tests files you modified
- **Self-healing** — auto-fixes flaky rules before saving them (e.g., relaxes exact float comparisons)
- **Smart filtering** — noisy or fragile rules are flagged and can be reviewed, quarantined, or dropped
- **Mutation testing** — `propcheck quality` checks if your rules are actually catching bugs
- **Auto-fix** — `propcheck fix` diagnoses failures and generates minimal code fixes
- **Property management** — `propcheck props` to review, `propcheck property` to inspect/update
- **PR Bot** — auto-comments results on every Pull Request *(coming soon)*

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

## Property Lifecycle

Every rule propcheck discovers goes through a quality check. You'll see these statuses:

| Status | Icon | Meaning | Runs in CI? |
|--------|------|---------|-------------|
| `accepted` | ✅ | Validated and stable — safe to enforce | Yes |
| `risky` | ⚠️ | Might be flaky (e.g., float precision) — review recommended | Yes |
| `refined` | ♻️ | Was too strict, auto-relaxed to be more stable | Yes |
| `quarantined` | 🔒 | Too fragile to run reliably — needs human review | No (use `--include-quarantined`) |
| `dropped` | ❌ | Could not be made runnable — removed from execution | No |

> **Why this matters:** Without lifecycle management, flaky rules would break your CI on every run. propcheck filters and stabilizes rules automatically, so CI stays green unless there's a *real* bug.

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
