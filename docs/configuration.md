# Configuration Reference

## Overview

agenteval works with zero configuration out of the box. All commands use sensible defaults. When you need to customize behavior, create an `agenteval.yaml` file in your project root (`agenteval init` writes a starter file).

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
# The default (shown) covers every format agenteval knows; set this only to narrow it.
instructionGlobs:
  - "**/CLAUDE.md"
  - "CLAUDE.local.md"
  - "**/AGENTS.md"
  - "**/GEMINI.md"
  - ".claude/**/*.md"
  - ".agents/skills/**/*.md"
  - ".github/copilot-instructions.md"
  - ".github/instructions/**/*.instructions.md"
  - ".cursor/rules/**/*.{md,mdc}"
  - ".devin/rules/*.md"
  - ".windsurf/rules/*.md"
  - ".kiro/steering/*.md"
  - ".junie/**/*.md"

# ─── Model & Context Budget ───────────────────────────────

# Model name for context window calculations.
# Used by the context budget checker to determine token limits.
model: claude-opus-5-5

# What fraction of the model's context window your instruction
# files should consume (0.0 to 1.0).
# At 0.3, with a 1M context model, the files loaded at session start
# (plus their @imports) can use up to ~300,000 tokens before an error.
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

  # Custom anti-pattern regex strings (case-insensitive).
  # Each match triggers a warning with rule ID anti-pattern/custom-0,
  # anti-pattern/custom-1, ... in list order.
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
  # Used by every task that sets no `timeout` of its own.
  timeout: 300

  # Token count that scores 0 on efficiency. Not passed to the agent.
  # efficiency = 1 - (tokensTotal - tokensCacheRead) / tokensBudget, clamped to 0..1.
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
  # co-author or session trailer = 0.9, agent's own account = 0.8,
  # message pattern = 0.6. The default 0.5 includes all three; any value
  # from 0 to 0.6 selects the same commits.
  minConfidence: 0.5

  # Harness field set in generated task YAML files.
  # A built-in harness (claude-code, codex, gemini, antigravity, copilot,
  # cursor, opencode, devin, amp), a harnesses: key, or auto.
  # auto is resolved when the task runs, not when it is harvested.
  defaultHarness: auto

  # Timeout field set in generated task YAML files (seconds).
  defaultTimeout: 300

# ─── Live Review ─────────────────────────────────────────

liveReview:
  # Model for the --analyze rubrics: a Claude Code alias or a full model id.
  judgeModel: sonnet
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
    lintDelta:             # repo linters on the changed lines
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

  # Maximum allowed score regression vs the previous run (0-1), in score
  # points: 0.1 means 0.80 -> 0.69 fails. Not a percentage.
  maxRegression: 0.1

  # Instruction file to inject for all tasks.
  instructions: "CLAUDE.md"

# ─── Harness Adapters ─────────────────────────────────────

# Custom harness configurations.
# Each key is a harness name you can reference with --harness or in task YAML.
# The prompt is appended as the last argument.
harnesses:
  my-custom-agent:
    command: "my-agent"
    args: ["--run", "--non-interactive"]
    instructionPath: "AGENTS.md"    # where the instruction file is copied (default AGENTS.md)
