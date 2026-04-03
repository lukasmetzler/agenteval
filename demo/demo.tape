# agenteval demo recording
# Generate: vhs demo/demo.tape
# Requires: vhs, ffmpeg, ttyd

Output demo/demo.gif
Set Shell "bash"
Set FontSize 13
Set Width 1100
Set Height 750
Set Theme "Catppuccin Mocha"
Set Padding 16
Set TypingSpeed 20ms

# Setup
Hide
Type "alias agenteval='bun run src/cli.ts'"
Enter
Sleep 500ms
Show

# 1. Lint demo instruction files (shows 5 file types, errors + suggestions)
Type "agenteval lint -c demo/agenteval.yaml"
Enter
Sleep 4s

# 2. Doctor check (environment health)
Type "agenteval doctor"
Enter
Sleep 2.5s

# 3. Harvest dry-run (AI commit detection table)
Type "agenteval harvest --dry-run | head -22"
Enter
Sleep 3.5s

Sleep 1.5s
