# propcheck Demo — Terminal Recording Script
# Usage: vhs < demo.tape
# Requires: vhs (brew install charmbracelet/tap/vhs)
#
# Prerequisites (run once before recording):
#   npm install && npx tsc --build
#   cd packages/cli && npx tsup && cd ../..
#   node packages/cli/dist/index.js infer --mock examples/price-utils.ts

Output demo.gif
Set FontSize 18
Set Width 1200
Set Height 700
Set Theme "Catppuccin Mocha"
Set Padding 24
Set TypingSpeed 35ms
Set WindowBar Colorful
Set WindowBarSize 40
Set CursorBlink false

# ── Opening: Title card ──
Type "# propcheck — AI-powered property-based testing"
Enter
Sleep 1.5s
Type "# Your tests pass. Your code has bugs. propcheck finds them."
Enter
Sleep 2s
Ctrl+L

# ── Step 1: Show the code (looks production-ready) ──
Type "cat examples/price-utils.ts"
Enter
Sleep 3s
Ctrl+L

# ── Step 2: Show 12/12 tests passing (build false confidence) ──
Type "NODE_NO_WARNINGS=1 node --experimental-strip-types --test examples/price-utils.test.ts"
Enter
Sleep 4s
Ctrl+L

# ── Step 3: The pivot — make the audience think ──
Type "# 12 tests. 100% coverage. But is the code actually correct?"
Enter
Sleep 2.5s

# ── Step 4: propcheck infer (discover properties with mock LLM) ──
Type "node packages/cli/dist/index.js infer --mock examples/price-utils.ts"
Enter
Sleep 6s
Ctrl+L

# ── Step 5: propcheck run — THE REVEAL ──
Type "node packages/cli/dist/index.js run examples/price-utils.ts"
Enter
Sleep 6s

# Let the audience absorb the results — FAIL stands out
Sleep 5s
