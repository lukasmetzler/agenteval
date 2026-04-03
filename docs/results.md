# Results and Comparison

## Overview

Every `agenteval run` execution produces a structured result file stored as JSON. The `results` command lets you browse, filter, and export these results. The `compare` command shows a side-by-side comparison of two runs, which is the core workflow for testing instruction changes: "did my CLAUDE.md update make the agent better or worse?"

## Viewing Results

### List All Runs

```bash
agenteval results
```

```
  5 result(s):

  ID                        Task                 Harness        Score    Status
  ───────────────────────────────────────────────────────────────────────────────
  run-20260401-160000       harvest-abc123d      claude-code    0.91     success
  run-20260401-150000       refactor-auth        claude-code    0.85     success
  run-20260401-143022       refactor-auth        claude-code    0.72     success
  run-20260401-120000       add-tests            copilot        0.45     error
  run-20260331-200000       fix-login            claude-code    0.88     success
```

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

**JSON output** returns the full result objects with all fields: scores per dimension, assertion details, diff summaries, token usage, and timing.

**Markdown output** produces a table suitable for pasting into GitHub PRs or reports:

```markdown
# Eval Results

| ID | Task | Harness | Score | Status | Date |
|-----|------|---------|-------|--------|------|
| run-20260401-160000 | harvest-abc123d | claude-code | 0.91 | success | 2026-04-01 |
```

### Pruning Old Results

Results accumulate over time. To remove results older than the retention period:

```bash
agenteval results --prune
```

The retention period defaults to 90 days. Configure it in `agenteval.yaml`:

```yaml
run:
  resultRetention: "30d"   # Keep results for 30 days instead of 90
```

### Results Command Reference

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--task <name>` | string | | Show only results for this task name |
| `--harness <name>` | string | | Show only results from this harness |
| `--limit <n>` | integer | all | Maximum number of results to display |
| `--export <format>` | string | console | Export format: `json` or `markdown` |
| `--prune` | boolean | `false` | Delete results older than `resultRetention` |
| `--config <path>`, `-c` | string | auto-discover | Path to `agenteval.yaml` |

## Comparing Two Runs

### Basic Comparison

```bash
agenteval compare run-20260401-143022 run-20260401-150000
```

```
  Comparison: run-20260401-143022 vs run-20260401-150000

  Metric          Run A    Run B    Delta
  ─────────────────────────────────────────
  Correctness     0.90     0.75     -0.15
  Precision       0.80     0.70     -0.10
  Efficiency      0.85     0.90     +0.05
  Conventions     0.70     0.60     -0.10
  Overall         0.85     0.72     -0.13

  Winner: Run A (run-20260401-143022)
```

### Reading the Comparison

| Column | Meaning |
|--------|---------|
| Metric | The scoring dimension (see [Running Evals](run.md) for how each is computed) |
| Run A | Score from the first run ID you provided |
| Run B | Score from the second run ID you provided |
| Delta | Run B minus Run A. Positive = B improved. Negative = B regressed. |
| Winner | The run with the higher overall score, or "Tie" if equal |

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
1. Harvest tasks        agenteval harvest --output tasks/
       |
2. Run baseline         agenteval run --task tasks/harvest-abc.yaml
       |                  -> run-20260401-100000 (score: 0.72)
       |
3. Edit CLAUDE.md       (improve your instructions)
       |
4. Run again            agenteval run --task tasks/harvest-abc.yaml
       |                  -> run-20260401-110000 (score: 0.85)
       |
5. Compare              agenteval compare run-20260401-100000 run-20260401-110000
       |                  -> Overall: +0.13, Winner: Run B
       |
6. Ship or iterate      Score improved? Ship the CLAUDE.md change.
                         Score dropped? Revert and try a different approach.
```

Run this across multiple harvested tasks to build confidence that your instruction change is broadly positive, not just better on one task and worse on others.

## Where Results Are Stored

Results are saved as JSON files in `.agenteval/results/` (configurable via `run.resultsDir`). Each file is named by its run ID:

```
.agenteval/results/
  run-20260401-100000.json
  run-20260401-110000.json
  run-20260401-120000.json
```

### Result File Structure

Each JSON file contains:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique run identifier (format: `run-YYYYMMDD-HHMMSS`) |
| `timestamp` | string | ISO 8601 timestamp of when the run started |
| `task` | string | Task name from the YAML file or "ad-hoc" |
| `harness` | string | Which AI tool was used |
| `instructions` | string | Path to the instruction file that was injected |
| `status` | string | `success`, `error`, or `timeout` |
| `metrics.tokensInput` | number or null | Input tokens used (null if unavailable) |
| `metrics.tokensOutput` | number or null | Output tokens used |
| `metrics.tokensTotal` | number or null | Total tokens |
| `metrics.tokenSource` | string | `api`, `estimated`, or `unavailable` |
| `scores.correctness` | number or null | 0.0-1.0, from assertion results |
| `scores.precision` | number or null | 0.0-1.0, from file change analysis |
| `scores.efficiency` | number or null | 0.0-1.0, from token usage |
| `scores.conventions` | number or null | 0.0-1.0, from convention assertions |
| `scores.overall` | number or null | Weighted average of available dimensions |
| `scores.confidenceAdjustedOverall` | number or null | Overall score multiplied by detection confidence (harvested tasks only) |
| `assertions` | array | Each assertion with type, expected, actual, passed |
| `diffSummary` | string | Summary of git diff (e.g., "3 files, +42/-8") |
| `model` | string or null | Model used (if available from harness) |
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
