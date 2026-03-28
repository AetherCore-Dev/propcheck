# Show HN: propcheck — AI finds bugs your 100% test coverage missed

## Title Options (pick one)

1. **Show HN: I built a CLI that finds bugs your 100% test coverage misses**
2. **Show HN: propcheck – AI-powered property-based testing for TypeScript/Python**
3. **Show HN: Your tests pass. Your coverage is 100%. Your code has bugs. propcheck finds them.**

## Post Body

propcheck is an open-source CLI that uses an LLM (Claude) to infer properties about your code, then runs thousands of random inputs through fast-check/Hypothesis to find edge cases your unit tests miss.

The key insight: LLM infers once ($0.05), then the deterministic PBT engine runs forever for free. No AI in the loop at test time.

Example: a function `applyDiscount(price, discount)` has 12 passing tests and 100% coverage. propcheck finds that `applyDiscount(49.99, 150)` returns a **negative price** — a discount > 100% is never guarded.

```
npm install -g propcheck fast-check
propcheck init
propcheck infer --mock examples/price-utils.ts   # try without API key first
propcheck run examples/price-utils.ts
```

What it does:
- Parses your TypeScript/JavaScript/Python source code
- Sends function signatures + types to Claude (your API key)
- Claude returns property definitions (invariants, boundary conditions, equivalences)
- fast-check/Hypothesis executes 1000+ random inputs per property
- Shrinks counterexamples to minimal reproduction

What it doesn't do:
- No AI at test runtime — properties are deterministic once inferred
- No data leaves your machine except the function signatures sent to Claude
- No vendor lock-in — properties are stored in `.propcheck/properties.json`, plain JSON

Built with: TypeScript, fast-check, Hypothesis, Anthropic SDK. MIT licensed.

GitHub: https://github.com/AetherCore-Dev/propcheck
npm: `npm install -g propcheck`

---

## FAQ — Prepared Answers for HN Comments

### "Why not just use fast-check/Hypothesis directly?"

You absolutely should if you know what properties to test. propcheck solves the "blank page problem" — most developers know they should write property tests but don't know where to start. The LLM generates the property definitions; the execution is 100% deterministic fast-check/Hypothesis. Think of it as "GitHub Copilot for test properties, not test code."

### "How is this different from fuzzing?"

Fuzzing throws random bytes at a binary looking for crashes. Property-based testing generates **structured, typed** random inputs (valid prices, valid arrays, valid strings) and checks **semantic invariants** (not just "doesn't crash" but "discount never produces negative price"). propcheck adds a third layer: the LLM infers which invariants to check, so you don't have to manually write them.

### "What about false positives?"

Every inferred property goes through a trial run — 100 random inputs immediately after inference. Properties that fail the trial run are discarded before being persisted. In our testing with the mock client, we see 0% false positives on correct code. We're validating with real Claude API now.

### "Will this break when the LLM hallucinates?"

The LLM only generates property *definitions* (JSON: assertion string + generator types). These are validated by a Zod schema, sanitized by an assertion whitelist (no require/import/eval/process), and trial-run tested before persisting. The actual test execution is pure fast-check — no LLM involved. If the LLM hallucinates a bad property, the trial run catches it.

### "Why Claude specifically? Will you support other LLMs?"

Claude's tool_use API gives us structured JSON output reliably. In principle, any LLM with function calling works. We're starting with Claude because the Agentic PBT paper (Anthropic, NeurIPS 2025) demonstrated 56-86% precision with this approach. Other providers are planned.

### "How much does it cost?"

One-time inference costs ~$0.05 per file (a few function signatures → one Claude API call). After that, `propcheck run` is free forever — no API calls. The properties are cached in `.propcheck/properties.json`. Re-inference only happens when source code changes.

### "$0.05 per file seems optimistic"

It depends on file size. A typical file with 3-5 functions generates about 500 input tokens and 2000 output tokens. At Claude Sonnet pricing ($3/$15 per million tokens), that's ~$0.03. Larger files with 10+ functions might cost $0.10-0.15. The point is it's a one-time cost.

### "Does this actually find real bugs?"

In our test suite, propcheck consistently finds the intentional bug in `applyDiscount` (discount > 100% → negative price) with a minimal counterexample. We're running against more real-world codebases now. The academic foundation (5 papers, NeurIPS/Stanford/Microsoft) shows 56-86% precision on property inference.

### "This seems like it could be a VS Code extension"

Agreed — that's on the roadmap. The CLI-first approach lets us iterate faster and works in CI/CD pipelines. VS Code extension is Phase 2.

---

## Timing Strategy

- **Day**: Tuesday or Wednesday
- **Time**: 9-10 AM US Pacific (12-1 PM Eastern)
- **Pre-requisites before posting**:
  1. npm published (so `npx propcheck` works)
  2. Demo GIF in README
  3. "Ship Confidence" article published for cross-linking (optional but ideal)
  4. Real API validation completed
