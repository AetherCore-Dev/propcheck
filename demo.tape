Output demo.gif
Set Shell "bash"
Set FontSize 14
Set Width 1100
Set Height 600
Set Padding 10
Set Theme "Catppuccin Mocha"
Set TypingSpeed 30ms

# Act 1: False sense of security
Type "cat examples/demo/discount.js"
Enter
Sleep 2s

Type "node --test examples/demo/discount.test.js"
Enter
Sleep 3s

# Act 2: propcheck finds the bug
Type "npx propcheck infer --mock examples/demo/discount.js"
Enter
Sleep 6s

Type "npx propcheck run --quick examples/demo/discount.js"
Enter
Sleep 6s

# Act 3: Tagline
Type "echo ''"
Enter
Type "echo 'Your tests passed. Your code has bugs. propcheck finds them.'"
Enter
Sleep 3s
