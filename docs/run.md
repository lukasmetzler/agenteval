# Running Evals

The `run` command executes an AI coding agent against a defined task, then measures how well it performed. It creates an isolated git worktree, injects your instruction files, spawns the agent, captures what changed, and scores the result.

## When to Use This

- After changing your instruction files, to see if the agent performs better
- To compare how different instruction files perform on the same task
- To benchmark different AI tools (Claude Code vs Copilot vs Cursor) on the same task
- To build a regression test suite: "does my agent still pass these tasks after I changed the instructions?"

## Prerequisites

- A git repository (the runner uses git worktrees for isolation)
- An AI coding tool installed and accessible from the command line
- A task definition (YAML file or inline description)

## Basic Usage

```bash
# Run a task from a YAML file
agenteval run --task tasks/refactor-auth.yaml

# Run an ad-hoc task (no YAML needed)
agenteval run --task "refactor the auth module to use structured logging"

# Run a task by name (looks in tasks/ directory)
agenteval run --task refactor-auth

# Specify which AI tool to use
agenteval run --task tasks/refactor-auth.yaml --harness claude-code

# Use a different instruction file
agenteval run --task tasks/refactor-auth.yaml --instructions AGENTS.md
```

## All Flags

| Flag | Short | Required | Default | Description |
|------|-------|----------|---------|-------------|
| `--task <task>` | | Yes | | Task YAML file path, task name from `tasks/`, or inline description |
| `--harness <name>` | | No | from task YAML or `auto` | Which AI tool to use: `claude-code`, `opencode`, `copilot`, `generic`, `mock` |
| `--instructions <path>` | | No | `CLAUDE.md` | Path to the instruction file to inject |
| `--config <path>` | `-c` | No | auto-discover | Path to `agenteval.yaml` |

## Task Definition Files

A task YAML file tells agenteval what to ask the agent to do and how to score the result:

```yaml
# tasks/refactor-auth.yaml
name: refactor-auth
description: "Refactor auth module to use structured logger"
prompt: "Replace all console.log calls in src/auth/ with logger.info from src/utils/logger.ts"
harness: auto
timeout: 120

assertions:
  - type: files-changed
    pattern: "src/auth/**"
  - type: files-unchanged
    pattern: "src/billing/**"
  - type: test-pass
    command: "bun test"
  - type: convention
    pattern: "logger\\.info"
    expect: present-in-changes

scoring:
  correctness: 0.4
  precision: 0.3
  efficiency: 0.2
  conventions: 0.1
```

### Task Fields

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `name` | Yes | | A short name for this task (used in result IDs) |
| `description` | Yes | | Human-readable description of what the task does |
| `prompt` | No | same as description | The exact prompt sent to the AI agent |
| `harness` | No | `auto` | Which AI tool to use |
| `timeout` | No | `300` (seconds) | How long to wait before killing the agent |
| `assertions` | No | `[]` | List of checks to run on the agent's output |
| `scoring` | No | see below | How to weight different quality dimensions |

### Assertion Types

Assertions define what "success" looks like. Each assertion is checked after the agent finishes:

| Type | What it checks | Fields |
|------|---------------|--------|
| `files-changed` | Did the agent modify files matching this pattern? | `pattern`: glob pattern |
| `files-unchanged` | Did the agent leave these files alone? | `pattern`: glob pattern |
| `test-pass` | Does this command exit with code 0? | `command`: shell command to run |
| `convention` | Does the diff contain/not contain this pattern? | `pattern`: regex, `expect`: `present-in-changes` |

### Scoring Weights

Scoring weights control how different quality dimensions contribute to the overall score. They should sum to 1.0:

| Dimension | Default | What it measures |
|-----------|---------|-----------------|
| `correctness` | 0.4 | Did the agent make the right changes? (from assertions) |
| `precision` | 0.3 | Did the agent avoid unnecessary changes? |
| `efficiency` | 0.2 | How quickly and with how few tokens? |
| `conventions` | 0.1 | Did the agent follow code conventions? |

### Ad-Hoc Tasks

If you don't want to create a YAML file, pass a description directly:

```bash
agenteval run --task "add error handling to the API endpoints in src/api/"
```

This creates a temporary task with no assertions and default scoring. Useful for quick experiments.

## Harness Adapters

A "harness" is the AI coding tool that agenteval spawns to do the work. Each adapter knows how to launch the tool and capture its output.

| Harness | Tool | How it works |
|---------|------|-------------|
| `claude-code` | Claude Code CLI | Runs `claude --print --dangerously-skip-permissions` |
| `generic` | Any CLI tool | Configurable command and args (see [Configuration](configuration.md)) |
| `mock` | Testing only | Makes deterministic file changes without a real agent |
| `auto` | Automatic | Detects which tools are installed and picks one |

### Custom Harness

To use your own AI tool, add it to `agenteval.yaml`:

```yaml
harnesses:
  my-agent:
    command: "my-agent-cli"
    args: ["--run", "--non-interactive"]
    instructionPath: "AGENTS.md"
```

Then reference it: `agenteval run --task my-task.yaml --harness my-agent`

## How It Works

1. **Create worktree**: agenteval creates an isolated git worktree (a separate checkout of your repo)
2. **Inject instructions**: Your CLAUDE.md (or specified instruction file) is copied into the worktree
3. **Spawn agent**: The AI coding tool runs in the worktree with your task prompt
4. **Capture diff**: After the agent finishes (or times out), agenteval captures the git diff
5. **Score**: Assertions are checked, scoring weights applied, overall score computed
6. **Store**: The result is saved as JSON in `.agenteval/results/`

Worktrees are automatically cleaned up after each run. Stale worktrees (older than 1 hour) are removed on the next run.

## What You Get Back

After a run completes, you'll see:

```
✓ Run complete: run-20260401-143022
  Score: 0.85
  Files changed: 3 files (+42/-8)
  Tokens: ~12,500
  Saved to: .agenteval/results/run-20260401-143022.json
```

The JSON result file contains the full details: scores per dimension, assertion results, diff summary, timing, and token usage.

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Run completed successfully |
| 1 | Run completed with errors or timeout |
| 2 | Configuration error (bad task file, missing harness, etc.) |
