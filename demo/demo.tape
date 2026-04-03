# agenteval demo recording
# Generate: vhs demo/demo.tape
# Requires: vhs, ffmpeg, ttyd

Output demo/demo.gif
Set Shell "bash"
Set FontSize 14
Set Width 1100
Set Height 700
Set Theme "Catppuccin Mocha"
Set Padding 20
Set TypingSpeed 25ms

# Setup
Hide
Type "alias agenteval='bun run src/cli.ts'"
Enter
Sleep 500ms
Show

# 1. Lint demo instruction files
Type "agenteval lint -c demo/agenteval.yaml"
Enter
Sleep 3.5s

# 2. Doctor check
Type "agenteval doctor"
Enter
Sleep 2.5s

# 3. Harvest dry-run table
Type "agenteval harvest --dry-run | head -25"
Enter
Sleep 3.5s

Sleep 2s
