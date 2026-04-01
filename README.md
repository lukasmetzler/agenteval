# agenteval

A build system for AI coding instructions. Measures whether your CLAUDE.md, AGENTS.md, and copilot-instructions.md files actually make agents perform better.

## Status

Early development. Phase 1 (static linter) in progress.

## Quick Start

```bash
# Install
bun install -g agenteval

# Lint instruction files in current directory
agenteval lint

# JSON output for CI
agenteval lint --format json

# Markdown report
agenteval lint --format markdown > report.md
```

## What It Does

**Phase 1 (current):** Static analysis of AI coding instruction files.
- Token counting per file and section (~estimated via cl100k_base)
- Cross-file overlap detection (n-gram Jaccard similarity)
- Information density scoring (bloat detection)
- Anti-pattern checking (7 built-in patterns)
- Dead reference detection (broken file paths and links)
- Context budget checking (total tokens vs model window)
- Inline suppression via `<!-- agenteval-disable rule-id -->`

**Phase 2 (planned):** Eval runner — run tasks through harnesses (Claude Code, OpenCode, Copilot), measure outcomes.

**Phase 3 (planned):** Git history mining — use merged PRs as eval datasets.

## Development

```bash
bun install
bun test
bun run dev -- lint
bun run build
```

## License

MIT
