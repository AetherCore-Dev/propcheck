# Tutorial: Use propcheck on Your Own Code

This guide walks you through using propcheck on a real project — from setup to CI integration.

**Time:** 5 minutes | **Cost:** Free with `--mock`, ~$0.05/file with real AI

---

## Step 1: Install

```bash
npm install -D propcheck typescript
npx propcheck init
```

That's it. `init` creates `.propcheck/` and updates your `.gitignore` automatically.

## Step 2: Try Mock Mode First (Free, Instant)

Pick any file in your project with exported functions:

```bash
npx propcheck infer --mock src/utils.ts
```

You'll see output like:

```
Analyzing 3 functions in src/utils.ts...
  Validating 9 rules (quick test, 100 random inputs each)...

  Discovered 9 rules for src/utils.ts ($0.00, 0.0s)

  * clamp: clamp should return a finite number     ★ 13/13
  * clamp: Applying clamp twice equals once         ★ 11/13 [risky]
  * unique: unique output length ≤ input length     ★ 13/13
```

**What happened:**
1. propcheck analyzed your function signatures
2. Generated "rules" — properties that should always be true
3. Ran 100 random inputs against each rule to verify

## Step 3: Run Tests

```bash
npx propcheck run src/utils.ts
```

This throws **1,000 random inputs** at each rule. If something fails, you'll see the exact input that broke it:

```
  ✖ calculateTotal: Total should be non-negative     FAILED
    Counterexample: calculateTotal([-Infinity, 100])
    Shrunk in 3 steps
```

## Step 4: Use Real AI (Optional)

Mock mode generates properties from function signatures alone. Real AI reads your **actual code** and generates much smarter properties — it understands your business logic.

```bash
# Anthropic (direct)
export PROPCHECK_API_KEY=sk-ant-...    # From console.anthropic.com
npx propcheck infer src/utils.ts

# OpenRouter, one-api, or any OpenAI-compatible endpoint
PROPCHECK_API_KEY=sk-or-... npx propcheck infer \
  --provider openai-compatible \
  --base-url https://openrouter.ai/api/v1 \
  src/utils.ts
```

**Cost:** ~$0.05 per file, one-time. After inference, all runs are free.

**Privacy:** Code is sent to the AI only during `infer`. All testing runs 100% locally.

## Step 5: Review and Manage Properties

```bash
npx propcheck props                          # List all rules
npx propcheck props --status risky           # Show only risky ones
npx propcheck property src/utils.ts prop_001 # Inspect details
```

If a rule is too flaky for CI:

```bash
npx propcheck property src/utils.ts prop_003 --status quarantined
```

## Step 6: Add to CI

Create `.github/workflows/propcheck.yml`:

```yaml
name: propcheck
on: [pull_request]
jobs:
  propcheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "20" }
      - run: npm ci
      - run: npx propcheck run --changed --json > propcheck-results.json
      - run: npx propcheck badge
```

Key flags for CI:
- `--changed` — only test files modified in the PR
- `--json` — machine-readable output
- `--quick` — 100 inputs (faster CI) vs default 1,000

## Step 7: Auto-Fix Failures

When propcheck finds a bug:

```bash
npx propcheck fix src/utils.ts              # AI diagnoses and suggests fix
npx propcheck fix --apply src/utils.ts      # Apply the fix automatically
```

---

## Tips

### Analyze a whole directory

```bash
npx propcheck infer --mock src/
npx propcheck run src/
```

### Filter specific functions

```bash
npx propcheck infer --mock --function calculateTotal,applyDiscount src/cart.ts
```

### Reproducible results

```bash
npx propcheck run --seed 42 src/utils.ts
```

### Config file

Create `.propcheckrc` in your project root:

```json
{
  "minScore": 10,
  "maxProperties": 5,
  "numRuns": 1000,
  "storeDir": ".propcheck"
}
```

### JSON output schema (for CI pipelines)

`propcheck run --json` outputs:

```json
{
  "version": "0.4.0",
  "timestamp": "2026-04-07T12:00:00.000Z",
  "filePath": "src/cart.ts",
  "summary": {
    "passed": 5,
    "failed": 1,
    "errors": 0,
    "skipped": 2,
    "totalIterations": 6000,
    "duration": 1234
  },
  "passed": [
    { "propertyId": "prop_001", "iterations": 1000 }
  ],
  "failed": [
    {
      "propertyId": "prop_003",
      "errorMessage": "Property failed after 42 tests",
      "counterexample": [150],
      "shrinkSteps": 3
    }
  ],
  "errors": [],
  "skipped": [
    { "propertyId": "prop_005", "reason": "quarantined" }
  ]
}
```

| Exit Code | Meaning | CI Action |
|-----------|---------|-----------|
| `0` | All tests passed | ✅ Merge OK |
| `1` | Bug found | ❌ Block merge |
| `2` | Config/setup error | ❌ Fix setup |

---

## FAQ

**Q: Does propcheck replace my unit tests?**
No. Unit tests verify specific scenarios you thought of. propcheck discovers edge cases you didn't think of. Use both.

**Q: How is this different from fuzzing?**
Fuzzing throws random inputs at your code looking for crashes. propcheck throws random inputs looking for **logical** bugs — prices going negative, data corruption, broken invariants.

**Q: What if a rule is wrong?**
Quarantine it: `propcheck property <file> <id> --status quarantined`. You can also drop it permanently with `--status dropped`.

**Q: Does it work with JavaScript?**
Yes. Point at any `.js` file. TypeScript must be installed (it's used for analysis only).

**Q: Does it work with Python?**
Yes. Install Hypothesis: `pip install hypothesis`. Then: `propcheck infer --mock app.py`.
