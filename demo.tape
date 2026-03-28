# propcheck Demo — Terminal Recording Script
# Usage: vhs < demo.tape
# Requires: vhs (brew install charmbracelet/tap/vhs)
#
# Prerequisites (run once before recording):
#   node packages/cli/dist/index.js infer --mock examples/price-utils.ts

Output demo.gif
Set FontSize 16
Set Width 1200
Set Height 650
Set Theme "Catppuccin Mocha"
Set Padding 20
Set TypingSpeed 40ms
Set WindowBar Colorful
Set WindowBarSize 40

# ── Step 1: Show the code (looks production-ready) ──
Sleep 500ms
Type "cat examples/price-utils.ts"
Enter
Sleep 2.5s
Ctrl+L

# ── Step 2: Show 12/12 tests passing (build false confidence) ──
Type "node --experimental-strip-types --test examples/price-utils.test.ts"
Enter
Sleep 3s
Ctrl+L

# ── Step 3: The pivot ──
Type "# 12 tests. All passing. But is the code actually correct?"
Enter
Sleep 2s

# ── Step 4: propcheck infer (discover properties) ──
Type "node packages/cli/dist/index.js infer --mock examples/price-utils.ts"
Enter
Sleep 5s
Ctrl+L

# ── Step 5: propcheck run — THE REVEAL ──
Type "node packages/cli/dist/index.js run examples/price-utils.ts"
Enter
Sleep 5s

# Let the audience absorb the FAIL
Sleep 4s
