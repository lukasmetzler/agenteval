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
| `--format <type>` | string | `yaml` | Output format. `yaml` prints a human-readable summary. `json` prints a structured result object to stdout (for scripting). Both write task files unless `--dry-run` is set. |
| `--harness <name>` | string | `auto` | Sets the `harness` field in every generated task file. Accepts `auto`, any built-in harness (`claude-code`, `codex`, `gemini`, `antigravity`, `copilot`, `cursor`, `opencode`, `devin`, `amp`, the `windsurf` alias, `mock`), or a `harnesses:` key from `agenteval.yaml`. |
| `--timeout <seconds>` | integer | `300` | Sets the `timeout` field in every generated task file. |
| `--min-confidence <n>` | float | `0.5` | Minimum detection confidence threshold (0.0 to 1.0). Detection confidences are 0.9, 0.8, or 0.6, so any value from 0 to 0.6 selects the same commits. See [Tuning Detection Sensitivity](#tuning-detection-sensitivity). |
| `--github` | boolean | `false` | Enrich tasks with PR URL and body from GitHub. Requires `gh` CLI authenticated via `gh auth login`. |
| `--live` | boolean | `false` | Review current working tree changes against heuristic rubrics instead of mining git history. See [Live Review Mode](#live-review-mode). |
| `--analyze` | boolean | `false` | With `--live`, also run the two LLM-judged rubrics. Requires the `claude` CLI. See [Live Review Mode](#live-review-mode). |
| `--config <path>`, `-c` | string | auto-discover | Path to `agenteval.yaml` configuration file. |

## Usage Examples

### Preview AI Commits in Your Repo

```bash
agenteval harvest --dry-run
```

Run in the agenteval repository itself:

```
  agenteval harvest · dry run
  ───────────────────────────

  Commits scanned      105
  AI-assisted          104 (99%)
  Skipped              1

  ┌─────────┬──────────┬──────┬────────────────────────────────────────────┐
  │ Hash    │ Tool     │ Conf │ Message                                    │
  ├─────────┼──────────┼──────┼────────────────────────────────────────────┤
  │ 4b7225e │ claude   │ 0.9  │ feat: ship an agenteval Agent Skill; fi... │
  │ d5ff11d │ claude   │ 0.9  │ fix(run): issues found by end-to-end ru... │
  │ f4cafc7 │ claude   │ 0.9  │ docs: document v0.9.0 and bump version     │
  │ ...     │          │      │                                            │
  │ e2b9ab9 │ claude   │ 0.9  │ feat: OpenCode harness adapter (v0.8.11... │
  │ ...     │          │      │ (89 more)                                  │
  └─────────┴──────────┴──────┴────────────────────────────────────────────┘

  Skipped (1)
    5c637b8 · no parent commit
  Completed in 2.9s
```

The table shows up to 15 commits (shortened here). Skipped commits are root commits (`no parent commit`) and commits whose diff is empty (`empty diff`).

### Generate Task Files

```bash
agenteval harvest
```

```
  Scanning git history...

  agenteval harvest
  ─────────────────

  Commits scanned      4
  AI-assisted          2
  Tasks written        2

    → tasks/harvested/harvest-56b44e4.yaml
    → tasks/harvested/harvest-e220da2.yaml
  Completed in 0.0s
```

Use `--output <dir>` to write somewhere else. Only `*.yaml` files directly in `ci.tasksDir` (default `tasks/harvested`) are picked up by `agenteval ci`.

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
agenteval harvest --dry-run --format json | jq '.aiCommitsDetected'
```

`--format json` without `--dry-run` still writes the task files. Then `tasks` lists the written file paths and `tasksEmitted` counts them. With `--dry-run`, nothing is written, `tasks` holds the task names that would be generated, and `commitSummaries` lists the detected commits:

```json
{
  "commitsScanned": 4,
  "aiCommitsDetected": 2,
  "tasksEmitted": 0,
  "tasks": [
    "harvest-56b44e4",
    "harvest-e220da2"
  ],
  "skipped": [],
  "commitSummaries": [
    {
      "shortHash": "56b44e4",
      "tool": "claude",
      "confidence": 0.6,
      "message": "feat: add auth helper"
    },
    {
      "shortHash": "e220da2",
      "tool": "claude",
      "model": "Claude Opus 5.5",
      "confidence": 0.9,
      "message": "fix: handle null input in parser"
    }
  ]
}
```

## When to Use Each Mode

**`harvest`** (default) -- You have AI commits in your git history and want to generate eval tasks from them. This scans your commit log, detects AI-involved commits by co-author and session trailers, agent author accounts, and message patterns, and writes one task YAML file per detected commit.

**`harvest --live`** -- You are about to commit and want to check your current changes against quality rubrics. This analyzes your working tree diff (staged + unstaged changes to tracked files; untracked files are not included) using heuristic rubrics for scope discipline, test coverage, diff hygiene, and, when a linter is installed, lint delta. No git history scanning, no task files written.

**`harvest --live --analyze`** -- Same as `--live` but also asks an LLM whether your changes follow your project conventions. Adds two LLM-assisted rubrics (convention-compliance and progressive-disclosure) on top of the heuristic rubrics. Requires Claude Code CLI and takes 10-30 seconds longer.

## Generated Task Files

### File Format

Each detected commit produces one YAML file named `harvest-<short-hash>.yaml`:

```yaml
name: harvest-e220da2
description: "fix: handle null input in parser"
prompt: Handle null input in parser
harness: auto
timeout: 300
assertions:
  - type: files-changed
    pattern: src/parser.test.ts
  - type: files-changed
    pattern: src/parser.ts
  - type: test-pass
    command: npm run test
scoring:
  correctness: 0.5
  precision: 0.3
  efficiency: 0.1
  conventions: 0.1
detectedModel: Claude Opus 5.5
instructionSnapshot:
  CLAUDE.md: |
    # Project

    Run `bun test` before committing.
sourceCommit: e220da25f53bb6f0e6870385003fb67e5d92c450
detectionConfidence: 0.9
harvestDate: 2026-10-30T19:36:20.371Z
```

This repo has a `package.json` with a `test` script and no lockfile, so the test command is `npm run test`.

### How Fields Are Generated

| Field | Source | Details |
|-------|--------|---------|
| `name` | Commit short hash | Format: `harvest-<7-char-hash>` |
| `description` | Commit message subject | Verbatim from `git log` |
| `prompt` | Commit message, transformed | Conventional-commit prefix stripped (`feat:`, `fix:`, etc.), past-tense converted to imperative ("added" -> "Add"). If result is < 20 characters, a diff summary is appended. |
| `harness` | `--harness` flag or config | Default: `auto` |
| `timeout` | `--timeout` flag or config | Default: `300` seconds |
| `assertions` | Files from `git diff --numstat` | One `files-changed` assertion per file in the diff, plus `test-pass` and `lint-delta` when they apply. See [Generated assertions](#generated-assertions). |
| `scoring` | Hardcoded | Always correctness 0.5, precision 0.3, efficiency 0.1, conventions 0.1, weighted toward correctness since ground truth is "did the agent change the right files" |
| `sourceCommit`, `instructionSnapshot`, `detectionConfidence`, `harvestDate` | Detection and snapshot | Always set. A task with `sourceCommit` starts its worktree at `<sourceCommit>^`, the state before the original change |
| `detectedModel` | Co-author trailer | Set when the trailer names a model |

### Generated assertions

- **`files-changed`**, one per file the commit touched.
- **`test-pass`**, when any changed path contains `test`, `spec`, or `__tests__`. The command is the `package.json` `test` script run through the repo's package manager (`bun run test`, `pnpm run test`, `npm run test`, ...). Without a `test` script: `bun test` in a Bun repo, `<pm> test` in another JS repo, else `uv run pytest`, `cargo test`, or `go test ./...` depending on the detected toolchain, with `bun test` as the last fallback.
- **`lint-delta`** with `tools: auto`, when agenteval detects a linter or type checker in the repo that it can run (see [Toolchain checks](toolchain.md)).

### Prompt Quality

Generated prompts are starting points. Commit messages describe what was done ("fixed null pointer in parser"), not what needs doing ("fix the null pointer in the parser"). agenteval applies two transformations:

1. **Strip conventional-commit prefix**: `feat: add auth` becomes `add auth`
2. **Convert past-tense to imperative**: `added` -> `Add`, `fixed` -> `Fix`, `updated` -> `Update`, etc.

For best results, review generated YAML files and refine the `prompt` field to match how you'd describe the task to an AI agent.

## End-to-End Workflow

### Testing Instruction Changes

```bash
# 1. Harvest tasks from your repo's AI history
agenteval harvest --output tasks/benchmarks/

# 2. Run a harvested task with your current CLAUDE.md
agenteval run --task tasks/benchmarks/harvest-e220da2.yaml
# Saved to .agenteval/results/<run-id-1>.json

# 3. Edit your CLAUDE.md (improve instructions)

# 4. Run the same task again
agenteval run --task tasks/benchmarks/harvest-e220da2.yaml
# Saved to .agenteval/results/<run-id-2>.json

# 5. Compare the two runs
agenteval compare <run-id-1> <run-id-2>
```

### Comparing AI Tools on the Same Tasks

```bash
# Run with Claude Code
agenteval run --task tasks/benchmarks/harvest-e220da2.yaml --harness claude-code

# Run with Codex
agenteval run --task tasks/benchmarks/harvest-e220da2.yaml --harness codex

# Compare
agenteval compare <claude-run-id> <codex-run-id>
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

- Files named `harvest-<hash>.yaml` are **skipped** if they already exist (listed under "Skipped" with `file exists (use --force to overwrite)`)
- Use `--force` to regenerate all files (overwrites existing)
- New commits since the last harvest are detected and new files are created
- The `--since` flag lets you harvest only recent commits

## Instruction Snapshots

Every harvested task automatically captures the instruction files (CLAUDE.md, AGENTS.md, etc.) that were in effect at the parent commit. This is stored inline in the YAML as an `instructionSnapshot` map:

```yaml
name: harvest-e220da2
description: "fix: handle null input in parser"
prompt: Handle null input in parser
instructionSnapshot:
  CLAUDE.md: |
    # Project

    Run `bun test` before committing.
sourceCommit: e220da25f53bb6f0e6870385003fb67e5d92c450
detectionConfidence: 0.9
harvestDate: 2026-10-30T19:36:20.371Z
```

The snapshot is copied into each result. When you compare two runs that both carry a snapshot, `compare` lists which instruction files differ between them. The run itself injects the file given by `--instructions` (default `CLAUDE.md` from your working tree), not the snapshot.

The snapshot uses the `instructionGlobs` from your `agenteval.yaml` config (defaults to CLAUDE.md, AGENTS.md, .github/copilot-instructions.md, etc.). Files that don't exist at that commit are silently skipped.

## GitHub Enrichment

The `--github` flag uses the `gh` CLI to fetch PR metadata for each detected commit:

```bash
agenteval harvest --github --dry-run
```

When a merged PR is found for a commit:
- `prUrl` and `prBody` fields are added to the task YAML (PR labels are fetched but not written)
- If the commit message is terse (< 20 characters after prefix stripping), the PR body is appended to the task prompt as additional context

**Requirements:**
- `gh` CLI installed ([cli.github.com](https://cli.github.com/))
- Authenticated via `gh auth login`
- The repo must be hosted on GitHub

If `gh` is not installed or not authenticated, the `--github` flag prints a clear error message.

## Live Review Mode

The `--live` flag analyzes your current working tree changes (staged + unstaged changes to tracked files) against heuristic rubrics:

```bash
agenteval harvest --live
```

```
  agenteval review
  ────────────────

  Branch               master
  Files analyzed       1
  Overall score        7.3/10

  ┌──────────────────────┬───────┬──────────────────────────────────┐
  │ Rubric               │ Score │ Details                          │
  ├──────────────────────┼───────┼──────────────────────────────────┤
  │ Scope Discipline     │ 10/10 │ 1 file changed                   │
  │ Test Coverage        │ 3/10  │ 0 test files, 1 implementation file; Test ratio: 0.00 │
  │ Diff Hygiene         │ 9/10  │ Found 1 console.log statement    │
  └──────────────────────┴───────┴──────────────────────────────────┘

  Suggestions
    → Add more test coverage. Aim for at least 1 test file per 2 implementation files.
    → Remove console.log/debugger statements before committing.
```

This repo has no linter, so there is no lint-delta row. With no changes, the review prints `No uncommitted changes to review`.

### Rubrics

**scope-discipline** (0-10): Measures change concentration. How many top-level directories are touched? Focused changes (1-2 directories) score high; scattered changes across 5+ directories score low.

**test-coverage** (0-10): Ratio of test files to implementation files in the diff. Detects test files via `test`, `spec`, `__tests__` patterns. Score 0 if you changed 4+ implementation files with zero tests.

**diff-hygiene** (0-10): Detects common issues in the diff: `console.log`/`debugger` statements, TODO/FIXME/HACK comments, and formatting-only hunks. Starts at 10, loses 1 point per issue found.

**lint-delta** (0-10): Runs the repo's detected linters (oxlint, ESLint, Biome, Ruff) on the changed files and counts findings on the lines you added. Starts at 10, loses 2 points per new error and 1 per new warning. Left out when no linter is installed. The live review skips the type checker because a whole-project `tsc` run takes too long here. See [Toolchain checks](toolchain.md).

The first three rubrics are pure functions and finish in under a second. lint-delta takes as long as your linters.

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
    lintDelta:
      enabled: true
      weight: 1.0
    conventionCompliance:
      enabled: true
      weight: 1.5
    progressiveDisclosure:
      enabled: true
      weight: 1.0
```

`liveReview.judgeModel` (default `sonnet`) picks the model for the `--analyze` rubrics. It accepts a Claude Code alias (`sonnet`, `opus`, `haiku`) or a full model id like `claude-sonnet-5-5`.

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

LLM rubrics take 10-30 seconds (one LLM call per rubric). If the call fails or the answer can't be parsed, the rubric is left out of the score. Before 0.9 it silently scored 5/10.

The judge runs as `claude -p --tools "" --permission-mode dontAsk` with the prompt on stdin. With every tool disabled, a diff that contains instructions aimed at the judge can't make it run commands or edit files. The prompt also fences the diff and instructions as data.

## Advanced

You don't need to understand detection internals to use harvest. The sections below explain how it works under the hood.

### Detection System

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

#### Co-authored-by and session trailers (confidence: 0.9)

The most reliable signal. Most agents add a `Co-authored-by` trailer, and some add a trailer linking the commit to the agent session:

```
Co-authored-by: Claude Opus 5.5 <noreply@anthropic.com>
Agent-Logs-Url: https://github.com/acme/app/agents/12345
```

| Signal | Tool | Notes |
|---------|------|-------|
| `noreply@anthropic.com` | Claude Code | The trailer name is the model ("Claude Opus 5.5"), recorded as `detectedModel` |
| `noreply@openai.com` | Codex | Off by default in Codex (`commit_attribution_enabled`) |
| `copilot@github.com` | Copilot in VS Code | `git.addAICoAuthor` setting |
| `noreply@github.com` with "copilot" in the name | GitHub Copilot | Name check avoids human squash-merges |
| `Agent-Logs-Url:` trailer | Copilot coding agent | |
| `@ampcode.com`, `Amp-Thread-ID:` trailer | Amp | Both on by default |
| `aider@aider.chat` | Aider | "aider (gpt-5)" puts the model in the name; recorded as `detectedModel` |
| Email containing `cursor` | Cursor | |
| `cognition.ai` or `devin-ai-integration` | Devin | |
| Email containing `gemini` or `jules` (name must match too) | Gemini / Jules | |
| `amazon-q` or `codewhisperer` | Amazon Q Developer | |
| `factory.ai` | Factory | |
| `opencode` | OpenCode | No default trailer known; matches if you add one |
| `codeium` or `windsurf` | Codeium / Windsurf | |
| `tabnine`, `cody`/`sourcegraph`, `sweep`, `grit.io`, `continue.dev` | Tabnine, Cody, Sweep, Grit, Continue | |

#### Agent-authored commits (confidence: 0.8)

Matches commits whose author is the agent's own account. Only bot-specific addresses count, so a human named `jules.smith@corp.com` or `codex.fan@example.com` is not flagged.

| Author | Tool |
|---|---|
| `…+Copilot@users.noreply.github.com` | Copilot coding agent |
| `…+claude[bot]@users.noreply.github.com` | Claude GitHub app |
| `…+chatgpt-codex-connector[bot]@…` | Codex cloud |
| `…+cursor[bot]@…`, `cursoragent@cursor.com`, author name "Cursor Agent" | Cursor background agents |
| `…+devin-ai-integration[bot]@…` | Devin |
| `…+google-labs-jules[bot]@…`, `…+gemini-code-assist[bot]@…` | Jules, Gemini Code Assist |
| `…+amazon-q-developer[bot]@…` | Amazon Q Developer |
| `…+factory-droid[bot]@…` | Factory |
| Author name ending in `(aider)` | Aider |

#### Commit message pattern (confidence: 0.6)

Regex match on the subject and the body:

```
/generated by|generated with|co-authored-by.*(claude|copilot|cursor|gemini|codex)|🤖|bot:|auto-generated|ai-generated/i
```

"Generated with [Claude Code]" and "Generated with [Codex]" footers name the tool. Other matches report `unknown`. Before 0.9 only the subject line was scanned, so body footers were missed.

### Tuning Detection Sensitivity

The `--min-confidence` flag controls the threshold:

Every detected commit has one of three confidences, so only three thresholds give different results:

| Threshold | What it includes |
|-----------|-----------------|
| above 0.8, up to 0.9 | Co-author and session trailers only |
| above 0.6, up to 0.8 | Trailers and agent-authored commits |
| 0 to 0.6 (default 0.5) | All three signals, including message patterns |

A value above 0.9 selects nothing. Commits with no AI signal are never included, even at 0.

```bash
# Conservative: only commits with an AI co-author or session trailer
agenteval harvest --min-confidence 0.9

# Drop message-pattern matches
agenteval harvest --min-confidence 0.8
```

### Confidence-Weighted Scoring

Harvested tasks include a `detectionConfidence` (0.6, 0.8, or 0.9) based on how the AI commit was detected. Each result of such a task also stores `scores.confidenceAdjustedOverall`, the overall score multiplied by this confidence:

- Co-author tag detection (0.9): a perfect run gets 0.9
- Message pattern detection (0.6): a perfect run gets 0.6

The field is stored for your own analysis only. `ci`, `trends`, `compare`, and `results` all use the raw `overall` score.

### Comparison with Instruction Diffs

When comparing two eval runs that were both generated from harvested tasks with instruction snapshots, the compare command shows what changed in your instruction files:

```bash
agenteval compare run-20261030-204349-52e92a run-20261030-204351-64daac
```

```
  ...
  └──────────────┴────────┴────────┴─────────┘

  Instruction Changes
  ───────────────────
  AGENTS.md                unchanged
  CLAUDE.md                changed

  ──────────────────────────────────────────────────────
  Both runs scored identically. Instruction changes: CLAUDE.md.
```

The list appears only when at least one file is added, removed, or changed.

This answers the key question: "I changed my CLAUDE.md between these runs. Did the score improve?"

## Edge Cases and Limitations

| Situation | Behavior |
|-----------|----------|
| Initial commit (no parent) | Skipped. Cannot compute diff without a parent commit. |
| Merge commits | Uses first-parent diff (`hash^1..hash`). Matches squash-merge workflows. |
| Empty diffs | Skipped. No files changed means no useful task to generate. |
| File renames | Correctly extracts the destination path from both `old => new` and `{old => new}/file.ts` patterns. |
| Binary files | Included in file count but additions/deletions show as 0. |
| No AI commits found | Prints `No AI-involved commits detected.` and a hint that agenteval looks for Co-authored-by trailers, agent bot accounts, and "Generated with" footers. Lowering `--min-confidence` doesn't help. |
| Very large repos (10k+ commits) | Works but may be slow. Use `--since` to limit scope. Each detected commit spawns two git subprocesses (parent check + diff stat). |

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Completed successfully (even if no AI commits were found) |
| 2 | Error: not a git repository, git not installed, invalid flags |
