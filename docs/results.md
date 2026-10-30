# Results and Comparison

## Overview

Every `agenteval run` execution produces a structured result file stored as JSON. The `results` command lets you browse, filter, and export these results. The `compare` command shows a side-by-side comparison of two runs, which is the core workflow for testing instruction changes: "did my CLAUDE.md update make the agent better or worse?"

## Viewing Results

### List All Runs

```bash
agenteval results
```

```
  Results (7)
  ───────────

  ┌──────────────────────────┬──────────────────┬─────────────┬───────┬─────────┐
  │ ID                       │ Task             │ Harness     │ Score │ Status  │
  ├──────────────────────────┼──────────────────┼─────────────┼───────┼─────────┤
  │ run-20261030-203538-026797 │ fix-login        │ mock        │ 0.71  │ success │
  │ run-20261030-203538-21b8c1 │ add-tests        │ mock        │ N/A   │ error   │
  │ run-20261030-203528-2ff4ea │ fix-login        │ mock        │ 0.71  │ success │
  │ run-20261030-203528-dcd4dc │ refactor-auth    │ mock        │ 1.00  │ success │
  │ run-20261030-203527-cbe245 │ refactor-auth    │ mock        │ 0.81  │ success │
  │ run-20261030-203526-172b38 │ fix-login        │ mock        │ 1.00  │ success │
  │ run-20261030-203518-c0f006 │ refactor-auth    │ mock        │ 0.62  │ success │
  └──────────────────────────┴──────────────────┴─────────────┴───────┴─────────┘
```

Results are listed newest first. Runs that ended in `error` or `timeout` have no score (`N/A`).

### Filtering

```bash
# By task name
agenteval results --task refactor-auth

# By harness
agenteval results --harness claude-code

# Limit number of results
agenteval results --limit 3

# Combine filters
agenteval results --task refactor-auth --harness claude-code --limit 5
```

### Export Formats

```bash
# JSON (for scripts, dashboards, further processing)
agenteval results --export json

# Markdown table (for PRs, reports, documentation)
agenteval results --export markdown
```

