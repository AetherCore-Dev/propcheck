#!/usr/bin/env bash
# Run all propcheck unit tests.
# Usage:
#   ./scripts/test-all.sh          Run all tests
#   npx c8 ./scripts/test-all.sh   Run with coverage

set -euo pipefail

echo "=== propcheck test suite ==="
echo ""

node --test \
  packages/parser/dist/__tests__/parser.test.js \
  packages/store/dist/__tests__/store.test.js \
  packages/store/dist/__tests__/store-edge.test.js \
  packages/common/dist/__tests__/assertion-sanitizer.test.js \
  packages/common/dist/__tests__/git.test.js \
  packages/config/dist/__tests__/config.test.js \
  packages/reporter/dist/__tests__/reporter.test.js \
  packages/llm/dist/__tests__/llm.test.js \
  packages/llm/dist/__tests__/scoring-edge.test.js \
  packages/llm/dist/__tests__/response-parser-edge.test.js \
  packages/llm/dist/__tests__/adaptive-generator.test.js \
  packages/llm/dist/__tests__/mock-fix.test.js \
  packages/llm/dist/__tests__/mock-refinement.test.js \
  packages/engines/dist/__tests__/fc-codegen.test.js \
  packages/engines/dist/__tests__/hyp-codegen.test.js \
  packages/engines/dist/__tests__/result-parser.test.js \
  packages/engines/dist/__tests__/fc-runner.test.js \
  packages/cli/dist/__tests__/commands.test.js \
  packages/cli/dist/__tests__/auto-weaken.test.js \
  packages/cli/dist/__tests__/init.test.js \
  packages/cli/dist/__tests__/confirm.test.js \
  packages/cli/dist/__tests__/fix.test.js

echo ""
echo "=== All tests passed ==="
