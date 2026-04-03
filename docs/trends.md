# Trends

## Overview

The `trends` command shows score history and trend analysis for eval tasks. Use it to track whether your instruction changes are improving agent performance over time, or to get a high-level view of all tasks at once.

## Command Reference

```bash
agenteval trends [options]
```

| Flag | Description | Default |
|------|-------------|---------|
| `--task <name>` | Show history for a specific task | (none -- shows all tasks) |
| `--all` | Show summary across all tasks | Default when no `--task` |
| `--limit <n>` | Max runs to show per task | 20 |
| `--format <type>` | Output format: `console`, `json`, `markdown` | `console` |
| `-c, --config <path>` | Path to agenteval.yaml | Auto-detected |

## Single Task Mode

Show the full run history for one task:

```bash
agenteval trends --task harvest-abc123
```

```
  agenteval trends . harvest-abc123
  ---------------------------------

  | Run                      | Date       | Score | Delta  |
  |--------------------------|------------|-------|--------|
  | run-20260401-101530      | 2026-04-01 |  0.72 |    --- |
  | run-20260402-143022      | 2026-04-02 |  0.78 | +0.06  |
  | run-20260403-091500      | 2026-04-03 |  0.85 | +0.07  |
  | run-20260403-150000      | 2026-04-03 |  0.91 | +0.06  |

  Trend    improving (+0.19 over 4 runs)
  Best     0.91 (run-20260403-150000)
  Worst    0.72 (run-20260401-101530)
  Average  0.82
```

## All Tasks Mode

Get a summary across every task that has stored results:

```bash
agenteval trends
```

```
  agenteval trends
  ----------------

  | Task             | Runs | Latest | Best   | Worst  | Trend       |
  |------------------|------|--------|--------|--------|-------------|
  | harvest-abc123   |    4 |   0.91 |   0.91 |   0.72 | improving   |
  | harvest-def456   |    3 |   0.85 |   0.88 |   0.85 | stable      |
  | harvest-789bcd   |    2 |   0.60 |   0.78 |   0.60 | regressing  |

  9 runs across 3 tasks
  Average latest score: 0.79
```

## Trend Detection

Trend direction is determined by looking at the **last 3 scores** (or fewer if less data) for a task:

| Trend | Condition |
|-------|-----------|
| **improving** | All recent deltas are positive (above 0.01 tolerance) |
| **regressing** | All recent deltas are negative (below -0.01 tolerance) |
| **stable** | Mixed direction or all deltas within tolerance |

The 0.01 tolerance prevents noise from triggering false trend signals.

## Output Formats

### JSON

```bash
agenteval trends --format json
```

Returns structured data with task summaries, full history arrays, and an overall summary object. Useful for piping into dashboards or other tools.

### Markdown

```bash
agenteval trends --format markdown
```

Produces a standard markdown table suitable for pasting into PRs, docs, or reports.
