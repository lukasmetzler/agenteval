# Core Concepts

## What agenteval Does

You write instruction files for AI coding tools -- CLAUDE.md, AGENTS.md, GEMINI.md, `.cursor/rules/` -- that tell agents how to write code in your project. agenteval measures whether those instructions actually work by running controlled evals and scoring the results. Change your instructions, re-run the evals, and see if the scores improve.

## The Five Concepts

### 1. Instruction Files

Instruction files are the files that tell AI coding tools how to write code in your project: CLAUDE.md for Claude Code, AGENTS.md for Codex, OpenCode, Cursor, Devin, and Amp, GEMINI.md for Gemini CLI, `.cursor/rules/` for Cursor's rule files, `.github/copilot-instructions.md` for GitHub Copilot. Skills (`SKILL.md`) and subagent files under `.claude/` count too. Think of them as a style guide for your AI pair programmer.

agenteval lints these files for quality problems (bloat, broken references, contradictions) and uses them as the variable in your evals. The core question is always: "does changing this instruction file make the agent perform better or worse?"

### 2. Tasks

A task is a coding challenge you give to an AI agent. Tasks are defined in YAML files with a prompt ("fix the null pointer in the parser"), a timeout, and expected outcomes. You can write tasks by hand or generate them automatically from your git history using the `harvest` command.

```yaml
name: fix-null-pointer
description: "Fix the null pointer in the parser"
prompt: "Fix the null pointer exception in src/parser.ts"
timeout: 120
assertions:
  - type: files-changed
    pattern: "src/parser.ts"
  - type: test-pass
    command: "bun test"
```

### 3. Assertions

Assertions are the expected outcomes of a task -- the "how do I know if the agent did the right thing?" part. After the agent finishes, agenteval checks each assertion and records pass or fail. There are six types:

| Type | What it checks |
|------|---------------|
| `files-changed` | The agent modified files matching a glob pattern |
| `files-unchanged` | The agent did not touch files matching a pattern |
| `test-pass` | A shell command exits with code 0 |
| `no-new-warnings` | With `command`: the command exits with code 0. Without `command`: same as `lint-delta` |
| `convention` | A regex pattern is present (or absent) in the lines the diff adds |
| `lint-delta` | The repo's detected linters and type checker report no new findings on the lines the agent changed |

### 4. Harnesses

A harness is the adapter between agenteval and your AI coding tool. agenteval does not call AI APIs directly -- it spawns your locally installed tool (Claude Code, Copilot, etc.) as a subprocess. The harness handles checking that the tool is installed, injecting your instruction files, running the agent, and parsing token usage from the output.

Built-in harnesses: `claude-code`, `codex`, `gemini`, `antigravity`, `copilot`, `cursor`, `opencode`, `devin` (`windsurf` is an alias), `amp`, and `mock` (for testing). Any other CLI can be added as a custom harness under the `harnesses:` key in `agenteval.yaml`. Set `auto` to let agenteval pick: it uses the first installed agent CLI whose instruction file exists in your project, or the first installed agent CLI if none match.

### 5. Scoring

Every eval run produces scores across four dimensions, each from 0 to 1:

| Dimension | What it measures |
|-----------|-----------------|
| **correctness** | Did the agent produce the right change? (pass rate of the assertions other than `convention` and `lint-delta`) |
| **precision** | Did it only change what needed changing? (no unrelated edits) |
| **efficiency** | How many tokens did it use relative to `run.tokensBudget`? (cache reads are not counted) |
| **conventions** | Did it follow the project's coding conventions? (`convention` and `lint-delta` assertions) |

These combine into a weighted overall score. Default weights are 0.4 / 0.3 / 0.2 / 0.1, but you can tune them per task. If a dimension has no data (no convention or lint-delta assertions, or the harness reports no token counts), its weight is redistributed to the others.

## The Workflow

```mermaid
flowchart TD
    L["agenteval lint"] -->|"Are my instructions well-written?"| H
    H["agenteval harvest"] -->|"Turn git history into eval tasks"| R
    R["agenteval run"] -->|"How does my agent perform?"| C
    C["agenteval compare"] -->|"Did my changes help?"| D{{"Iterate"}}
    D --> L

    style D fill:#1a7f37,stroke:#2ea043,color:#fff
```

**lint** -- Run this first. Catches bloated files, broken references, and contradictions before you waste time on evals. Works in CI.

**harvest** -- Scans your git history for AI-assisted commits and generates task YAML from them. Gives you a ready-made benchmark suite from real work.

**run** -- Executes a task in an isolated git worktree, scores the result, and saves it. This is the core eval loop.

**compare** -- Shows a side-by-side score comparison of two runs. This is how you know whether an instruction change helped or hurt.

## What's Next

Read the [Getting Started](getting-started.md) guide for a hands-on walkthrough that takes you from installation to a scored eval run in 5 minutes.
