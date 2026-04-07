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

> **12 unit tests. 100% line coverage. All green. propcheck still found a bug in 0.2 seconds** — a 150% "discount" that produces a negative price. Your tests didn't catch it. propcheck did.

## 30-Second Quick Start

```bash
npx propcheck init                                    # Set up your project
npx propcheck infer --mock examples/price-utils.ts    # AI discovers what should always be true
npx propcheck run examples/price-utils.ts             # Test with 1,000 random inputs
```

That's it. Three commands. No API key needed for `--mock` demo mode.

> **Works with `.js` too** — just point at any JavaScript file: `npx propcheck infer --mock src/utils.js`
> **Prerequisite:** `npm install typescript` (used for code analysis, even for .js files)

📖 **[Full Tutorial: Use propcheck on your own code →](docs/tutorial.md)**

<details>
<summary><strong>▶ Using real AI (needs API key, ~$0.05/file one-time cost)</strong></summary>

```bash
export PROPCHECK_API_KEY=sk-ant-...                   # Get from console.anthropic.com
npx propcheck infer examples/price-utils.ts           # AI reads your code (~$0.05)
npx propcheck run examples/price-utils.ts             # Free forever after this
```

Also supports OpenRouter, one-api, or any OpenAI-compatible endpoint:

```bash
PROPCHECK_API_KEY=sk-or-... npx propcheck infer \
  --provider openai-compatible --base-url https://your-proxy/v1 src/cart.ts
```

**Privacy:** Code is sent to the AI only during `infer`. All test execution runs locally.

</details>

## How It Works

```
1. INFER — AI reads your code, discovers what should always be true    ($0.05, once)
2. RUN   — Throws 1,000 random inputs at each rule, every commit      (free, forever)
3. FAIL  — Shows you the exact input that broke the rule               (0.2 seconds)
```

The AI runs **once**. Rules are saved in `.propcheck/properties.json`. Every test run after that is free — no AI, no network, just fast local testing.

## What It Catches

| Rule Type | Plain English | Real Bug Example |
|-----------|--------------|-----------------|
| **Boundary** | "Price should never be negative" | 150% discount → -$24.99 |
| **Roundtrip** | "Encode then decode = same data" | Data lost in JSON serialization |
| **Idempotent** | "Sort twice = sort once" | Unstable sort order |
| **Conservation** | "Money in = money out" | $0.01 vanishes in transfer |
| **Monotonic** | "More input → more output" | Revenue function goes backwards |
| **Scaling** | "2× input ≈ 2× output" | Pricing breaks at scale |

## CI/CD — One YAML, Every PR

```yaml
# .github/workflows/propcheck.yml
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

| Exit Code | Meaning | CI Action |
|-----------|---------|-----------|
| `0` | All rules passed | ✅ Merge OK |
| `1` | Bug found | ❌ Block merge |
| `2` | Config error | ❌ Fix setup |

## Features

- **Works with your stack** — TypeScript, JavaScript, Python (Rust/Go planned)
- **Bring your own AI** — Anthropic, OpenRouter, or any OpenAI-compatible API
- **CI-ready** — `propcheck run --changed` only tests files you modified
- **Self-healing** — auto-relaxes flaky rules before saving (e.g., float precision)
- **Auto-fix** — `propcheck fix` diagnoses failures and generates a code patch
- **Mutation testing** — `propcheck quality` checks if your rules actually catch bugs

<details>
<summary><strong>▶ All Commands</strong></summary>

```bash
# Test
propcheck run                                     # 1,000 random inputs (default)
propcheck run --quick                             # 100 inputs (fast feedback)
propcheck run --thorough                          # 10,000 inputs (pre-release)
propcheck run --changed                           # Only git-changed files
propcheck run --seed 42                           # Reproducible results
propcheck run --json                              # JSON for CI pipelines
propcheck run --no-color                          # Plain text (CI logs)

# Filter
propcheck run --only prop_001,prop_002            # Run specific rules only
propcheck run --skip prop_003                     # Skip specific rules
propcheck run --include-quarantined               # Include fragile rules

# Manage
propcheck props                                   # List all rules and status
propcheck props --status risky                    # Filter by status
propcheck property src/cart.ts prop_001           # Inspect one rule in detail
propcheck property src/cart.ts prop_001 --status quarantined  # Mark as fragile

