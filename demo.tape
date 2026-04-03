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
Set TypingSpeed 40ms
Set WindowBar Colorful
Set WindowBarSize 40
Set CursorBlink false

# ── Scene 1: Tests pass — build false confidence ──
Type "# Your tests all pass..."
Enter
Sleep 1.2s
Type "NODE_NO_WARNINGS=1 node --experimental-strip-types --test examples/price-utils.test.ts"
Enter
Sleep 3.5s
Type ""
Enter
Type "# 12 tests. 100% coverage. All green. Ship it?"
Enter
Sleep 2.5s
Ctrl+L

# ── Scene 2: propcheck discovers rules ──
Type "# Let's see what propcheck thinks..."
Enter
Sleep 1s
Type "npx propcheck infer --mock examples/price-utils.ts"
Enter
Sleep 6s
Ctrl+L

# ── Scene 3: THE REVEAL ──
Type "npx propcheck run examples/price-utils.ts"
Enter
Sleep 8s

# Let the audience absorb the FAIL
Sleep 4s
Ctrl+L

# ── Scene 4: Call to action ──
Type "# Bug found: 150% discount → negative price. Tests missed it."
Enter
Sleep 2s
Type "# Get started: npx propcheck init && npx propcheck infer --mock YOUR_FILE.ts"
Enter
Sleep 4s
