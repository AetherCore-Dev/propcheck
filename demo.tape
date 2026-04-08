Output demo.gif
Set Shell "bash"
Set FontSize 14
Set Width 900
Set Height 500
Set Padding 10
Set Theme "Catppuccin Mocha"

Type "# propcheck — AI-powered property-based testing"
Enter
Sleep 500ms

Type "npx propcheck --version"
Enter
Sleep 1s

Type "# Step 1: Infer properties from source code (mock mode)"
Enter
Sleep 500ms

Type "npx propcheck infer --mock test-fixtures/typescript/sort-utils.ts"
Enter
Sleep 4s

Type "# Step 2: Run discovered property tests"
Enter
Sleep 500ms

Type "npx propcheck run --quick test-fixtures/typescript/sort-utils.ts"
Enter
Sleep 4s

Type "# Step 3: View property inventory"
Enter
Sleep 500ms

Type "npx propcheck props"
Enter
Sleep 3s

Sleep 2s
