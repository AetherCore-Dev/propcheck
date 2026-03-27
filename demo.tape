# propcheck Demo — Terminal Recording Script
# Usage: vhs < demo.tape
# Requires: vhs (brew install charmbracelet/tap/vhs)

Output demo.gif
Set FontSize 16
Set Width 1000
Set Height 600
Set Theme "Catppuccin Mocha"
Set Padding 20
Set TypingSpeed 50ms
Set WindowBar Colorful
Set WindowBarSize 40

# Title
Sleep 500ms
Type "# propcheck — find bugs your 100% test coverage missed"
Enter
Sleep 1s
Ctrl+L

# Step 1: Show the "fully tested" code
Type "cat src/cart.ts"
Enter
Sleep 3s

# Step 2: Show existing test coverage is 100%
Type "# ✅ Existing tests: 100% coverage, all passing"
Enter
Sleep 1.5s
Type "# But is the code actually correct? Let's find out..."
Enter
Sleep 2s
Ctrl+L

# Step 3: Infer properties (the wow moment setup)
Type "npx propcheck infer src/cart.ts"
Enter
Sleep 4s

# Step 4: Run properties (the wow moment)
Type "npx propcheck run src/cart.ts"
Enter
Sleep 5s

# Step 5: Mutation testing
Type "npx propcheck quality src/cart.ts"
Enter
Sleep 4s

# Final pause to read results
Sleep 3s
