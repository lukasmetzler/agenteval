# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in agenteval, please report it responsibly.

**Do NOT open a public GitHub issue for security vulnerabilities.**

Instead, email: lukas@lukasmetzler.com (or use GitHub's private vulnerability reporting if enabled)

## What Counts as a Security Issue

- Command injection via user-controlled input (task YAML, config, CLI args)
- Path traversal (reading/writing files outside the project directory)
- Arbitrary code execution in the eval runner
- Information disclosure (leaking secrets, env vars, or credentials)

## What Is NOT a Security Issue

- The eval runner intentionally spawns AI agents with `--dangerously-skip-permissions` -- this is by design for isolated worktree evaluation
- Lint rules reading instruction files -- these are the files the tool is designed to analyze

## Response Timeline

- Acknowledge within 48 hours
- Fix or mitigation within 7 days for critical issues
- Public disclosure after fix is released
