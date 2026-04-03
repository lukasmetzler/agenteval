# agenteval demo recording
# Generate GIF: vhs demo/demo.tape
# Requires: vhs, ffmpeg, ttyd

Output demo/demo.gif
Set Shell "bash"
Set FontSize 14
Set Width 1100
Set Height 650
Set Theme "Catppuccin Mocha"
Set Padding 20
Set TypingSpeed 30ms

# Setup: alias for cleaner output
Hide
Type "alias agenteval='bun run src/cli.ts'"
Enter
Sleep 500ms
Show

# Lint demo instruction files
Type "agenteval lint -c demo/agenteval.yaml"
Enter
Sleep 3s

# Doctor check
Type "agenteval doctor"
Enter
Sleep 2.5s

# Harvest dry-run (show AI commit detection)
Type "agenteval harvest --dry-run | head -20"
Enter
Sleep 3s

Sleep 1.5s
