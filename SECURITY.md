# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in agenteval, please report it responsibly.

**Do NOT open a public GitHub issue for security vulnerabilities.**

Instead, email: lukasxmetzler@gmail.com (or use GitHub's private vulnerability reporting if enabled)

## What Counts as a Security Issue

- Command injection via user-controlled input (task YAML, config, CLI args)
- Path traversal (reading/writing files outside the project directory)
- Arbitrary code execution in the eval runner
- Information disclosure (leaking secrets, env vars, or credentials)

## What Is NOT a Security Issue

- The eval runner intentionally spawns AI agents in each CLI's own non-interactive auto-approve mode, inside a git worktree under `.agenteval/worktrees/`. This is by design: an eval can't stop for permission prompts. The modes are `claude --permission-mode bypassPermissions`, `codex exec -s workspace-write`, `gemini --approval-mode yolo`, `agy --dangerously-skip-permissions`, `copilot --allow-all-tools`, `agent --force` (Cursor), `opencode run --auto`, and `devin --permission-mode dangerous`. agenteval adds no sandbox of its own. Apart from what the CLI's mode restricts (Codex's `workspace-write` sandbox, for example), the agent runs as your user and can reach what that user can. Run evals on a machine or CI runner where that is acceptable.
- The `harvest --live --analyze` judge runs `claude -p` with all tools disabled (`--tools ""`), so a diff that contains instructions aimed at the judge can't make it run commands or edit files.
- Lint rules reading instruction files -- these are the files the tool is designed to analyze

## Response Timeline

- Acknowledge within 48 hours
- Fix or mitigation within 7 days for critical issues
- Public disclosure after fix is released
