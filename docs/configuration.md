# Configuration Reference

## Overview

agenteval works with zero configuration out of the box. All commands use sensible defaults. When you need to customize behavior, create an `agenteval.yaml` file in your project root.

A [JSON Schema](https://raw.githubusercontent.com/lukasmetzler/agenteval/main/schema.json) is available for editor autocomplete. Add this comment to the top of your config file:

```yaml
# yaml-language-server: $schema=https://raw.githubusercontent.com/lukasmetzler/agenteval/main/schema.json
```

Or run `agenteval init` which includes the schema reference automatically.

## Config File Discovery

agenteval searches for `agenteval.yaml` starting from the current working directory and walking up the directory tree (up to 10 levels). The first file found is used.

To use a specific config file, pass it explicitly:

```bash
agenteval lint --config path/to/agenteval.yaml
agenteval run --config path/to/agenteval.yaml
agenteval harvest --config path/to/agenteval.yaml
```

## Minimal Configuration

The only required field is `version`:

```yaml
version: 1
```

All other fields have defaults. You only need to specify what you want to change.

## Complete Configuration

You don't need most of these options. The complete example below shows every available setting -- most have sensible defaults.

```yaml
version: 1

# ─── File Discovery ───────────────────────────────────────

# Glob patterns for auto-discovering instruction files to lint.
# These are scanned by `agenteval lint` when no arguments are provided.
instructionGlobs:
  - "CLAUDE.md"
  - "AGENTS.md"
  - ".github/copilot-instructions.md"
  - ".claude/**/*.md"
  - ".github/instructions/*.md"

# Explicit instruction file sources. Use this when different files
# should be associated with different harnesses.
instructions:
  - path: "CLAUDE.md"
    harness: claude-code          # optional: bind this file to a specific harness
  - path: "AGENTS.md"
    harness: generic

# ─── Model & Context Budget ───────────────────────────────

# Model name for context window calculations.
# Used by the context budget checker to determine token limits.
model: claude-sonnet-4-6

# What fraction of the model's context window your instruction
# files should consume (0.0 to 1.0).
# At 0.3, with a 200k context model, instruction files can use
# up to ~60,000 tokens total before triggering a warning.
contextBudget: 0.3

# ─── Lint Settings ────────────────────────────────────────

lint:
  # Cross-file similarity threshold.
  # Two files with similarity above this score trigger overlap/high-similarity.
  # Range: 0.0 (flag everything) to 1.0 (flag nothing). Default: 0.3
  overlapThreshold: 0.3

  # Information density threshold for sections.
  # Sections with density below this score trigger bloat/low-density.
  # Range: 0.0 (very lenient) to 1.0 (very strict). Default: 0.5
  bloatThreshold: 0.5

  # Maximum tokens per instruction file.
  # Files exceeding this trigger token-count/file-too-large.
  maxTokensPerFile: 8000

  # Maximum total tokens across ALL instruction files.
  # If not set, calculated as: model context window * contextBudget.
  # Set this to override the automatic calculation.
  # maxTotalTokens: 50000

  # Custom anti-pattern regex strings.
  # Each match triggers a warning with rule ID anti-pattern/custom.
  antiPatterns:
    - "DO NOT"                    # Aggressive phrasing often wastes tokens
    - "IMPORTANT:"                # Meta-instructions that models ignore

  # Glob patterns for files to EXCLUDE from linting.
  ignore:
    - "docs/archive/**"
    - "**/*.backup.md"

# ─── Run Settings ─────────────────────────────────────────

run:
  # Default timeout for eval runs (seconds).
  # Can be overridden per-task in the task YAML file.
  timeout: 300

  # Token budget for efficiency scoring.
  # The efficiency score measures: 1 - (tokensUsed / tokensBudget).
  tokensBudget: 50000

  # Directory for storing run result JSON files.
  resultsDir: ".agenteval/results"

  # Directory for creating temporary git worktrees.
  worktreesDir: ".agenteval/worktrees"

  # Maximum age of a worktree before automatic cleanup (milliseconds).
  # Default: 3600000 (1 hour). Stale worktrees from crashed runs are
  # cleaned up on the next agenteval run invocation.
  staleWorktreeMaxAge: 3600000

  # How long to keep result files before `agenteval results --prune`
  # deletes them. Format: <number>d (e.g., "90d", "30d", "365d").
  resultRetention: "90d"

# ─── Harvest Settings ─────────────────────────────────────

harvest:
  # Directory where harvested task YAML files are written.
  outputDir: "tasks/harvested"

  # Minimum detection confidence for including a commit (0.0 to 1.0).
  # co-author-tag = 0.9, author-email = 0.8, message-pattern = 0.6.
  # Default 0.5 includes all co-author and email matches, filters most message-only.
  minConfidence: 0.5

  # Harness field set in generated task YAML files.
  # Options: claude-code, opencode, copilot, generic, auto
  defaultHarness: auto

  # Timeout field set in generated task YAML files (seconds).
  defaultTimeout: 300

# ─── Live Review ─────────────────────────────────────────

liveReview:
  rubrics:
    scopeDiscipline:
      enabled: true
      weight: 1.0
    testCoverage:
      enabled: true
      weight: 1.0
    diffHygiene:
      enabled: true
      weight: 1.0
    conventionCompliance:
      enabled: true
      weight: 1.5          # Higher weight for convention checking
    progressiveDisclosure:
      enabled: true
      weight: 1.0

# ─── CI Settings ─────────────────────────────────────────

ci:
  # Directory containing task YAML files to run.
  tasksDir: "tasks/harvested"

  # Minimum acceptable score (0-1). Tasks scoring below this fail.
  minScore: 0.5

  # Maximum allowed score regression vs the previous run (0-1).
  # If a task's score drops more than this compared to its last run, it fails.
  maxRegression: 0.1

  # Instruction file to inject for all tasks.
  instructions: "CLAUDE.md"

# ─── Harness Adapters ─────────────────────────────────────

# Custom harness configurations.
# Each key is a harness name you can reference with --harness or in task YAML.
harnesses:
  # Override the built-in Claude Code adapter settings
  claude-code:
    command: "claude"
    args: ["--print", "--dangerously-skip-permissions"]

  # Define a custom harness for any CLI tool
  my-custom-agent:
    command: "my-agent"
    args: ["--run", "--non-interactive", "--timeout", "120"]
    instructionPath: "AGENTS.md"    # Override which instruction file is injected
```

## Field Reference

### Top-Level Fields

| Field | Type | Default | Validation | Description |
|-------|------|---------|------------|-------------|
| `version` | integer | **required** | Must be `1` | Config schema version. |
| `instructionGlobs` | string[] | `["CLAUDE.md", "AGENTS.md", ...]` | | Glob patterns for instruction file discovery. |
| `instructions` | object[] | `[]` | Each must have `path` | Explicit instruction sources with optional harness binding. |
| `model` | string | `claude-sonnet-4-6` | | Model name for context window lookup. |
| `contextBudget` | number | `0.3` | 0.0-1.0 | Fraction of context window budgeted for instructions. |

### `lint` Section

| Field | Type | Default | Validation | Description |
|-------|------|---------|------------|-------------|
| `overlapThreshold` | number | `0.3` | 0.0-1.0 | Similarity score above which two files are flagged as overlapping. |
| `bloatThreshold` | number | `0.5` | 0.0-1.0 | Information density below which sections are flagged as bloated. |
| `maxTokensPerFile` | number | `8000` | | Token limit per file before a warning is emitted. |
| `maxTotalTokens` | number | none | | Hard token limit across all files. Overrides `contextBudget * window`. |
| `antiPatterns` | string[] | `[]` | Valid regex | Custom regex patterns. Each match in any instruction file produces a warning. |
| `ignore` | string[] | `[]` | Valid glob | Glob patterns for files to exclude from linting. |

### `run` Section

| Field | Type | Default | Validation | Description |
|-------|------|---------|------------|-------------|
| `timeout` | number | `300` | >= 1 | Default task timeout in seconds. |
| `tokensBudget` | number | `50000` | | Token budget used for efficiency score calculation. |
| `resultsDir` | string | `.agenteval/results` | | Directory for result JSON files. |
| `worktreesDir` | string | `.agenteval/worktrees` | | Directory for temporary git worktrees. |
| `staleWorktreeMaxAge` | number | `3600000` | | Worktree age threshold for cleanup (milliseconds). |
| `resultRetention` | string | `90d` | Format: `<N>d` | How long to keep results before pruning. |

### `harvest` Section

| Field | Type | Default | Validation | Description |
|-------|------|---------|------------|-------------|
| `outputDir` | string | `tasks/harvested` | | Directory for generated task YAML files. |
| `minConfidence` | number | `0.5` | 0.0-1.0 | Detection confidence threshold. |
| `defaultHarness` | string | `auto` | Valid harness name | Harness field in generated tasks. |
| `defaultTimeout` | number | `300` | >= 1 | Timeout field in generated tasks (seconds). |

### `ci` Section

| Field | Type | Default | Validation | Description |
|-------|------|---------|------------|-------------|
| `tasksDir` | string | `tasks/harvested` | | Directory containing task YAML files to run. |
| `minScore` | number | `0.5` | 0.0-1.0 | Minimum acceptable score. Tasks below this fail. |
| `maxRegression` | number | `0.1` | 0.0-1.0 | Maximum allowed score drop vs previous run. |
| `instructions` | string | `CLAUDE.md` | | Instruction file to inject for all tasks. |

### `liveReview` Section

Controls the `harvest --live` rubric system.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `rubrics.scopeDiscipline.enabled` | boolean | `true` | Enable scope-discipline rubric. |
| `rubrics.scopeDiscipline.weight` | number | `1.0` | Weight in overall score calculation. |
| `rubrics.testCoverage.enabled` | boolean | `true` | Enable test-coverage rubric. |
| `rubrics.testCoverage.weight` | number | `1.0` | Weight in overall score calculation. |
| `rubrics.diffHygiene.enabled` | boolean | `true` | Enable diff-hygiene rubric. |
| `rubrics.diffHygiene.weight` | number | `1.0` | Weight in overall score calculation. |
| `rubrics.conventionCompliance.enabled` | boolean | `true` | Enable LLM convention-compliance rubric (requires `--analyze`). |
| `rubrics.conventionCompliance.weight` | number | `1.0` | Weight in overall score calculation. |
| `rubrics.progressiveDisclosure.enabled` | boolean | `true` | Enable LLM progressive-disclosure rubric (requires `--analyze`). |
| `rubrics.progressiveDisclosure.weight` | number | `1.0` | Weight in overall score calculation. |

Disabled rubrics are excluded from results and the weighted average. The `conventionCompliance` and `progressiveDisclosure` rubrics only run when `--analyze` is passed, regardless of their `enabled` setting.

### `harnesses` Section

Each key under `harnesses` defines a custom harness adapter:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `command` | string | Yes | The CLI executable to run. Must be on PATH or an absolute path. |
| `args` | string[] | No | Command-line arguments passed to the executable. |
| `instructionPath` | string | No | Override which instruction file is injected for this harness. |

## Supported Models

The model field determines the context window size used for budget calculations:

| Model ID | Context Window | Provider |
|----------|---------------|----------|
| `claude-opus-4-6` | 1,000,000 | Anthropic |
| `claude-sonnet-4-6` | 200,000 | Anthropic |
| `claude-haiku-4-5` | 200,000 | Anthropic |
| `gpt-5.4` | 1,000,000 | OpenAI |
| `gpt-5.3` | 1,000,000 | OpenAI |
| `gpt-5.3-codex` | 1,000,000 | OpenAI |
| `gemini-3.1` | 2,000,000 | Google |
| `gemini-2.5-pro` | 1,000,000 | Google |

Legacy models (`claude-sonnet-4-6`, `claude-opus-4-20250514`, `gpt-4o`, `gpt-4.1`, `o3`) are still recognized for backward compatibility.

Models not in this table default to 200,000 tokens. Set the `model` field to any string and the context budget calculator will use 200,000 as the window size.

## Token Counting

Token counts throughout agenteval use the `cl100k_base` tokenizer from OpenAI (via the `js-tiktoken` library). This is an offline tokenizer that runs locally.

Since Claude uses a different tokenizer internally, counts are approximate. Expect 10-15% variance. Tokens are always displayed with a `~` prefix to indicate they are estimates.

This approximation is intentional: offline speed matters more than exact accuracy for linting and budget planning. The linter's job is to catch files that are clearly too large, not to count exact tokens.

## Precedence

When the same setting can be specified in multiple places, this precedence order applies:

```
CLI flags  >  agenteval.yaml  >  built-in defaults
```

For example:
- `--min-confidence 0.3` overrides `harvest.minConfidence: 0.5` in the config
- `--timeout 600` overrides `run.timeout: 300` in the config
- Task YAML `timeout: 120` overrides the default but the CLI `--timeout` is not used for run

## Recommended .gitignore

```
# agenteval working directories
.agenteval/

# Generated task files (optional: commit if sharing benchmarks)
# tasks/harvested/
```

The `.agenteval/` directory contains run results and temporary worktrees. Both can be regenerated.

If you want to share harvested tasks with your team (as a shared benchmark suite), remove the `tasks/harvested/` line from `.gitignore` and commit the YAML files.