```

A `harnesses:` key with a built-in name (for example `claude-code`) replaces the built-in adapter with this generic one: the prompt goes in as the last argument, the instruction file is copied to `instructionPath` (default `AGENTS.md`, not `CLAUDE.md`), and tokens are read only from a Claude-Code-style result event or text like `total tokens: 1234`. You lose the built-in flags and metric parsing, so only do this on purpose.

## Field Reference

### Top-Level Fields

| Field | Type | Default | Validation | Description |
|-------|------|---------|------------|-------------|
| `version` | integer | **required** | Must be `1` | Config schema version. |
| `instructionGlobs` | string[] | every known format (see [Auto-Discovery](lint.md#auto-discovery)) | | Glob patterns for instruction file discovery. |
| `instructions` | object[] | `[]` | Each must have `path` | Unused. Still accepted so older config files parse; it has no effect. Use `--instructions` on `run`/`ci` or `ci.instructions`. |
| `model` | string | `claude-opus-5-5` | | Model name for context window lookup. |
| `contextBudget` | number | `0.3` | 0.0-1.0 | Fraction of context window budgeted for instructions. |

### `lint` Section

| Field | Type | Default | Validation | Description |
|-------|------|---------|------------|-------------|
| `overlapThreshold` | number | `0.3` | 0.0-1.0 | Similarity score above which two files are flagged as overlapping. |
| `bloatThreshold` | number | `0.5` | 0.0-1.0 | Information density below which sections are flagged as bloated. |
| `maxTokensPerFile` | number | `8000` | | Token limit per file before a warning is emitted. |
| `maxTotalTokens` | number | none | | Token limit for everything loaded at session start (root files, rules without `paths`, and their `@imports`). Overrides `contextBudget * window`. |
| `antiPatterns` | string[] | `[]` | Valid regex | Custom regex patterns, matched case-insensitively. Each match produces a warning with rule ID `anti-pattern/custom-<index>` (`custom-0` for the first pattern). Invalid patterns are dropped silently. |
| `ignore` | string[] | `[]` | Valid glob | Glob patterns for files to exclude from linting. `node_modules`, `.git`, `dist`, and `.agenteval` are always excluded. |

### `run` Section

| Field | Type | Default | Validation | Description |
|-------|------|---------|------------|-------------|
| `timeout` | number | `300` | >= 1 | Agent timeout in seconds for tasks that set no `timeout` of their own (ad-hoc tasks included). |
| `tokensBudget` | number | `50000` | | Denominator of the efficiency score: `1 - (tokensTotal - tokensCacheRead) / tokensBudget`, clamped to 0..1. Not passed to the agent. |
| `resultsDir` | string | `.agenteval/results` | | Directory for result JSON files. |
| `worktreesDir` | string | `.agenteval/worktrees` | | Directory for temporary git worktrees. |
| `staleWorktreeMaxAge` | number | `3600000` | | Worktree age threshold for cleanup (milliseconds). |
| `resultRetention` | string | `90d` | Format: `<N>d` (days only) | How long to keep results before `results --prune` deletes them. |

### `harvest` Section

| Field | Type | Default | Validation | Description |
|-------|------|---------|------------|-------------|
| `outputDir` | string | `tasks/harvested` | | Directory for generated task YAML files. |
| `minConfidence` | number | `0.5` | 0.0-1.0 | Detection confidence threshold. Signals score 0.9, 0.8, or 0.6, so values from 0 to 0.6 behave the same. |
| `defaultHarness` | string | `auto` | Valid harness name | Harness field in generated tasks. `auto` is resolved at run time. |
| `defaultTimeout` | number | `300` | >= 1 | Timeout field in generated tasks (seconds). |

### `ci` Section

| Field | Type | Default | Validation | Description |
|-------|------|---------|------------|-------------|
| `tasksDir` | string | `tasks/harvested` | | Directory containing task files to run. Only `*.yaml` files directly in it are read. |
| `minScore` | number | `0.5` | 0.0-1.0 | Minimum acceptable score. Tasks below this fail. |
| `maxRegression` | number | `0.1` | 0.0-1.0 | Maximum allowed score drop vs previous run, in score points. |
| `instructions` | string | `CLAUDE.md` | | Instruction file to inject for all tasks. |

### `liveReview` Section

Controls the `harvest --live` rubric system.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `judgeModel` | string | `sonnet` | Model for the `--analyze` rubrics. A Claude Code alias tracks the current model of that tier. |
| `rubrics.scopeDiscipline.enabled` | boolean | `true` | Enable scope-discipline rubric. |
| `rubrics.scopeDiscipline.weight` | number | `1.0` | Weight in overall score calculation. |
| `rubrics.testCoverage.enabled` | boolean | `true` | Enable test-coverage rubric. |
| `rubrics.testCoverage.weight` | number | `1.0` | Weight in overall score calculation. |
| `rubrics.diffHygiene.enabled` | boolean | `true` | Enable diff-hygiene rubric. |
| `rubrics.diffHygiene.weight` | number | `1.0` | Weight in overall score calculation. |
| `rubrics.lintDelta.enabled` | boolean | `true` | Enable the lint-delta rubric (detected linters on changed lines). |
| `rubrics.lintDelta.weight` | number | `1.0` | Weight in overall score calculation. |
| `rubrics.conventionCompliance.enabled` | boolean | `true` | Enable LLM convention-compliance rubric (requires `--analyze`). |
| `rubrics.conventionCompliance.weight` | number | `1.0` | Weight in overall score calculation. |
| `rubrics.progressiveDisclosure.enabled` | boolean | `true` | Enable LLM progressive-disclosure rubric (requires `--analyze`). |
| `rubrics.progressiveDisclosure.weight` | number | `1.0` | Weight in overall score calculation. |

Disabled rubrics are excluded from results and the weighted average. The `conventionCompliance` and `progressiveDisclosure` rubrics only run when `--analyze` is passed, regardless of their `enabled` setting.

### `harnesses` Section

Each key under `harnesses` defines a custom harness adapter that passes the prompt as its last argument. A key with a built-in name (for example `codex`) replaces the built-in with this generic adapter, including its `AGENTS.md` default for `instructionPath`. See [Harnesses](harnesses.md#custom-harnesses).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `command` | string | Yes | The CLI executable to run. Must be on PATH or an absolute path. |
| `args` | string[] | No | Command-line arguments passed to the executable. |
| `instructionPath` | string | No | Where the instruction file is copied in the worktree. Default `AGENTS.md`. |

## Supported Models

The model field determines the context window size used for budget calculations. Claude values come from the Claude API model table as of 2026-10-06.

| Model ID | Context Window | Provider |
|----------|---------------|----------|
| `claude-fable-5-1`, `claude-fable-5` | 1,000,000 | Anthropic |
| `claude-opus-5-5`, `claude-opus-5` | 1,000,000 | Anthropic |
| `claude-sonnet-5-5`, `claude-sonnet-5` | 1,000,000 | Anthropic |
| `claude-haiku-5-5` | 1,000,000 | Anthropic |
| `claude-opus-4-8`, `claude-opus-4-7`, `claude-opus-4-6` | 1,000,000 | Anthropic |
| `claude-sonnet-4-6` | 1,000,000 | Anthropic |
| `claude-haiku-4-5` | 200,000 | Anthropic |
| `fable`, `opus`, `sonnet`, `haiku` (Claude Code aliases) | 1,000,000 | Anthropic |
| `gpt-5.4`, `gpt-5.3`, `gpt-5.3-codex`, `gpt-4.1` | 1,000,000 | OpenAI |
| `gpt-4o` | 128,000 | OpenAI |
| `o3` | 200,000 | OpenAI |
| `gemini-3.1` | 2,000,000 | Google |
| `gemini-2.5-pro` | 1,000,000 | Google |

The OpenAI and Google entries have not been rechecked since v0.8.

Models not in this table use a 200,000-token window, and lint reports `context-budget/unknown-model` so the fallback isn't silent. Set `lint.maxTotalTokens` for a model that isn't listed.

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
- `--min-confidence 0.8` overrides `harvest.minConfidence: 0.5` in the config
- `harvest --timeout 600` overrides `harvest.defaultTimeout` for the emitted task files
- The agent timeout for a run is the task's `timeout` if set, else `run.timeout` (default 300). `run` and `ci` have no `--timeout` flag.

## Recommended .gitignore

```
# agenteval working directories
.agenteval/

# Generated task files (optional: commit if sharing benchmarks)
# tasks/harvested/
```

The `.agenteval/` directory contains run results and temporary worktrees. Both can be regenerated.

If you want to share harvested tasks with your team (as a shared benchmark suite), remove the `tasks/harvested/` line from `.gitignore` and commit the YAML files.
