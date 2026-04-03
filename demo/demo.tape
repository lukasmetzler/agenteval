# agenteval demo — lint, doctor, harvest
# Record: vhs demo/demo.tape

Output demo/demo.gif
Set Shell "bash"
Set FontSize 14
Set Width 1200
Set Height 750
Set Theme "Catppuccin Mocha"
Set Padding 24
Set TypingSpeed 15ms
Set CursorBlink false

# Setup
Hide
Type "alias agenteval='bun run src/cli.ts'"
Enter
Sleep 500ms
Type "clear"
Enter
Sleep 300ms
Show

# ── Lint: find real problems in instruction files ──
Type "# Find quality issues across CLAUDE.md, copilot-instructions, skills..."
Enter
Sleep 500ms
Type "agenteval lint -c demo/agenteval.yaml"
Enter
Sleep 4s

# ── Doctor: check environment health ──
Type "# Verify environment is ready"
Enter
Sleep 500ms
Type "agenteval doctor"
Enter
Sleep 2.5s

# ── Harvest: detect AI commits in git history ──
Type "# Detect AI-assisted commits and build eval benchmarks"
Enter
Sleep 500ms
Type "agenteval harvest --dry-run | head -24"
Enter
Sleep 3.5s

Sleep 1.5s
