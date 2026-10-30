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
| `--limit <n>` | Max runs per task, counting from the newest | 20 |
| `--format <type>` | Output format: `console`, `json`, `markdown` | `console` |
| `-c, --config <path>` | Path to agenteval.yaml | Auto-detected |

## Single Task Mode

Show the full run history for one task:

```bash
agenteval trends --task refactor-auth
```

```
  agenteval trends · refactor-auth
  ────────────────────────────────

  ┌────────────────────────────┬──────────────┬─────────┬──────────┐
  │ Run                        │ Date         │ Score   │ Delta    │
  ├────────────────────────────┼──────────────┼─────────┼──────────┤
  │ run-20261030-203518-c0f006 │ 2026-10-30   │ 0.62    │ ---      │
  │ run-20261030-203527-cbe245 │ 2026-10-30   │ 0.81    │ +0.19    │
  │ run-20261030-203528-dcd4dc │ 2026-10-30   │ 1.00    │ +0.19    │
  └────────────────────────────┴──────────────┴─────────┴──────────┘

  Trend                ↑ improving (+0.38 over 3 runs)
  Best                 1.00 (run-20261030-203528-dcd4dc)
  Worst                0.62 (run-20261030-203518-c0f006)
  Average              0.81
```

Runs are listed oldest first. Each delta is the change from the previous run.

## All Tasks Mode

Get a summary across every task that has stored results:

```bash
agenteval trends
```

```
  agenteval trends
  ────────────────

  ┌────────────────────┬────────┬──────────┬──────────┬──────────┬───────────────┐
  │ Task               │ Runs   │ Latest   │ Best     │ Worst    │ Trend         │
  ├────────────────────┼────────┼──────────┼──────────┼──────────┼───────────────┤
  │ add-tests          │ 1      │ 0.00     │ 0.00     │ 0.00     │ → stable      │
  │ fix-login          │ 3      │ 0.71     │ 1.00     │ 0.71     │ ↓ regressing  │
  │ refactor-auth      │ 3      │ 1.00     │ 1.00     │ 0.62     │ ↑ improving   │
  └────────────────────┴────────┴──────────┴──────────┴──────────┴───────────────┘

  7 runs across 3 tasks
  Average latest score: 0.57
```

Every stored result counts, including runs that ended in `error` or `timeout`. Baseline-arm trials (`run --baseline`) are left out, since they ran without your instructions. A run without a score counts as 0.00, which is why `add-tests` above (a run whose setup command failed) shows 0.00.

## Trend Detection

Trend direction is determined by the **last 3 scores** for a task, which give up to two deltas. A delta counts as up when it is above +0.01 and as down when it is below -0.01; anything in between counts as neither.

| Trend | Condition |
|-------|-----------|
| **improving** | At least one delta is up and none is down |
| **regressing** | At least one delta is down and none is up |
| **stable** | One up and one down, no delta outside the tolerance, or fewer than 2 runs |

So `fix-login` above (1.00, 0.71, 0.71) is regressing: one delta is down and the other is within tolerance. The 0.01 tolerance prevents noise from triggering false trend signals.

## Output Formats

### JSON

```bash
agenteval trends --format json
```

Returns `{ tasks, summary }`. Each entry in `tasks` has `task`, `runs`, `latest`, `best`, `worst`, `average`, `trend`, and a `history` array of `{ id, date, score, delta }`. `summary` has `totalRuns`, `totalTasks`, and `averageLatest`. Useful for piping into dashboards or other tools.

### Markdown

```bash
agenteval trends --format markdown
```

Produces a standard markdown table suitable for pasting into PRs, docs, or reports. With `--task`:

```markdown
# Trends: fix-login

| Run | Date | Score | Delta |
|-----|------|-------|-------|
| run-20261030-203526-172b38 | 2026-10-30 | 1.00 | --- |
| run-20261030-203528-2ff4ea | 2026-10-30 | 0.71 | -0.29 |
| run-20261030-203538-026797 | 2026-10-30 | 0.71 | +0.00 |

**Trend:** regressing
**Best:** 1.00 | **Worst:** 0.71 | **Average:** 0.81
```
