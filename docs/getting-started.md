# Getting Started

agenteval measures whether your AI coding instruction files (CLAUDE.md, AGENTS.md, .cursorrules, copilot-instructions.md) actually make agents perform better. It gives you a feedback loop: change your instructions, run evals, see if the agent improved.

## What You Need

- [Bun](https://bun.sh) v1.3+ (runtime)
- A git repository with AI coding instruction files
- For eval runs: an AI coding tool installed (Claude Code, Copilot, etc.)

## Installation

```bash
git clone https://github.com/lukasmetzler/agenteval.git
cd agenteval
bun install
```

Or download a prebuilt binary from [GitHub Releases](https://github.com/lukasmetzler/agenteval/releases).

## Your First Lint

The fastest way to get value is linting your existing instruction files. agenteval auto-discovers common instruction files in your project:

```bash
# From your project directory
agenteval lint
```

This scans for CLAUDE.md, AGENTS.md, .github/copilot-instructions.md, and similar files. It checks for 24 quality issues: bloat, overlap between files, vague instructions, broken references, context budget overruns, and more.

You'll see output like:

```
  3 files analyzed, 847 diagnostics

  CLAUDE.md
    warning  token-count/file-too-large    File uses ~9,200 tokens (limit: 8,000)
    info     bloat/filler-phrases           "Please ensure" at line 42
    error    dead-ref/missing-file          References "src/utils/auth.ts" which doesn't exist

  AGENTS.md
    warning  overlap/high-similarity        72% overlap with CLAUDE.md sections 3-5
```

## Your First Eval Run

Once you've linted your instructions, you can run an actual eval. You need a task definition (a YAML file describing what to test) and an AI coding tool installed.

```bash
# Run a task defined in a YAML file
agenteval run --task tasks/refactor-auth.yaml

# Or describe the task inline
agenteval run --task "refactor the auth module to use structured logging"
```

The runner creates an isolated git worktree, injects your instructions, spawns the AI agent, then captures and scores the result.

See [Running Evals](run.md) for the full guide.

## Mining Your Git History

If your team has been using AI coding tools, your git history already contains eval data. The harvest command finds those AI-involved commits and turns them into reusable benchmarks:

```bash
# See what AI commits are in your repo
agenteval harvest --dry-run

# Generate task YAML files from those commits
agenteval harvest --output tasks/harvested/
```

See [Harvesting from Git History](harvest.md) for the full guide.

## Configuration

agenteval works with zero config, but you can customize everything via `agenteval.yaml` in your project root:

```yaml
version: 1
model: claude-sonnet-4-20250514
contextBudget: 0.3

lint:
  maxTokensPerFile: 8000

run:
  timeout: 300

harvest:
  minConfidence: 0.5
```

See [Configuration Reference](configuration.md) for all options.

## What's Next

| I want to... | Command | Guide |
|---|---|---|
| Check my instruction files for quality issues | `agenteval lint` | [Linting Guide](lint.md) |
| Run an AI agent against a task and score it | `agenteval run` | [Running Evals](run.md) |
| Build eval datasets from my git history | `agenteval harvest` | [Harvesting Guide](harvest.md) |
| View and compare past eval results | `agenteval results` | [Results & Comparison](results.md) |
| Customize agenteval's behavior | Edit `agenteval.yaml` | [Configuration](configuration.md) |
