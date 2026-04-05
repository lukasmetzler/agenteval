# agenteval-cli

Your CLAUDE.md is untested. So is your AGENTS.md, your copilot-instructions.md, and your .cursorrules. agenteval is a linter, benchmarker, and CI gate for AI coding instructions. Stop hoping your instructions work. Measure it.

[![Version](https://img.shields.io/npm/v/agenteval-cli)](https://www.npmjs.com/package/agenteval-cli)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/lukasmetzler/agenteval/blob/main/LICENSE)

## Install

```bash
npm install -g agenteval-cli
```

Or run without installing:

```bash
npx agenteval-cli lint
```

This package downloads the prebuilt binary for your platform during install. No Bun or Node runtime needed at execution time.

### Supported platforms

- Linux x64
- macOS ARM64 (Apple Silicon)
- macOS x64 (Intel)

## Usage

```bash
# Lint your instruction files
agenteval lint

# See what AI commits are in your git history
agenteval harvest --dry-run

# Run all tasks, fail on regressions (CI mode)
agenteval ci

# Score history and trends
agenteval trends

# Self-update to latest version
agenteval update
```

## What it catches

- Dead references to files that don't exist
- Filler phrases that waste context tokens
- Contradictions between instruction files
- Content overlap and duplication
- Token budget overruns
- Vague instructions without specifics
- Broken markdown links and heading anchors
- Invalid skill metadata (per Anthropic spec)
- Stale instructions referencing refactored code

## Supported instruction formats

- `CLAUDE.md` (Claude Code)
- `AGENTS.md` (OpenAI Codex, generic agents)
- `.github/copilot-instructions.md` (GitHub Copilot)
- `.github/instructions/*.instructions.md` (scoped Copilot instructions)
- `.claude/skills/*/SKILL.md` (Anthropic skills)
- `.cursorrules` and `.cursor/rules/*.mdc` (Cursor)

## Alternative install methods

- **Homebrew**: `brew tap lukasmetzler/agenteval && brew install agenteval`
- **Curl**: `curl -fsSL https://raw.githubusercontent.com/lukasmetzler/agenteval/main/install.sh | bash`
- **GitHub Action**: `uses: lukasmetzler/agenteval@v0`
- **Binary**: [GitHub Releases](https://github.com/lukasmetzler/agenteval/releases)

## Documentation

Full docs at [github.com/lukasmetzler/agenteval](https://github.com/lukasmetzler/agenteval#readme).

## License

MIT