# Other
propcheck quality src/cart.ts                     # Mutation testing
propcheck fix src/cart.ts                         # AI auto-fix for failures
propcheck badge                                   # README badge snippet
```

</details>

<details>
<summary><strong>▶ Rule Lifecycle (accepted → risky → refined → quarantined → dropped)</strong></summary>

Every rule goes through a quality check:

| Status | Meaning | Runs in CI? |
|--------|---------|-------------|
| ✅ `accepted` | Validated and stable | Yes |
| ⚠️ `risky` | Might be flaky — review recommended | Yes |
| ♻️ `refined` | Auto-relaxed for stability | Yes |
| 🔒 `quarantined` | Too fragile — needs human review | No |
| ❌ `dropped` | Couldn't be fixed — removed | No |

**Why?** Without this, flaky rules break CI on every run. propcheck stabilizes rules automatically so CI only fails on *real* bugs.

</details>

<details>
<summary><strong>▶ Risk Tags</strong></summary>

| Tag | What It Means | What To Do |
|-----|---------------|------------|
| `float ===` | Exact float comparison — may fail due to rounding | Accept or use approxEqual |
| `wide range` | Unbounded numbers — may timeout | Review generator constraints |
| `no precondition` | Assumes valid input not enforced | Add validation or accept |
| `doc mismatch` | Contradicts function docs | Check doc vs actual behavior |
| `tight tolerance` | Tolerance too strict (e.g., 1e-12) | Auto-relaxed to 1e-6 |
| `roundtrip fragile` | Parse/format roundtrip with exact equality | Use approximate comparison |
| `scale risk` | Scale test without tolerance | Add tolerance margin |

</details>

## Supported Languages

| Language | Status | Requirements |
|----------|--------|-------------|
| TypeScript / JavaScript | **Ready** | Node.js 18+ |
| Python | **Ready** | Node.js 18+ & Python 3.8+ & `pip install hypothesis` |
| Rust | Planned | — |
| Go | Planned | — |

<details>
<summary><strong>▶ Configuration (.propcheckrc)</strong></summary>

Generated by `propcheck init`:

```json
{
  "provider": "anthropic",
  "model": "claude-sonnet-4-20250514",
  "maxPropertiesPerFunction": 5,
  "minScore": 10,
  "timeout": 30000
}
```

| Option | Default | Description |
|--------|---------|-------------|
| `provider` | `"anthropic"` | `"anthropic"` or `"openai-compatible"` |
| `model` | `"claude-sonnet-4-20250514"` | AI model name |
| `baseURL` | `null` | Custom endpoint (proxies/OpenRouter) |
| `apiKey` | `null` | API key (prefer `PROPCHECK_API_KEY` env var) |
| `maxPropertiesPerFunction` | `5` | Max rules per function (1-20) |
| `minScore` | `10` | Minimum quality score (0-13) |
| `timeout` | `30000` | Test timeout in ms |
| `mock` | `false` | Demo mode (no API key) |

**Env vars** (override config file): `PROPCHECK_API_KEY`, `PROPCHECK_MOCK=true`, `PROPCHECK_BASE_URL`, `PROPCHECK_PROVIDER`

</details>

<details>
<summary><strong>▶ Architecture</strong></summary>

```
┌──────────────────────────────────────────────┐
│            propcheck                          │
│                                              │
│   AI (brain)            Engine (hands)       │
│   ┌──────────┐          ┌──────────────┐     │
│   │ Claude   │────────> │ fast-check   │     │
│   │ infer    │  .propcheck/            │     │
│   │ once     │  properties.json        │     │
│   └──────────┘          │ Hypothesis   │     │
│     $0.05                │ 1000+ inputs │     │
│     one-time             │ shrinking    │     │
│                          └──────────────┘     │
│                            $0 forever         │
└──────────────────────────────────────────────┘
```

</details>

<details>
<summary><strong>▶ Research Foundation</strong></summary>

Built on peer-reviewed techniques from 5 top papers:

| Paper | Key Contribution | propcheck Feature |
|-------|-----------------|-------------------|
| [Agentic PBT](https://arxiv.org/abs/2510.09907) (Anthropic, NeurIPS 2025) | 6-step cycle, 56-86% precision | Core inference |
| [PGS](https://arxiv.org/abs/2506.18315) (BUAA) | Properties > code accuracy | `propcheck fix` |
| [ClassInvGen](https://arxiv.org/abs/2502.18917) (Stanford/Microsoft) | Co-generation: 77%→100% | Seed inputs |
| [FUEL](https://arxiv.org/abs/2506.17642) (Nanjing U) | Feedback loops, 14 CVEs | `--refine` |
| [Quokka](https://arxiv.org/abs/2509.21629) (Stanford/SRI) | SMT verification | Future: `verify` |

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
