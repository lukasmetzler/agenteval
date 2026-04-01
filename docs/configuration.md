# Configuration Reference

agenteval works with zero configuration. When you need to customize behavior, create an `agenteval.yaml` file in your project root.

## Config File Location

agenteval searches for `agenteval.yaml` starting from the current directory, walking up to the root. The first one found is used. You can also specify a path explicitly:

```bash
agenteval lint --config path/to/agenteval.yaml
```

## Minimal Config

The only required field is `version`:

```yaml
version: 1
```

Everything else has sensible defaults.

## Full Config Example

```yaml
version: 1

# Which instruction files to lint (glob patterns)
instructionGlobs:
  - "CLAUDE.md"
  - "AGENTS.md"
  - ".github/copilot-instructions.md"
  - ".claude/**/*.md"
  - ".github/instructions/*.md"

# Explicit instruction sources (alternative to globs)
instructions:
  - path: "CLAUDE.md"
    harness: claude-code
  - path: "AGENTS.md"
    harness: generic

# Model for context budget calculations
model: claude-sonnet-4-20250514

# What fraction of the model's context window your instructions should use (0-1)
contextBudget: 0.3

# Lint settings
lint:
  overlapThreshold: 0.3       # Cross-file similarity threshold (0-1)
  bloatThreshold: 0.5         # Information density threshold (0-1)
  maxTokensPerFile: 8000      # Max tokens per instruction file
  maxTotalTokens: 50000       # Max tokens across all files (optional)
  antiPatterns: []             # Custom anti-pattern regexes
  ignore:                      # Glob patterns to exclude from linting
    - "docs/archive/**"

# Eval runner settings
run:
  timeout: 300                 # Default task timeout in seconds
  tokensBudget: 50000          # Token budget for eval runs
  resultsDir: ".agenteval/results"   # Where to store run results
  worktreesDir: ".agenteval/worktrees"  # Where to create git worktrees
  staleWorktreeMaxAge: 3600000  # Clean up worktrees older than this (ms)
  resultRetention: "90d"       # Auto-prune results older than this

# Harvest settings
harvest:
  outputDir: "tasks/harvested"  # Where to write harvested task YAML files
  minConfidence: 0.5            # Detection confidence threshold (0-1)
  defaultHarness: auto          # Harness field in generated tasks
  defaultTimeout: 300           # Timeout field in generated tasks

# Custom harness adapters
harnesses:
  claude-code:
    command: "claude"
    args: ["--print", "--dangerously-skip-permissions"]
  my-custom-agent:
    command: "my-agent"
    args: ["--run"]
    instructionPath: "AGENTS.md"
```

## Section Reference

### Top-Level Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `version` | `1` | Required | Config schema version. Always `1`. |
| `instructionGlobs` | string[] | see above | Glob patterns for auto-discovering instruction files. |
| `instructions` | object[] | `[]` | Explicit instruction file paths with optional harness binding. |
| `model` | string | `claude-sonnet-4-20250514` | Model name for context window calculations. |
| `contextBudget` | number | `0.3` | Fraction of model context to budget for instructions (0-1). |

### `lint` Section

Controls the behavior of `agenteval lint`.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `overlapThreshold` | number | `0.3` | Similarity score (0-1) above which two files are flagged as overlapping. Lower = stricter. |
| `bloatThreshold` | number | `0.5` | Information density (0-1) below which a section is flagged as bloated. Lower = more lenient. |
| `maxTokensPerFile` | number | `8000` | Maximum tokens per instruction file before a warning. |
| `maxTotalTokens` | number | none | Maximum total tokens across all files. If not set, uses `contextBudget * model context window`. |
| `antiPatterns` | string[] | `[]` | Custom regex patterns to flag. Each match produces a warning. |
| `ignore` | string[] | `[]` | Glob patterns for files to exclude from linting. |

### `run` Section

Controls the behavior of `agenteval run`.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `timeout` | number | `300` | Default timeout in seconds for eval runs. |
| `tokensBudget` | number | `50000` | Token budget for eval runs. |
| `resultsDir` | string | `.agenteval/results` | Directory for storing run result JSON files. |
| `worktreesDir` | string | `.agenteval/worktrees` | Directory for creating git worktrees. |
| `staleWorktreeMaxAge` | number | `3600000` | Age in milliseconds after which worktrees are cleaned up (default: 1 hour). |
| `resultRetention` | string | `90d` | How long to keep results before `--prune` deletes them. Format: `Nd` (e.g., `90d`, `30d`). |

### `harvest` Section

Controls the behavior of `agenteval harvest`.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `outputDir` | string | `tasks/harvested` | Directory for writing harvested task YAML files. |
| `minConfidence` | number | `0.5` | Minimum detection confidence (0-1). Commits below this are filtered out. |
| `defaultHarness` | string | `auto` | Harness field set in generated task files. |
| `defaultTimeout` | number | `300` | Timeout field set in generated task files. |

### `harnesses` Section

Define custom harness adapters. Each key is the harness name you reference in task files or `--harness` flags.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `command` | string | Yes | The CLI command to run (e.g., `claude`, `my-agent`) |
| `args` | string[] | No | Command-line arguments to pass |
| `instructionPath` | string | No | Override the instruction file path for this harness |

## Supported Models

Context window sizes used for budget calculations:

| Model | Context Window |
|-------|---------------|
| `claude-sonnet-4-20250514` | 200,000 |
| `claude-opus-4-20250514` | 200,000 |
| `claude-haiku-3-5-20241022` | 200,000 |
| `gpt-4o` | 128,000 |
| `gpt-4.1` | 1,000,000 |
| `o3` | 200,000 |
| `gemini-2.5-pro` | 1,000,000 |

Unknown models default to 200,000 tokens.

## Token Counting

Token counts use OpenAI's cl100k_base tokenizer (via js-tiktoken). Counts are labeled as `~estimated` because Claude uses a different tokenizer. Expect 10-15% variance. This is good enough for budget planning but not exact.

## Recommended .gitignore

Add to your `.gitignore`:

```
.agenteval/
tasks/harvested/
```

The `.agenteval/` directory contains run results and worktrees. Harvested task files are generated output. Both can be regenerated.

If you want to commit your harvested tasks (to share benchmarks with your team), remove the `tasks/harvested/` line.
