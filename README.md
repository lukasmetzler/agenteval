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

## Documentation

| Guide | What it covers |
|-------|---------------|
| [Core Concepts](docs/concepts.md) | The 5 key ideas (instructions, tasks, assertions, harnesses, scoring) in plain English |
| [Getting Started](docs/getting-started.md) | Installation, first run, overview of all features |
| [Linting Guide](docs/lint.md) | All 24 lint rules, output formats, CI integration, inline suppression |
| [Running Evals](docs/run.md) | Task definitions, harness adapters, scoring, the full eval pipeline |
| [Harvesting from Git History](docs/harvest.md) | AI commit detection, task generation, confidence tuning |
| [Results & Comparison](docs/results.md) | Viewing, filtering, exporting, and comparing eval runs |
| [Configuration Reference](docs/configuration.md) | Every config option with types, defaults, and examples |

## Commands

### `agenteval lint` — Static analysis

Analyze instruction files for quality issues without running any agents.

```bash
agenteval lint                          # Auto-discover and lint instruction files
agenteval lint "CLAUDE.md" ".claude/**" # Lint specific files
agenteval lint --format json            # JSON output for CI
agenteval lint --format markdown        # Markdown report
agenteval lint --severity error         # Only show errors
agenteval lint --quiet                  # Errors only, minimal output
```

### `agenteval run` — Eval runner

Run an AI coding agent against a task and measure the outcome.

```bash
agenteval run --task tasks/refactor.yaml             # Run from task YAML
agenteval run --task "refactor the auth module"      # Ad-hoc inline task
agenteval run --task refactor --harness claude-code  # Specify harness
agenteval run --task tasks/auth.yaml --harness mock  # Test with mock adapter
```

The runner creates an isolated git worktree, injects your instructions, spawns the agent, captures the git diff and test results, scores the outcome, and saves a structured result.

### `agenteval results` — View stored results

```bash
agenteval results                    # List all runs (table)
agenteval results --task auth        # Filter by task name
agenteval results --harness mock     # Filter by harness
agenteval results --export json      # Export as JSON
agenteval results --export markdown  # Export as markdown
agenteval results --prune            # Delete results older than retention period
```

### `agenteval harvest` — Mine git history for eval datasets

Scan your repo's git history for AI-involved commits and generate TaskDefinition YAML files.

```bash
agenteval harvest                              # Scan all commits, write YAML
agenteval harvest --dry-run                    # Preview detected commits
agenteval harvest --since 2025-01-01           # Filter by date
agenteval harvest --commit abc123              # Single commit mode
agenteval harvest --output tasks/harvested/    # Custom output directory
agenteval harvest --min-confidence 0.3         # Lower detection threshold
agenteval harvest --format json                # JSON output
agenteval harvest --harness claude-code        # Set harness in emitted tasks
agenteval harvest --github                     # Enrich with PR body/labels (requires gh CLI)
agenteval harvest --live                       # Review working tree changes against rubrics
agenteval harvest --live --analyze             # Include LLM-assisted rubrics (convention + scope)
```

Detects 14 AI coding tools via Co-authored-by trailers, author email patterns, and commit message patterns. Each method has a confidence score (0.6-0.9). Emitted YAML includes instruction snapshots (CLAUDE.md at commit time) and is compatible with `agenteval run --task`.

### `agenteval compare` — Compare instruction versions

```bash
agenteval compare run-A run-B                # Side-by-side console table
agenteval compare run-A run-B --format json  # Machine-readable JSON
agenteval compare run-A run-B --report       # Markdown report
```

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | No errors found / run successful |
| 1 | Lint errors detected / run failed |
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

## Harness Adapters

| Adapter | Harness | How it works |
|---------|---------|-------------|
| `claude-code` | Claude Code CLI | Spawns `claude --print --dangerously-skip-permissions` |
| `generic` | Any CLI agent | Configurable command + args in agenteval.yaml |
| `mock` | Testing | Deterministic file changes, no real agent |

## Task Definition

```yaml
# tasks/refactor-auth.yaml
name: refactor-auth
description: "Refactor auth to use structured logger"
prompt: "Replace console.log in src/auth/ with logger.info from src/utils/logger.ts"
harness: auto
timeout: 120

assertions:
  - type: files-changed
    pattern: "src/auth/**"
    expect: modified
  - type: files-unchanged
    pattern: "src/billing/**"
  - type: test-pass
    command: "bun test"
  - type: convention
    pattern: "logger\\.info"
    expect: present-in-changes

scoring:
  correctness: 0.4
  precision: 0.3
  efficiency: 0.2
  conventions: 0.1
```

## Inline Suppression

```markdown
<!-- agenteval-disable token-count -->
## This Section Won't Trigger Token Warnings

<!-- agenteval-disable -->
## This Section Suppresses All Rules
```

## Configuration

```yaml
# agenteval.yaml
version: 1

instructionGlobs:
  - "CLAUDE.md"
  - "AGENTS.md"
  - ".github/copilot-instructions.md"

model: claude-sonnet-4-20250514
contextBudget: 0.3

lint:
  overlapThreshold: 0.3
  bloatThreshold: 0.5
  maxTokensPerFile: 8000
  antiPatterns: []
  ignore:
    - "docs/archive/**"

run:
  timeout: 300
  tokensBudget: 50000
  resultsDir: ".agenteval/results"
  resultRetention: "90d"

harvest:
  outputDir: "tasks/harvested"
  minConfidence: 0.5
  defaultHarness: auto
  defaultTimeout: 300

harnesses:
  claude-code:
    command: "claude"
    args: ["--print", "--dangerously-skip-permissions"]
  my-custom-agent:
    command: "my-agent"
    args: ["--run"]
    instructionPath: "AGENTS.md"
```

## Token Counting

Token counts use OpenAI's cl100k_base tokenizer (via js-tiktoken) for offline speed. Counts are labeled as `~estimated` since Claude uses a different tokenizer (~10-15% variance).

## Roadmap

- **v0.1.x** (shipped): Static linter with 7 rule categories, 24 rules
- **v0.2.x** (shipped): Eval runner, harness adapters, result store, compare
- **v0.3.x** (shipped): Git history mining for eval datasets (`agenteval harvest`)
- **v0.4.x** (shipped): Live review mode, GitHub API enrichment, instruction snapshots
- **v0.5.0** (current): Snapshot-aware comparison, confidence scoring, LLM rubrics
- **v0.6.0** (planned): CI command, detector plugin registry

## Development

```bash
bun install          # install dependencies
bun test             # run all tests (301 tests)
bun run dev -- lint  # run CLI in dev mode
bun run build        # compile to binary
bun run check        # lint + typecheck + test
```

## License

MIT
