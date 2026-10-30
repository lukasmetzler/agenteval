# agenteval-cli

Your CLAUDE.md is untested. So is your AGENTS.md, your GEMINI.md, your copilot-instructions.md, and your Cursor rules.

agenteval is a linter, benchmarker, and CI gate for AI coding instructions. It finds dead references, token bloat, contradictions, and stale instructions before your agent does.

[![npm](https://img.shields.io/npm/v/agenteval-cli)](https://www.npmjs.com/package/agenteval-cli)
[![npm downloads](https://img.shields.io/npm/dm/agenteval-cli)](https://www.npmjs.com/package/agenteval-cli)
[![CI](https://github.com/lukasmetzler/agenteval/actions/workflows/ci.yml/badge.svg)](https://github.com/lukasmetzler/agenteval/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/lukasmetzler/agenteval/blob/main/LICENSE)

## Install

```bash
npm install -g agenteval-cli
```

Or run without installing:

```bash
npx -y agenteval-cli lint
```

This installs a small Node wrapper script (about 5 KB, Node 18+). On first run it downloads the prebuilt native binary for your platform from GitHub Releases to `~/.agenteval/bin/` and runs it; it downloads again when the package version changes. The package has no install script. Bun is not needed; Node runs only the wrapper.

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
- Filler phrases that waste context tokens ("in order to", "it is important to note that")
- Contradictory rules ("always X" and "never X" in the same file)
- Content overlap and duplication across multiple files
- Token budget overruns that crowd out code context
- Vague instructions without actionable specifics
- Stale instructions referencing code that was refactored weeks ago
- Broken markdown links and heading anchors
- Invalid skill metadata (per the Agent Skills spec) and wrong frontmatter on rules and subagents
- Commands that don't match the repo's package manager, scripts, or linters

## Supported Instruction Formats

- `CLAUDE.md` and `CLAUDE.local.md` (Claude Code), including nested `CLAUDE.md` files
- `AGENTS.md` (Codex, Copilot, Cursor, OpenCode, Amp, Devin, and other agents)
- `GEMINI.md` (Gemini CLI, Antigravity)
- `.claude/**` rules, skills, subagents, and slash commands (Claude Code)
- `.agents/skills/` (Agent Skills shared across tools)
- `.github/copilot-instructions.md` and `.github/instructions/**/*.instructions.md` (GitHub Copilot)
- `.cursor/rules/**/*.mdc` (Cursor)
- `.devin/rules/*.md` and `.windsurf/rules/*.md` (Devin / Windsurf)
- `.kiro/steering/*.md` (Kiro)
- `.junie/**/*.md` (JetBrains Junie)

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
model: claude-opus-5-5
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
