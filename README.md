# agenteval

A build system for AI coding instructions. Measures whether your CLAUDE.md, AGENTS.md, and copilot-instructions.md files actually make agents perform better.

[![CI](https://github.com/lukasmetzler/agenteval/actions/workflows/ci.yml/badge.svg)](https://github.com/lukasmetzler/agenteval/actions/workflows/ci.yml)

## Quick Start

```bash
# Run from source
bun install
bun run dev -- lint

# Or build a binary
bun run build
./agenteval lint
```

## Usage

```bash
# Lint instruction files in current directory (auto-discovers CLAUDE.md, AGENTS.md, etc.)
agenteval lint

# Lint specific files
agenteval lint "CLAUDE.md" ".claude/**/*.md"

# JSON output (for CI pipelines)
agenteval lint --format json

# Markdown report
agenteval lint --format markdown > report.md

# Only show errors (skip warnings and info)
agenteval lint --severity error

# Quiet mode (errors only, minimal output)
agenteval lint --quiet
```

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | No errors found |
| 1 | Lint errors detected |
| 2 | Runtime/configuration error |

## Lint Rules

| Rule | What it checks | Severity |
|------|---------------|----------|
| `token-count/file-too-large` | File exceeds token limit | warning |
| `token-count/section-heavy` | One section dominates the file | info |
| `overlap/high-similarity` | Cross-file content duplication | warning |
| `bloat/low-density` | Low information density in sections | warning |
| `bloat/filler-phrases` | Filler phrases detected | info |
| `anti-pattern/role-play` | "You are an expert..." preambles | warning |
| `anti-pattern/vague-instruction` | "Be careful", "write good code" | info |
| `anti-pattern/todo-in-instructions` | TODO/FIXME left in instructions | warning |
| `anti-pattern/meta-instruction` | "Read this carefully" | info |
| `anti-pattern/redundant-with-default` | Restating model defaults | info |
| `anti-pattern/time-sensitive` | Date-bound references | warning |
| `anti-pattern/contradictory-rules` | "Always X" + "Never X" | error |
| `anti-pattern/wall-of-text` | >500 word paragraphs | warning |
| `dead-ref/missing-file` | Referenced files don't exist | error |
| `dead-ref/broken-link` | Broken markdown links | warning |
| `context-budget/exceeded` | Total tokens over budget | error |
| `context-budget/near-limit` | >80% of budget used | warning |
| `skill/name-too-long` | Skill name >64 chars | error |
| `skill/name-invalid-chars` | Non-lowercase/number/hyphen chars | error |
| `skill/name-reserved-word` | Contains "anthropic" or "claude" | error |
| `skill/description-missing` | No description in frontmatter | error |
| `skill/description-first-person` | "I can..." in description | warning |
| `skill/description-second-person` | "You can..." in description | warning |
| `skill/body-too-long` | SKILL.md body >500 lines | warning |

## Inline Suppression

Suppress rules for the next section using HTML comments:

```markdown
<!-- agenteval-disable token-count -->
## This Section Won't Trigger Token Warnings

Large content here...

<!-- agenteval-disable -->
## This Section Suppresses All Rules
```

## Configuration

Create `agenteval.yaml` in your project root (optional, sensible defaults used if missing):

```yaml
version: 1

# Glob patterns for instruction files
instructionGlobs:
  - "CLAUDE.md"
  - "AGENTS.md"
  - ".github/copilot-instructions.md"
  - ".claude/**/*.md"

# Target model (determines context window size)
model: claude-sonnet-4-20250514

# Max fraction of context window for instructions
contextBudget: 0.3

lint:
  overlapThreshold: 0.3    # Jaccard similarity threshold
  bloatThreshold: 0.5      # Density score below this is flagged
  maxTokensPerFile: 8000   # Per-file token limit
  antiPatterns: []          # Additional regex patterns
  ignore:                   # Files to skip
    - "docs/archive/**"
```

## Token Counting

Token counts use OpenAI's cl100k_base tokenizer (via js-tiktoken) for offline speed. Counts are labeled as `~estimated` since Claude uses a different tokenizer (~10-15% variance). Exact counting via Anthropic API is planned for a future release.

## Roadmap

- **v0.1.0** (current): Static linter with 7 rule categories
- **v0.2.0** (planned): Eval runner with harness adapters (Claude Code, OpenCode)
- **v0.3.0** (planned): Git history mining for eval datasets

## Development

```bash
bun install          # install dependencies
bun test             # run all tests (102 tests)
bun run dev -- lint  # run CLI in dev mode
bun run build        # compile to binary
bun run check        # lint + typecheck + test
```

## License

MIT
