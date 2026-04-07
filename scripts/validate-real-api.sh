#!/usr/bin/env bash
# =============================================================================
# T0-2: Real API end-to-end validation script
#
# Usage:
#   PROPCHECK_API_KEY=sk-xxx ./scripts/validate-real-api.sh
#   # Or with OpenAI-compatible provider:
#   PROPCHECK_API_KEY=sk-xxx PROPCHECK_BASE_URL=https://your-proxy.com/v1 \
#     ./scripts/validate-real-api.sh
# =============================================================================
set -euo pipefail

CLI="node packages/cli/dist/index.js"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass=0
fail=0

check() {
  local desc="$1"
  shift
  echo -e "${YELLOW}▶ ${desc}${NC}"
  if "$@"; then
    echo -e "  ${GREEN}✔ PASS${NC}\n"
    ((pass++))
  else
    echo -e "  ${RED}✖ FAIL (exit $?)${NC}\n"
    ((fail++))
  fi
}

# Ensure API key
if [ -z "${PROPCHECK_API_KEY:-}" ]; then
  echo -e "${RED}Error: PROPCHECK_API_KEY is not set.${NC}"
  echo "  Usage: PROPCHECK_API_KEY=sk-xxx $0"
  exit 1
fi

# Determine provider args
PROVIDER_ARGS=""
if [ -n "${PROPCHECK_BASE_URL:-}" ]; then
  PROVIDER_ARGS="--provider openai-compatible --base-url $PROPCHECK_BASE_URL"
fi

echo "============================================"
echo "  propcheck — Real API Validation Suite"
echo "============================================"
echo ""

# 1. Infer on examples/price-utils.ts (3 well-known functions)
check "Infer: examples/price-utils.ts (3 functions)" \
  $CLI infer $PROVIDER_ARGS examples/price-utils.ts

# 2. Run the inferred properties
check "Run: examples/price-utils.ts" \
  $CLI run examples/price-utils.ts

# 3. Infer on a novel user file (not in any hardcoded map)
cat > /tmp/propcheck-validate-input.ts << 'TSEOF'
/** Clamp a value between min and max bounds */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Remove duplicate elements from an array, preserving order */
export function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

/** Check if a string is a palindrome (case-insensitive) */
export function isPalindrome(str: string): boolean {
  const cleaned = str.toLowerCase().replace(/[^a-z0-9]/g, "");
  return cleaned === cleaned.split("").reverse().join("");
}
TSEOF

# Copy to project dir (path traversal guard)
cp /tmp/propcheck-validate-input.ts examples/_validate-temp.ts

check "Infer: novel user code (clamp, unique, isPalindrome)" \
  $CLI infer $PROVIDER_ARGS examples/_validate-temp.ts

check "Run: novel user code" \
  $CLI run examples/_validate-temp.ts

# 4. JSON output
check "Run --json output is valid JSON" \
  bash -c "$CLI run --json examples/price-utils.ts | node -e 'const d=require(\"fs\").readFileSync(\"/dev/stdin\",\"utf-8\"); JSON.parse(d); console.log(\"Valid JSON\")'"

# 5. Badge command
check "Badge command works" \
  $CLI badge

# Cleanup
rm -f examples/_validate-temp.ts

echo "============================================"
echo -e "  Results: ${GREEN}${pass} passed${NC}, ${RED}${fail} failed${NC}"
echo "============================================"

if [ "$fail" -gt 0 ]; then
  exit 1
fi
