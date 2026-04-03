# Harvesting from Git History

## Overview

The `harvest` command scans your repository's git history for commits that involved AI coding tools, then generates task definition YAML files from those commits. The merged diff serves as "ground truth" for what a correct result looks like, letting you build eval benchmarks from real work instead of synthetic test cases.

This is the bridge between your team's actual AI-assisted development and measurable instruction quality. Every AI commit becomes a replayable benchmark: change your instruction files, re-run the harvested tasks, and measure whether the agent performs better or worse.

## When to Use Harvest

| Scenario | What harvest does for you |
|----------|--------------------------|
| Setting up agenteval for the first time | Generates an initial eval dataset from your existing AI work |
| After changing your CLAUDE.md or AGENTS.md | Provides real tasks to test whether your changes improved agent performance |
| Understanding your team's AI usage | `--dry-run` shows which commits were AI-involved, how many, and by which tools |
| Building regression tests for instruction quality | Harvested tasks become a benchmark suite you run after every instruction change |
| Comparing AI tools | Run the same harvested tasks with different harnesses to compare Claude Code vs Copilot vs Cursor |

## Command Reference

```
agenteval harvest [options]
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--since <date>` | string | entire history | Only scan commits after this date. Accepts any format git understands: `2025-01-01`, `3.months.ago`, `last-monday`. |
| `--until <date>` | string | now | Only scan commits before this date. Same date formats as `--since`. |
| `--commit <hash>` | string | | Scan a single commit. Takes precedence over `--since`/`--until`. Accepts full or short hashes. |
| `--output <dir>` | string | `tasks/harvested` | Directory where task YAML files are written. Created automatically if it doesn't exist. |
| `--dry-run` | boolean | `false` | List detected commits and what would be generated, without writing any files. Use this first to preview results. |
| `--force` | boolean | `false` | Overwrite existing task files. By default, if `harvest-abc123d.yaml` already exists, it is skipped. |
| `--format <type>` | string | `yaml` | Output format. `yaml` writes task files to disk. `json` prints a structured result object to stdout (for scripting). |
| `--harness <name>` | string | `auto` | Sets the `harness` field in every generated task file. Options: `claude-code`, `opencode`, `copilot`, `generic`, `auto`. |
| `--timeout <seconds>` | integer | `300` | Sets the `timeout` field in every generated task file. |
| `--min-confidence <n>` | float | `0.5` | Minimum detection confidence threshold (0.0 to 1.0). Lower values find more commits but increase false positives. |
| `--github` | boolean | `false` | Enrich tasks with PR body, URL, and labels from GitHub. Requires `gh` CLI authenticated via `gh auth login`. |
| `--live` | boolean | `false` | Review current working tree changes against heuristic rubrics instead of mining git history. See [Live Review Mode](#live-review-mode). |
| `--config <path>`, `-c` | string | auto-discover | Path to `agenteval.yaml` configuration file. |

## Detection System

### How Detection Works

For each commit in your git log, agenteval checks three signals in priority order. When multiple signals match the same commit, the highest confidence score is used.

```
Git commit
  |
  +-- Check Co-authored-by trailers     --> confidence: 0.9
  |     Match against known AI emails
  |
  +-- Check author email                --> confidence: 0.8
  |     Match against known bot patterns
  |
  +-- Check commit message              --> confidence: 0.6
        Match against AI-related patterns
  |
  +-- confidence >= minConfidence?
        Yes --> detect as AI commit
        No  --> skip
```

### Detection Methods

#### Co-Authored-By Trailer (confidence: 0.9)

The most reliable signal. AI coding tools typically add a `Co-authored-by` trailer to commits:

```
Co-authored-by: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
```

agenteval matches these email patterns:

| Pattern | Tool | Notes |
|---------|------|-------|
| `noreply@anthropic.com` | Claude Code | All Claude Code commits |
| `noreply@github.com` (with "copilot" in name) | GitHub Copilot | Name check prevents false positives from human squash-merges |
| Email containing `cursor` | Cursor | Matches cursor.sh domain |
| Email containing `devin` | Devin | Matches cognition.ai domain |
| Email containing `aider` | Aider | Matches aider.chat domain |
| Email containing `amazon-q` or `codewhisperer` | Amazon Q Developer | Formerly CodeWhisperer |
| Email containing `gemini` or `jules` (with name check) | Gemini / Jules | Name check prevents false positives on generic Google emails |
| Email containing `codeium` or `windsurf` | Codeium / Windsurf | Windsurf is Codeium's IDE product |
| Email containing `tabnine` | Tabnine | |
| Email containing `cody` or `sourcegraph` | Sourcegraph Cody | |
| Email containing `codex` (with "codex" in name) | Codex CLI (OpenAI) | Name check prevents false positives |
| Email containing `sweep` (with "sweep" in name) | Sweep AI | Name check prevents false positives |
| Email matching `grit.io` | Grit.io | |
| Email matching `continue.dev` | Continue.dev | |

#### Author Email (confidence: 0.8)

Checks if the commit author email itself matches known bot patterns. Same pattern list as co-author detection. Less common but catches commits made directly by bot accounts.

#### Commit Message Pattern (confidence: 0.6)

Regex match on the commit subject line:

```
/generated by|co-authored-by.*(claude|copilot|cursor|gemini|codex)|🤖|bot:|auto-generated|ai-generated/i
```

Lower confidence because commit messages are less structured than trailers. Useful as a fallback when tools don't add trailers. Matches mentions of specific AI tools in co-author references, as well as common prefixes like `auto-generated` and `ai-generated`.

### Tuning Detection Sensitivity

The `--min-confidence` flag controls the threshold:

| Threshold | What it includes | Use case |
|-----------|-----------------|----------|
| `0.9` | Only co-author-tagged commits | High precision, may miss some AI work |
| `0.5` (default) | Co-author tags + author emails + some message patterns | Balanced |
| `0.3` | Almost everything with any AI signal | High recall, more false positives |
| `0.0` | All commits (no filtering) | Useful for debugging detection |

```bash
# Conservative: only commits with explicit AI co-author tags
agenteval harvest --min-confidence 0.9

# Permissive: catch more AI commits, accept some false positives
agenteval harvest --min-confidence 0.3
```

## Generated Task Files

### File Format

Each detected commit produces one YAML file named `harvest-<short-hash>.yaml`:

```yaml
name: harvest-abc123d
description: "feat: add user authentication module"
prompt: "Add user authentication module"
harness: auto
timeout: 300
assertions:
  - type: files-changed
    pattern: src/auth.ts
  - type: files-changed
    pattern: tests/auth.test.ts
scoring:
  correctness: 0.5
  precision: 0.3
  efficiency: 0.1
  conventions: 0.1
```

### How Fields Are Generated

| Field | Source | Details |
|-------|--------|---------|
| `name` | Commit short hash | Format: `harvest-<7-char-hash>` |
| `description` | Full commit message subject | Verbatim from `git log` |
| `prompt` | Commit message, transformed | Conventional-commit prefix stripped (`feat:`, `fix:`, etc.), past-tense converted to imperative ("added" -> "Add"). If result is < 20 characters, a diff summary is appended. |
| `harness` | `--harness` flag or config | Default: `auto` |
| `timeout` | `--timeout` flag or config | Default: `300` seconds |
| `assertions` | Files from `git diff --numstat` | One `files-changed` assertion per file in the diff. If the diff includes test files (matching `test`, `spec`, `__tests__`), a `test-pass` assertion is also added with the detected test command (`bun test` or `npm test`). |
| `scoring` | Hardcoded defaults | Weighted toward correctness (0.5) since ground truth is "did the agent change the right files" |

### Prompt Quality

Generated prompts are starting points. Commit messages describe what was done ("fixed null pointer in parser"), not what needs doing ("fix the null pointer in the parser"). agenteval applies two transformations:

1. **Strip conventional-commit prefix**: `feat: add auth` becomes `add auth`
2. **Convert past-tense to imperative**: `added` -> `Add`, `fixed` -> `Fix`, `updated` -> `Update`, etc.

For best results, review generated YAML files and refine the `prompt` field to match how you'd describe the task to an AI agent.

## Usage Examples

### Preview AI Commits in Your Repo

```bash
agenteval harvest --dry-run
```

```
  Harvest Dry Run
  ═══════════════

  Commits scanned:   142
  AI commits found:  37

  Detected tasks:
    • harvest-abc123d
    • harvest-def456a
    • harvest-789bcd0
    ...

  Skipped: 2
    • 5c637b8: no parent commit
    • a1b2c3d: empty diff
```

### Generate Task Files

```bash
agenteval harvest --output tasks/benchmarks/
```

```
  Harvest Complete
  ════════════════

  Commits scanned:   142
  AI commits found:  37
  Tasks emitted:     37

  Written files:
    • tasks/benchmarks/harvest-abc123d.yaml
    • tasks/benchmarks/harvest-def456a.yaml
    ...
```

### Filter by Date Range

```bash
# Last quarter only
agenteval harvest --since 2026-01-01 --until 2026-03-31

# Last 30 days
agenteval harvest --since 30.days.ago
```

### Single Commit Investigation

```bash
agenteval harvest --commit abc123def --dry-run
```

### JSON Output for Scripting

```bash
agenteval harvest --format json | jq '.aiCommitsDetected'
```

The JSON output structure:

```json
{
  "commitsScanned": 142,
  "aiCommitsDetected": 37,
  "tasksEmitted": 37,
  "tasks": ["tasks/harvested/harvest-abc123d.yaml", "..."],
  "skipped": [
    { "hash": "5c637b8", "reason": "no parent commit" }
  ]
}
```

## End-to-End Workflow

### Testing Instruction Changes

```bash
# 1. Harvest tasks from your repo's AI history
agenteval harvest --output tasks/benchmarks/

# 2. Run a harvested task with your current CLAUDE.md
agenteval run --task tasks/benchmarks/harvest-abc123d.yaml
# Output: run-20260401-143022, score: 0.85

# 3. Edit your CLAUDE.md (improve instructions)

# 4. Run the same task again
agenteval run --task tasks/benchmarks/harvest-abc123d.yaml
# Output: run-20260401-150000, score: 0.91

# 5. Compare the two runs
agenteval compare run-20260401-143022 run-20260401-150000
# Shows: Overall score improved from 0.85 to 0.91
```

### Comparing AI Tools on the Same Tasks

```bash
# Run with Claude Code
agenteval run --task tasks/benchmarks/harvest-abc123d.yaml --harness claude-code

# Run with Copilot
agenteval run --task tasks/benchmarks/harvest-abc123d.yaml --harness copilot

# Compare
agenteval compare <claude-run-id> <copilot-run-id>
```

## Configuration

Default harvest settings can be configured in `agenteval.yaml` to avoid passing flags every time:

```yaml
harvest:
  outputDir: "tasks/harvested"    # Where to write task files
  minConfidence: 0.5              # Detection threshold (0.0-1.0)
  defaultHarness: auto            # Harness field in generated tasks
  defaultTimeout: 300             # Timeout field in generated tasks (seconds)
```

CLI flags always override config values. See [Configuration Reference](configuration.md) for all options.

## Idempotency and Re-Running

Running `harvest` multiple times is safe:

- Files named `harvest-<hash>.yaml` are **skipped** if they already exist
- Use `--force` to regenerate all files (overwrites existing)
- New commits since the last harvest are detected and new files are created
- The `--since` flag lets you harvest only recent commits

## Instruction Snapshots

Every harvested task automatically captures the instruction files (CLAUDE.md, AGENTS.md, etc.) that were in effect at the parent commit. This is stored inline in the YAML as an `instructionSnapshot` map:

```yaml
name: harvest-abc123d
prompt: Add user auth
instructionSnapshot:
  CLAUDE.md: |
    # My Project
    ## Conventions
    - Use TypeScript strict mode
    - All new features need tests
sourceCommit: abc123def456789
detectionConfidence: 0.9
harvestDate: "2026-04-03T10:00:00Z"
```

This enables A/B comparison: change your CLAUDE.md, re-run the same harvested tasks, and measure whether the instruction changes improved agent performance.

The snapshot uses the `instructionGlobs` from your `agenteval.yaml` config (defaults to CLAUDE.md, AGENTS.md, .github/copilot-instructions.md, etc.). Files that don't exist at that commit are silently skipped.

## GitHub Enrichment

The `--github` flag uses the `gh` CLI to fetch PR metadata for each detected commit:

```bash
agenteval harvest --github --dry-run
```

When a merged PR is found for a commit:
- `prUrl` and `prBody` fields are added to the task YAML
- If the commit message is terse (< 20 characters after prefix stripping), the PR body is appended to the task prompt as additional context

**Requirements:**
- `gh` CLI installed ([cli.github.com](https://cli.github.com/))
- Authenticated via `gh auth login`
- The repo must be hosted on GitHub

If `gh` is not installed or not authenticated, the `--github` flag prints a clear error message.

## Live Review Mode

The `--live` flag analyzes your current working tree changes (staged + unstaged) against heuristic rubrics:

```bash
agenteval harvest --live
```

```
  Live Review
  ===========

  Files analyzed: 7
  Overall score:  7.3/10

  Rubric              Score  Details
  ──────────────────  ─────  ─────────────────────────────
  scope-discipline     8/10  7 files across 2 directories
  test-coverage        5/10  1 test file, 6 impl files
  diff-hygiene         9/10  Found 1 console.log statement
```

### Rubrics

**scope-discipline** (0-10): Measures change concentration. How many top-level directories are touched? Focused changes (1-2 directories) score high; scattered changes across 5+ directories score low.

**test-coverage** (0-10): Ratio of test files to implementation files in the diff. Detects test files via `test`, `spec`, `__tests__` patterns. Score 0 if you changed 4+ implementation files with zero tests.

**diff-hygiene** (0-10): Detects common issues in the diff: `console.log`/`debugger` statements, TODO/FIXME/HACK comments, and formatting-only hunks. Starts at 10, loses 1 point per issue found.

All heuristic rubrics are pure functions with no external dependencies. Execution takes <1 second.

### Rubric Configuration

Rubric weights and enable/disable are configurable in `agenteval.yaml`:

```yaml
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
      weight: 1.5
    progressiveDisclosure:
      enabled: true
      weight: 1.0
```

Disabled rubrics are excluded from results and the overall score. Weights control how much each rubric contributes to the weighted average.

### LLM-Assisted Rubrics (--analyze)

The `--analyze` flag adds two LLM-assisted rubrics that send the diff and your instruction files to Claude for evaluation:

```bash
agenteval harvest --live --analyze
```

**convention-compliance** (0-10): "Does this diff follow the conventions described in CLAUDE.md?" Returns a score and a list of specific violations.

**progressive-disclosure** (0-10): "Are these changes appropriately scoped and layered?" Returns a score and a list of scope issues.

Requirements:
- Claude Code CLI installed (`claude` command available)
- `--analyze` requires `--live`
- Instruction files (CLAUDE.md, AGENTS.md, etc.) must exist in the repo

LLM rubrics take 10-30 seconds (one LLM call per rubric). Heuristic rubrics still run in <1 second. If the LLM response can't be parsed, the rubric falls back to score 5 with a note.

## Comparison with Instruction Diffs

When comparing two eval runs that were both generated from harvested tasks with instruction snapshots, the compare command shows what changed in your instruction files:

```bash
agenteval compare run-A run-B
```

```
  Instruction Changes
  ───────────────────
  CLAUDE.md    changed
  AGENTS.md    unchanged
```

This answers the key question: "I changed my CLAUDE.md between these runs. Did the score improve?"

## Confidence-Weighted Scoring

Harvested tasks include a `detectionConfidence` (0.6-0.9) based on how the AI commit was detected. When scoring eval runs, this confidence is used as a multiplier:

- Co-author tag detection (0.9): a perfect run scores 0.9
- Message pattern detection (0.6): a perfect run scores 0.6

The raw `overall` score is always available. The `confidenceAdjustedOverall` field reflects detection uncertainty. Low-confidence tasks contribute proportionally less when evaluating instruction quality.

## Edge Cases and Limitations

| Situation | Behavior |
|-----------|----------|
| Initial commit (no parent) | Skipped. Cannot compute diff without a parent commit. |
| Merge commits | Uses first-parent diff (`hash^1..hash`). Matches squash-merge workflows. |
| Empty diffs | Skipped. No files changed means no useful task to generate. |
| File renames | Correctly extracts the destination path from both `old => new` and `{old => new}/file.ts` patterns. |
| Binary files | Included in file count but additions/deletions show as 0. |
| No AI commits found | Prints a message suggesting `--min-confidence 0.3` or checking that your AI tool adds Co-authored-by trailers. |
| Very large repos (10k+ commits) | Works but may be slow. Use `--since` to limit scope. Each detected commit spawns two git subprocesses (parent check + diff stat). |

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Completed successfully (even if no AI commits were found) |
| 2 | Error: not a git repository, git not installed, invalid flags |
