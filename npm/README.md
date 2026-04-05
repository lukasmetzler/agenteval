# agenteval-cli

Your CLAUDE.md is untested. So is your AGENTS.md, your copilot-instructions.md, and your .cursorrules.

agenteval is a linter, benchmarker, and CI gate for AI coding instructions. It finds dead references, token bloat, contradictions, and stale instructions before your agent does.

[![npm](https://img.shields.io/npm/v/agenteval-cli)](https://www.npmjs.com/package/agenteval-cli)
[![CI](https://github.com/lukasmetzler/agenteval/actions/workflows/ci.yml/badge.svg)](https://github.com/lukasmetzler/agenteval/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/lukasmetzler/agenteval/blob/main/LICENSE)

## Install

```bash
npm install -g agenteval-cli
```

Or run without installing:

```bash
npx agenteval-cli lint
```

This installs a lightweight wrapper (~3 KB) that downloads the prebuilt native binary for your platform on first run. No Bun or Node runtime needed at execution time.

### Supported Platforms

| Platform | Architecture |
|----------|-------------|
| Linux | x64 |
| macOS | ARM64 (Apple Silicon) |
| macOS | x64 (Intel) |

## Usage

```bash
# Lint your instruction files (CLAUDE.md, AGENTS.md, etc.)
agenteval lint

# Show why each rule matters
agenteval lint --explain

# Preview AI commits in your git history
agenteval harvest --dry-run

# Run all eval tasks, fail on regressions (for CI)
agenteval ci

# Score history and trends
agenteval trends

# Self-update to the latest version
agenteval update
```

## What It Catches

- Dead references to files that don't exist in your repo
- Filler phrases that waste context tokens ("make sure to", "it is important that")
- Contradictions between instruction files
- Content overlap and duplication across multiple files
- Token budget overruns that crowd out code context
- Vague instructions without actionable specifics
- Stale instructions referencing code that was refactored weeks ago
- Broken markdown links and heading anchors
- Invalid skill metadata (per Anthropic spec)

## Supported Instruction Formats

- `CLAUDE.md` (Claude Code)
- `AGENTS.md` (OpenAI Codex, generic agents)
- `.github/copilot-instructions.md` (GitHub Copilot)
- `.github/instructions/*.instructions.md` (scoped Copilot instructions)
- `.claude/skills/*/SKILL.md` (Anthropic skills)
- `.cursorrules` and `.cursor/rules/*.mdc` (Cursor)

## CI Integration

Use as a GitHub Action:

```yaml
- uses: lukasmetzler/agenteval@v0
  with:
    command: lint
```

Or run the CLI directly:

```bash
agenteval ci --min-score 0.7 --max-regression 0.05
```

## Configuration

agenteval works with zero configuration. To customize, create an `agenteval.yaml`:

```yaml
version: 1
model: claude-sonnet-4-6
contextBudget: 0.3
lint:
  maxTokensPerFile: 8000
  overlapThreshold: 0.3
  bloatThreshold: 0.5
```

## Alternative Install Methods

| Method | Command |
|--------|---------|
| Homebrew | `brew tap lukasmetzler/agenteval && brew install agenteval` |
| Shell | `curl -fsSL https://raw.githubusercontent.com/lukasmetzler/agenteval/main/install.sh \| bash` |
| Binary | [GitHub Releases](https://github.com/lukasmetzler/agenteval/releases) |

## Documentation

Full docs, guides, and examples at [github.com/lukasmetzler/agenteval](https://github.com/lukasmetzler/agenteval).

## License

MIT
