#!/usr/bin/env bash
# Run all propcheck unit tests.
# Usage:
#   ./scripts/test-all.sh   Run all compiled tests
#   npm run test:coverage   Run the shared coverage workflow

set -euo pipefail

echo "=== propcheck test suite ==="
echo ""

node ./scripts/run-compiled-tests.mjs

echo ""
echo "=== All tests passed ==="
