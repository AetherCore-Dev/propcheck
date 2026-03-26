# propcheck

> AI-powered property-based testing -- find bugs your tests miss.

[![npm](https://img.shields.io/npm/v/propcheck)](https://www.npmjs.com/package/propcheck)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

propcheck uses LLM to **automatically discover** testable properties of your code, then runs thousands of random inputs through a deterministic PBT engine to find bugs.

```
$ propcheck infer src/cart.ts

  Inferred 3 properties for src/cart.ts ($0.05, 1.2s)
  * applyDiscount: result >= 0                [boundary]  score: 14/15
  * applyDiscount: result <= price            [monotonic]  score: 13/15
  * applyDiscount: identity at zero discount  [boundary]  score: 13/15

$ propcheck run src/cart.ts

  src/cart.ts
  X applyDiscount: result >= 0              FAIL
    Counterexample: applyDiscount(5e-324, 150)
    Shrunk to minimal case (90 shrink steps)
  X applyDiscount: result <= price           FAIL
    Counterexample: applyDiscount(1e-323, -25)
    Shrunk to minimal case (91 shrink steps)
  V applyDiscount: identity at zero discount PASS (1000/1000)

  Properties: 3 | Passed: 1 | Failed: 2 | Duration: 0.3s
```

Your 100% test coverage just missed 2 bugs. propcheck found them in 0.3 seconds.

## Quick Start

```bash
# Initialize propcheck in your project
npx propcheck init

# Infer properties (requires ANTHROPIC_API_KEY or --mock)
export ANTHROPIC_API_KEY=sk-ant-...
npx propcheck infer src/cart.ts

# Run property tests (zero LLM cost -- uses persisted properties)
npx propcheck run src/cart.ts
```

## How It Works

```
1. INFER (one-time, ~$0.05/file)
   Parser extracts function signatures + types + docs
   LLM infers testable properties (invariants)
   Properties saved to .propcheck/properties.json

2. RUN (every commit, $0)
   Load persisted properties
   Generate fast-check/Hypothesis test code
   Execute 1000 random inputs per property
   Shrink failures to minimal counterexample

3. REPORT
   Colored terminal output (screenshot-worthy)
   JSON output for CI (--json)
   Exit code 1 on failure (blocks merge)
```

## Supported Languages

| Language | Parser | Engine | Status |
|----------|--------|--------|--------|
| TypeScript/JavaScript | TypeScript Compiler API | fast-check | Ready |
| Python | Regex-based | Hypothesis | Ready |
| Rust | -- | proptest | Planned |
| Go | -- | rapid | Planned |

## Run Modes

```bash
propcheck run --quick          # 100 iterations (fast feedback)
propcheck run                   # 1000 iterations (default)
propcheck run --thorough        # 10000 iterations (pre-release)
propcheck run --seed 12345      # Reproducible run
propcheck run --json            # Machine-readable output
```

## Offline Testing

```bash
# Use mock LLM for demos and CI without API key
propcheck infer --mock src/cart.ts
propcheck run src/cart.ts
```

## Property Categories

propcheck discovers these types of properties:

| Category | Example | Description |
|----------|---------|-------------|
| roundtrip | `decode(encode(x)) === x` | Encode/decode are inverse |
| idempotent | `sort(sort(x)) === sort(x)` | Applying twice = once |
| conservation | `sum(transfer(a,b,n)) === sum(a)+sum(b)` | Quantity preserved |
| monotonic | `sorted[i] <= sorted[i+1]` | Output is ordered |
| boundary | `result >= 0` | Edge case behavior |
| equivalence | `f(x) === g(x)` | Two impls agree |
| metamorphic | `f(transform(x)) ~ f(x)` | Transform relationship |

## Configuration

Create `.propcheckrc` in your project root:

```json
{
  "model": "claude-sonnet-4-20250514",
  "maxPropertiesPerFunction": 5,
  "minScore": 10,
  "defaultMode": "default",
  "timeout": 30000,
  "languages": ["typescript", "javascript"]
}
```

## Badge

Add to your README:

```markdown
[![propcheck](https://img.shields.io/badge/propcheck-verified-brightgreen)](https://github.com/user/propcheck)
```

Generate with: `npx propcheck badge`

## Architecture

```
LLM (brain)              Deterministic Engine (hands)
  infer properties   -->   .propcheck/properties.json
                           fast-check / Hypothesis
                           1000+ random inputs
                           automatic shrinking
                           minimal counterexample
```

Key insight: LLM is a **one-time cost** for inference. Execution is **free forever**.

## Research Foundation

Built on techniques from 5 top papers (NeurIPS/Stanford/Anthropic):

- **Agentic PBT** (Anthropic) -- 6-step cycle, 56-86% precision
- **PGS** (BUAA) -- properties are easier to get right than code
- **ClassInvGen** (Stanford/MSFT) -- co-generation boosts quality 77%->100%
- **FUEL** (NJU) -- feedback loops find 14 CVEs
- **Quokka** (Stanford/SRI) -- LLM invariants + formal verification

## License

MIT
