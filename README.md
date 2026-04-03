# agenteval

Measure whether your AI coding instructions (CLAUDE.md, AGENTS.md, copilot-instructions.md) actually make agents perform better -- not just hope they do.

[![CI](https://github.com/lukasmetzler/agenteval/actions/workflows/ci.yml/badge.svg)](https://github.com/lukasmetzler/agenteval/actions/workflows/ci.yml)

## How It Works

```
Your CLAUDE.md ──> agenteval lint ──> Fix quality issues
                         |
Git history ────> agenteval harvest ──> Task YAML files
                                              |
                                    agenteval run ──> Scored results
                                              |
                              agenteval compare ──> "Did my instructions improve?"
```

**Lint** catches problems statically -- bloat, dead references, contradictions, wasted context budget -- so you fix them before an agent ever sees your instructions.

**Harvest** turns your git history into eval tasks. If your team has been using AI coding tools, those commits already contain the prompts, diffs, and test outcomes you need for benchmarks.

**Run** gives a task to an AI agent in an isolated worktree, captures what it produces, and scores the result against assertions you define.

**Compare** puts two runs side by side so you can answer the only question that matters: did changing your instructions make the agent better or worse?

## Quick Start

```bash
git clone https://github.com/lukasmetzler/agenteval.git
cd agenteval && bun install
bun run dev -- lint          # analyzes your instruction files
```

You will see diagnostics like dead references, token bloat, and overlap between files. Follow the [Getting Started guide](docs/getting-started.md) for the full walkthrough -- from first lint to a scored comparison.

## Commands

| Command | What it does | Guide |
|---------|-------------|-------|
| `agenteval lint` | Static analysis of instruction files | [Linting](docs/lint.md) |
| `agenteval harvest` | Mine git history for eval task YAML | [Harvesting](docs/harvest.md) |
| `agenteval run` | Run an agent against a task and score it | [Running Evals](docs/run.md) |
| `agenteval results` | View and export stored eval results | [Results](docs/results.md) |
| `agenteval compare` | Compare two runs side by side | [Results](docs/results.md) |

## Documentation

| Guide | What it covers |
|-------|---------------|
| [Core Concepts](docs/concepts.md) | The 5 key ideas (instructions, tasks, assertions, harnesses, scoring) in plain English |
| [Getting Started](docs/getting-started.md) | Installation, first run, overview of all features |
| [Linting Guide](docs/lint.md) | All 24 lint rules, output formats, CI integration, inline suppression |
| [Running Evals](docs/run.md) | Task definitions, harness adapters, scoring, the full eval pipeline |
| [Harvesting from Git History](docs/harvest.md) | AI commit detection, task generation, confidence tuning |
| [Results & Comparison](docs/results.md) | Viewing, filtering, exporting, and comparing eval runs |
| [Configuration Reference](docs/configuration.md) | Every config option with types, defaults, and examples |

## Configuration

agenteval works with zero configuration. When you need to customize, create `agenteval.yaml`:

```yaml
version: 1
instructionGlobs: ["CLAUDE.md", "AGENTS.md"]
contextBudget: 0.3
```

See [Configuration Reference](docs/configuration.md) for the full schema.

## Installation

**From source** (requires [Bun](https://bun.sh) v1.3+):

```bash
git clone https://github.com/lukasmetzler/agenteval.git
cd agenteval && bun install && bun run build
./dist/agenteval --version
```

**From releases**: download the latest binary from [GitHub Releases](https://github.com/lukasmetzler/agenteval/releases) and place it on your PATH.

## License

MIT
