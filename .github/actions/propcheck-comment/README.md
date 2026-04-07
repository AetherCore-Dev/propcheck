# propcheck PR Comment Action

Runs propcheck on PR changed files and posts results as a PR comment.

## Usage

```yaml
- uses: AetherCore-Dev/propcheck/.github/actions/propcheck-comment@main
  with:
    mode: quick           # quick (100x) | default (1000x) | thorough (10000x)
    mock: "true"          # Use mock mode (no API key)
    comment: "true"       # Post PR comment
    fail-on-violation: "true"  # Fail workflow on violations
```

## Features

- **Changed files only** — Detects `.ts`, `.js`, `.py` files modified in the PR
- **Smart comments** — Updates existing comment instead of creating new ones
- **Counterexample details** — Expandable sections with counterexamples and reproduction commands
- **JSON output** — Full structured results available as workflow output

## Inputs

| Input | Default | Description |
|-------|---------|-------------|
| `mode` | `quick` | Run mode: `quick`, `default`, `thorough` |
| `mock` | `false` | Use mock mode (no API key needed) |
| `api-key` | — | LLM API key (for real inference) |
| `version` | `latest` | propcheck version to install |
| `comment` | `true` | Post PR comment with results |
| `fail-on-violation` | `true` | Fail workflow if violations found |

## Outputs

| Output | Description |
|--------|-------------|
| `passed` | Number of properties that passed |
| `failed` | Number of properties that failed |
| `errors` | Number of properties that errored |
| `total` | Total properties tested |
| `json` | Path to full JSON results file |

## Comment Format

The comment includes:
- Summary table (passed/failed/errors)
- Expandable violation details with counterexamples
- Reproduction commands (`propcheck run --seed <N> <file>`)

Comments are identified by a hidden HTML marker and updated in-place on re-runs.
