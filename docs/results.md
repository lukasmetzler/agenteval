# Viewing and Comparing Results

Every eval run produces a JSON result file stored in `.agenteval/results/`. The `results` and `compare` commands let you browse, filter, export, and compare these results.

## Viewing Results

### List All Runs

```bash
agenteval results
```

Output:

```
  5 result(s):

  ID                        Task                 Harness        Score    Status
  ───────────────────────────────────────────────────────────────────────────────
  run-20260401-143022       refactor-auth        claude-code    0.85     success
  run-20260401-150000       refactor-auth        claude-code    0.72     success
  run-20260401-160000       harvest-abc123d      mock           0.90     success
  run-20260401-100000       add-tests            copilot        0.45     error
  run-20260331-200000       fix-login            claude-code    0.88     success
```

### Filter Results

```bash
# Show only results for a specific task
agenteval results --task refactor-auth

# Show only results from a specific harness
agenteval results --harness claude-code

# Show the last 3 results
agenteval results --limit 3
```

### Export Results

```bash
# JSON (for scripts and dashboards)
agenteval results --export json

# Markdown table (for reports and PRs)
agenteval results --export markdown
```

### Clean Up Old Results

Results accumulate over time. To remove results older than the retention period (default: 90 days):

```bash
agenteval results --prune
```

You can change the retention period in `agenteval.yaml`:

```yaml
run:
  resultRetention: "30d"   # Keep results for 30 days
```

## All Results Flags

| Flag | Default | Description |
|------|---------|-------------|
| `--task <name>` | | Filter by task name |
| `--harness <name>` | | Filter by harness |
| `--limit <n>` | all | Maximum number of results to show |
| `--export <format>` | console | Export as `json` or `markdown` |
| `--prune` | `false` | Delete results older than retention period |
| `--config <path>` | auto-discover | Path to `agenteval.yaml` |

## Comparing Two Runs

The real value of agenteval is comparing runs. Did your instruction change make things better?

```bash
agenteval compare run-20260401-143022 run-20260401-150000
```

Output:

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

### Compare Output Formats

```bash
# Console table (default)
agenteval compare run-A run-B

# JSON (for scripts)
agenteval compare run-A run-B --format json

# Markdown report
agenteval compare run-A run-B --report
# (same as --format markdown)
```

## All Compare Flags

| Flag | Short | Default | Description |
|------|-------|---------|-------------|
| `<runA>` | | Required | First run ID to compare |
| `<runB>` | | Required | Second run ID to compare |
| `--format <type>` | `-f` | `console` | Output format: `console`, `json`, or `markdown` |
| `--report` | | `false` | Generate markdown report (alias for `--format markdown`) |
| `--config <path>` | `-c` | auto-discover | Path to `agenteval.yaml` |

## Typical Workflow

1. Harvest tasks from git history: `agenteval harvest --output tasks/`
2. Run with current instructions: `agenteval run --task tasks/harvest-abc123.yaml`
3. Edit your CLAUDE.md
4. Run again: `agenteval run --task tasks/harvest-abc123.yaml`
5. Compare: `agenteval compare <run-id-1> <run-id-2>`
6. Repeat until the scores improve

## Where Results Are Stored

Results are JSON files in `.agenteval/results/` (configurable via `run.resultsDir` in `agenteval.yaml`). Each file is named by its run ID, e.g., `run-20260401-143022.json`.

You can read these files directly if you want to build your own analysis. They contain: scores per dimension, assertion pass/fail details, the git diff summary, timing, token usage, and error information.

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 2 | Run ID not found, or configuration error |
