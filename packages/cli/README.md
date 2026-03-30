# propcheck

AI-powered property-based testing CLI.

**Your tests pass. Your coverage is 100%. Your code has bugs. propcheck finds them.**

propcheck uses an LLM to infer properties about your code once, then runs deterministic property-based tests with `fast-check` / `Hypothesis` forever after.

## Install

```bash
npm install -g propcheck fast-check
```

## Quick Start

```bash
propcheck init
propcheck infer examples/price-utils.ts
propcheck infer --refine examples/price-utils.ts
propcheck run examples/price-utils.ts
```

Using an OpenAI-compatible `/v1` provider:

```bash
PROPCHECK_API_KEY=sk-... \
  propcheck infer \
  --provider openai-compatible \
  --model claude-opus-4-6 \
  --base-url https://your-proxy.example/v1 \
  examples/price-utils.ts
```

## Highlights

- TypeScript / JavaScript + Python support
- Anthropic direct API + OpenAI-compatible `/v1` providers
- Trial-run validation with up to 3 rounds of self-repair before persistence
- Risk-aware persistence with `status`, `riskTags`, `riskScore`, and validation metadata
- Canary validation + auto-weakening for fragile numeric properties
- `--refine` strengthens weak properties using execution feedback
- `propcheck run --changed` for git-modified files only
- `propcheck run --skip`, `--only`, and `--include-quarantined` for execution control
- Mutation testing via `propcheck quality`
- Real validation: Claude Opus 4.6 currently passes **15/15** inferred properties on `examples/price-utils.ts`

## Property status model

`infer` persists properties with lifecycle metadata in `.propcheck/properties.json`:

- `accepted` — default runnable property
- `risky` — potentially fragile, but still kept
- `refined` — auto-weakened into a more stable assertion
- `quarantined` — skipped by default during `run`
- `dropped` — excluded from execution entirely

`propcheck run --json` now reports skipped properties explicitly, including quarantined and dropped entries, so CI can distinguish “all passed” from “some were intentionally skipped”.

## Links

- GitHub: https://github.com/AetherCore-Dev/propcheck
- Issues: https://github.com/AetherCore-Dev/propcheck/issues
- Full documentation: https://github.com/AetherCore-Dev/propcheck#readme

## License

MIT
