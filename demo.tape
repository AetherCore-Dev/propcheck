Output demo.gif
Set Shell "bash"
Set FontSize 13
Set Width 1000
Set Height 600
Set Padding 10
Set Theme "Catppuccin Mocha"
Set TypingSpeed 30ms

Type "# propcheck — AI finds bugs your tests miss"
Enter
Sleep 800ms

Type "cat test-fixtures/typescript/cart-buggy.ts"
Enter
Sleep 3s

Type "# Step 1: AI reads code → discovers rules that should always be true"
Enter
Sleep 600ms

Type "npx propcheck infer --mock test-fixtures/typescript/cart-buggy.ts"
Enter
Sleep 6s

Type "# Step 2: Thousands of random inputs test those rules → finds bugs"
Enter
Sleep 600ms

Type "npx propcheck run --quick test-fixtures/typescript/cart-buggy.ts"
Enter
Sleep 6s

Type "# Bug found! discount > 100% gives negative price. AI catches what humans miss."
Enter
Sleep 3s
