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

<!-- TODO: Replace with actual VHS-recorded GIF after running: vhs < demo.tape -->
<!-- ![propcheck demo](demo.gif) -->

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

## Quick Start

```bash
npx propcheck init                                # Create .propcheck/ directory
npx propcheck infer examples/price-utils.ts       # LLM infers properties (needs ANTHROPIC_API_KEY)
npx propcheck run examples/price-utils.ts         # Run 1000 random inputs per property
```

No API key? Try the demo:
```bash
npx propcheck infer --mock examples/price-utils.ts && npx propcheck run examples/price-utils.ts
```

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
- **Zero-config CI** — `propcheck run --changed` only tests git-modified files
- **Mutation testing** — `propcheck quality` measures how strong your properties are
- **Self-repair** — Auto-fixes generated test code that fails to compile *(coming soon)*
- **Refinement loop** — `--refine` strengthens weak properties via iterative LLM feedback *(coming soon)*
- **PR Bot** — Auto-comments propcheck results on every Pull Request *(coming soon)*

## Run Modes

```bash
propcheck run --quick                             # 100 iterations — fast feedback while coding
propcheck run                                     # 1,000 iterations — default for CI
propcheck run --thorough                          # 10,000 iterations — pre-release deep check
propcheck run --changed                           # Only test files changed in git diff
propcheck run --seed 42                           # Reproducible runs
propcheck run --json                              # Machine-readable output for CI
propcheck quality examples/price-utils.ts         # Mutation testing — measure property strength
```

## CI/CD — Auto-review every PR

Add `.github/workflows/propcheck.yml` to your repo:

```yaml
name: propcheck
on: [pull_request]
permissions: { contents: read, pull-requests: write }
jobs:
  propcheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "20" }
      - run: npm ci && npm install -g propcheck
      - run: propcheck run > /tmp/output.txt 2>&1 || true
      - uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const output = fs.readFileSync('/tmp/output.txt','utf8');
            await github.rest.issues.createComment({
              owner: context.repo.owner, repo: context.repo.repo,
              issue_number: context.issue.number,
              body: '## propcheck\n```\n' + output.trim().slice(0,3000) + '\n```',
            });
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

| Language | Parser | PBT Engine | Status |
|----------|--------|------------|--------|
| TypeScript / JavaScript | TS Compiler API | fast-check | **Ready** |
| Python | Type hints + docstrings | Hypothesis | **Ready** |
| Rust | — | proptest | Planned |
| Go | — | rapid | Planned |

## Configuration

```json
// .propcheckrc
{
  "model": "claude-sonnet-4-20250514",
  "maxPropertiesPerFunction": 5,
  "minScore": 10,
  "defaultMode": "default",
  "timeout": 30000
}
```

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