**JSON output** returns the full stored result objects (see [Result File Structure](#result-file-structure)): scores per dimension, assertion details, diff summaries, token usage, and timing.

**Markdown output** produces a table suitable for pasting into GitHub PRs or reports:

```markdown
# Eval Results

| ID | Task | Harness | Score | Status | Date |
|-----|------|---------|-------|--------|------|
| run-20261030-203538-026797 | fix-login | mock | 0.71 | success | 2026-10-30 |
| run-20261030-203538-21b8c1 | add-tests | mock | N/A | error | 2026-10-30 |
| run-20261030-203528-2ff4ea | fix-login | mock | 0.71 | success | 2026-10-30 |
```

### Pruning Old Results

Results accumulate over time. To remove results older than the retention period:

```bash
agenteval results --prune
```

Age is measured from each result's `timestamp`. The retention period defaults to 90 days. Configure it in `agenteval.yaml` as a number of days with a `d` suffix (other units are rejected):

```yaml
run:
  resultRetention: "30d"   # Keep results for 30 days instead of 90
```

### Results Command Reference

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--task <name>` | string | | Show only results for this task name |
| `--harness <name>` | string | | Show only results from this harness |
| `--limit <n>` | integer | all | Maximum number of results to display (the newest ones) |
| `--export <format>` | string | console | Export format: `json` or `markdown` |
| `--prune` | boolean | `false` | Delete results older than `resultRetention` |
| `--config <path>`, `-c` | string | auto-discover | Path to `agenteval.yaml` |

## Comparing Two Runs

### Basic Comparison

```bash
agenteval compare run-20261030-203518-c0f006 run-20261030-203527-cbe245
```

```
  agenteval compare
  ─────────────────

  run-20261030-203518-c0f006  vs  run-20261030-203527-cbe245

  ┌──────────────┬────────┬────────┬─────────┐
  │ Metric       │ Run A  │ Run B  │ Delta   │
  ├──────────────┼────────┼────────┼─────────┤
  │ Correctness  │ 0.33   │ 0.67   │ +0.33 ▶ │
  │ Precision    │ 1.00   │ 1.00   │ 0.00 —  │
  │ Efficiency   │ N/A    │ N/A    │ —       │
  │ Conventions  │ N/A    │ N/A    │ —       │
  ├──────────────┼────────┼────────┼─────────┤
  │ Overall      │ 0.62   │ 0.81   │ +0.19 ▶ │
  └──────────────┴────────┴────────┴─────────┘

  ──────────────────────────────────────────────────────
  Run B scored 31% higher. Correctness improved from 0.33 to 0.67.
```

When both runs come from harvested tasks that carry an `instructionSnapshot`, an "Instruction Changes" list between the table and the summary shows each instruction file as `added`, `removed`, or `changed`. Compare looks at scores only; it does not diff assertions or token counts.

### Reading the Comparison

| Column | Meaning |
|--------|---------|
| Metric | The scoring dimension (see [Running Evals](run.md) for how each is computed) |
| Run A | Score from the first run ID you provided |
| Run B | Score from the second run ID you provided |
| Delta | Run B minus Run A. Positive = B improved. Negative = B regressed. `▶` marks Run B as better on that row, `◀` Run A, `—` a tie or missing data. |
| Summary line | Which run scored higher overall and by what percentage, plus the dimension that improved most. If the overall scores can't be compared, the winner falls back to whichever run has a score, then to the count of dimension wins. |

### Comparison Output Formats

```bash
# Console table (default, human-readable)
agenteval compare run-A run-B

# JSON (for scripts and automation)
agenteval compare run-A run-B --format json

# Markdown report (for PRs and documentation)
agenteval compare run-A run-B --report
# Equivalent to: agenteval compare run-A run-B --format markdown
```

### Compare Command Reference

| Option | Short | Type | Default | Description |
|--------|-------|------|---------|-------------|
| `<runA>` | | string | Required | First run ID (the "before" state) |
| `<runB>` | | string | Required | Second run ID (the "after" state) |
| `--format <type>` | `-f` | string | `console` | Output format: `console`, `json`, or `markdown` |
| `--report` | | boolean | `false` | Alias for `--format markdown` |
| `--config <path>` | `-c` | string | auto-discover | Path to `agenteval.yaml` |

## The Instruction Testing Workflow

The typical workflow that uses results and comparison:

```
1. Harvest tasks        agenteval harvest
       |                  -> tasks/harvested/harvest-e220da2.yaml
       |
2. Run baseline         agenteval run --task tasks/harvested/harvest-e220da2.yaml
       |                  -> run-20261030-100000-3f9a1c (score: 0.72)
       |
3. Edit CLAUDE.md       (improve your instructions)
       |
4. Run again            agenteval run --task tasks/harvested/harvest-e220da2.yaml
       |                  -> run-20261030-110000-b27e40 (score: 0.85)
       |
5. Compare              agenteval compare run-20261030-100000-3f9a1c run-20261030-110000-b27e40
       |                  -> Overall: +0.13, Run B scored 18% higher
       |
6. Ship or iterate      Score improved? Ship the CLAUDE.md change.
                         Score dropped? Revert and try a different approach.
```

Agents are nondeterministic, so a single run per side can mislead. `agenteval run --trials 3 --baseline` measures the same question with repeated runs and an arm without instructions (see [Trials and the baseline arm](run.md#trials-and-the-baseline-arm)). Run this across multiple harvested tasks to build confidence that your instruction change is broadly positive, not just better on one task and worse on others.

## Where Results Are Stored

Results are saved as JSON files in `.agenteval/results/` (configurable via `run.resultsDir`). Each file is named by its run ID:

```
.agenteval/results/
  run-20261030-203518-c0f006.json
  run-20261030-203527-cbe245.json
  run-20261030-203528-dcd4dc.json
```

### Result File Structure

Each JSON file contains:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique run identifier (format: `run-YYYYMMDD-HHMMSS-xxxxxx`, local time plus a random hex suffix) |
| `timestamp` | string | ISO 8601 timestamp of when the run started |
| `task` | string | Task name from the YAML file or "ad-hoc" |
| `harness` | string | Which harness was used (the resolved name when the task said `auto`) |
| `instructions` | string | Absolute path to the instruction file that was injected, or `(baseline: no instructions)` for the baseline arm |
| `status` | string | `success`, `error`, or `timeout` |
| `metrics.tokensInput` | number or null | Input tokens used (null if unavailable) |
| `metrics.tokensOutput` | number or null | Output tokens used |
| `metrics.tokensTotal` | number or null | Total tokens |
| `metrics.tokenSource` | string | `api`, `estimated`, or `unavailable` |
| `metrics.tokensCacheRead` | number or null | Input tokens served from the prompt cache (part of `tokensInput`, left out of efficiency). Only from harnesses that report it |
| `metrics.costUsd` | number or null | Cost the agent CLI reported |
| `metrics.model` | string or null | Model the agent CLI reported |
| `metrics.turns` | number or null | Turns the agent CLI reported |
| `scores.correctness` | number or null | 0.0-1.0, from assertion results |
| `scores.precision` | number or null | 0.0-1.0, from file change analysis |
| `scores.efficiency` | number or null | 0.0-1.0, from token usage |
| `scores.conventions` | number or null | 0.0-1.0, from `convention` and `lint-delta` assertions |
| `scores.overall` | number or null | Weighted average of available dimensions |
| `scores.confidenceAdjustedOverall` | number | Overall score multiplied by detection confidence (harvested tasks only). Stored for your own analysis; `ci`, `trends`, and `compare` use `overall` |
| `assertions` | array | Each assertion with type, expected, actual, passed |
| `diffSummary` | string | Summary of git diff, e.g. `3 file(s) changed, 42 insertion(s), 8 deletion(s)`. Empty for error and timeout runs |
| `changedFiles` | string[] | Files the agent's diff touched, repo-relative, including new files (successful runs only) |
| `model` | string or null | Model the CLI reported, else the requested model, else null |
| `durationMs` | number | Wall-clock time of the agent process (successful runs only) |
| `trial` | object | `group`, `index`, `of`, `arm` (`instructions` or `baseline`). Present when the run was one of several trials or used `--baseline` |
| `lint` | object | `tools` (each tool's status: `ok`, `unavailable`, or `failed`) and `newDiagnostics` (findings the diff introduced). Present when the task has `lint-delta` assertions |
| `error` | string | Error message (only present when status is error/timeout) |
| `sourceCommit` | string | Source commit hash (present for harvested tasks) |
| `instructionSnapshot` | object | Map of instruction file contents at source commit (harvested tasks) |
| `prUrl` | string | GitHub PR URL (present when harvested with `--github`) |
| `detectionConfidence` | number | Detection confidence 0.0-1.0 (harvested tasks) |

You can read these files directly for custom analysis, dashboards, or integration with other tools.

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 2 | Run ID not found, or configuration/runtime error |
