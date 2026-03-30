# propcheck 0.2.0 Release Notes

propcheck 0.2.0 makes the real-provider path production-ready.

This release hardens property inference and execution for Anthropic direct API and OpenAI-compatible `/v1` gateways, reduces false positives from brittle float assertions, and validates the full pipeline against a real Claude Opus 4.6 endpoint.

## Highlights

- **Real LLM validation: 15/15 pass**
  - `examples/price-utils.ts` now infers 15 properties and passes **15/15** end-to-end with Claude Opus 4.6 via an OpenAI-compatible proxy.

- **Multi-provider LLM support**
  - Anthropic direct API
  - OpenAI-compatible `/v1` endpoints (OpenRouter, one-api/new-api, custom gateways)

- **Trial-run validation before persistence**
  - `infer` now validates TypeScript, JavaScript, and Python properties with a 100-iteration quick run before saving them.
  - Generated test code that fails at compile/runtime can be self-repaired for up to 3 rounds before being dropped.

- **Stronger real-provider compatibility**
  - Supports string-style generators like `"float(0, 10000)"`
  - Supports array constraint formats like `{ elementType, min, max, maxLength }`
  - Normalizes `implies` assertions into valid JavaScript

- **Lower false-positive risk**
  - Fragile float assertions now receive scoring penalties before persistence:
    - exact float equality
    - tiny tolerances like `< 1e-9`
    - brittle parse/format roundtrip equality
  - Risky properties now persist explicit lifecycle metadata: `status`, `riskTags`, `riskScore`, and validation evidence
  - Risky properties go through canary validation before persistence and may be auto-weakened into `refined` properties instead of being stored as noisy failures

## New and Improved

### Added
- OpenAI-compatible provider support in `propcheck infer`
- `propcheck run --changed` for git-modified files only
- Demo GIF embedded in README

### Fixed
- Assertion qualifier rewriting for JS globals and method calls
- Real-provider generator parsing and normalization
- Array element constraint mapping in fast-check codegen
- Hypothesis codegen translation for JS-style assertions (`===`, `&&`, `.length`, `Math.abs`, `parseFloat`, `parseInt`)
- Python properties now go through the same trial-run validation path instead of bypassing validation
- User-friendly LLM API error messages
- `approxEqual`-based refined assertions are no longer misclassified as exact float equality risk
- tiny absolute tolerances now weaken to stable tolerant comparisons instead of carrying the original brittle threshold forward
- legacy `riskScore` migration now recomputes from `riskTags` when old store data is missing the field
- `run --json` now includes skipped/quarantined/dropped property reporting for CI

### Changed
- Real validation status upgraded from partial pass to **15/15 pass**
- `--refine` now uses execution feedback to generate stronger properties before re-validation
- npm package published as `propcheck@0.2.0`

## Why it matters

propcheck’s core model remains the same:

1. Use an LLM once to infer properties about your code
2. Store those properties in `.propcheck/properties.json`
3. Run deterministic property-based tests forever after with no LLM in the loop

That gives you the upside of AI-assisted test discovery without paying inference costs in CI on every run.

## Example

A file can still have 12/12 unit tests and 100% line coverage while hiding bugs. propcheck infers invariants like:

- zero discount returns original price
- 100% discount returns zero
- total is invariant to item order
- formatted price roundtrips within tolerance

Then runs 1000 randomized cases per property and shrinks counterexamples when something fails.

## Install

```bash
npm install -g propcheck fast-check
```

## Links

- GitHub: https://github.com/AetherCore-Dev/propcheck
- README: https://github.com/AetherCore-Dev/propcheck#readme
- Show HN draft: `docs/show-hn-draft.md`
