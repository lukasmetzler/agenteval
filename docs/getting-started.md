# Getting Started with agenteval

New to agenteval? Read [Core Concepts](concepts.md) first to understand the terminology.

## The Problem

Every team using AI coding tools has instruction files -- CLAUDE.md, AGENTS.md, .cursorrules, copilot-instructions.md -- but nobody tests them. You write a rule like "always use structured logging" and hope the agent follows it. You add a section about your testing conventions and have no idea if it changes the agent's behavior. Instructions accumulate, bloat, contradict each other, and rot.

agenteval gives you a feedback loop. It statically analyzes your instruction files for quality issues (bloat, overlap, dead references), then lets you run controlled evals: give an AI agent a task, measure what it produces, and score the result. Change your instructions, run the eval again, and see whether the agent actually improved.

The workflow looks like this:

```
lint instructions -> harvest tasks from git -> run evals -> compare results
```

## Prerequisites

| Requirement | Version | Purpose |
|---|---|---|
| git | 2.20+ | Worktree isolation, harvest history scanning |
| AI coding tool | Any | Required only for `run` command (Claude Code, Copilot, etc.) |
| [Bun](https://bun.sh) | v1.3+ | Only needed for building from source |

You also need a git repository containing at least one AI instruction file. If you do not have one yet, create a `CLAUDE.md` in your project root with a few rules and agenteval will find it automatically.

## Installation

agenteval ships as a standalone binary. No Bun or Node required to run it.

### npm (recommended)

```bash
npm install -g agenteval-cli
```

Downloads the prebuilt binary for your platform during install. Also works with `npx agenteval-cli lint` for one-off use. Updates with `npm update -g agenteval-cli`.

### Homebrew

```bash
brew tap lukasmetzler/agenteval
brew install agenteval
```

Adds the tap once, then installs the latest binary. Works on macOS and Linux. Updates with `brew upgrade agenteval`.

### Shell script

```bash
curl -fsSL https://raw.githubusercontent.com/lukasmetzler/agenteval/main/install.sh | bash
```

Downloads the latest binary for your platform (Linux x64, macOS ARM64/x64) and puts it in `~/.local/bin/`.

### From prebuilt binary

Download the latest binary for your platform from [GitHub Releases](https://github.com/lukasmetzler/agenteval/releases), make it executable, and add it to your PATH.

### From source

Requires [Bun](https://bun.sh) v1.3+:

```bash
git clone https://github.com/lukasmetzler/agenteval.git
cd agenteval
bun install
bun run build
```

### Updating

Already have agenteval installed? Update to the latest version:

```bash
agenteval update
```

agenteval also checks for updates in the background (once per day) and shows a one-time notification when a new version is available.

### Running

After building, you can either run the binary directly:

```bash
./agenteval lint
```

Or use it in development mode from the repo:

```bash
bun run dev -- lint
```

### Verify the installation

Check that agenteval is installed and shows the current version:

```bash
agenteval --version
```

Then confirm all commands are available:

Run the help command to confirm everything works:

```bash
agenteval --help
```

You should see the list of available commands: `lint`, `run`, `harvest`, `results`, `compare`, `trends`, `ci`, and `update`.

## 5-Minute Quickstart

This walkthrough takes you from zero to a scored eval run. You will lint your instruction files, harvest tasks from your git history, run an eval, and compare results.

### Step 1: Lint your instruction files

Navigate to your project directory and run:

```bash
cd /path/to/your/project
agenteval lint
```

agenteval auto-discovers instruction files matching these default globs:

| Pattern | Description |
|---|---|
| `CLAUDE.md` | Claude Code project instructions |
| `AGENTS.md` | Multi-agent instruction file |
| `.github/copilot-instructions.md` | GitHub Copilot instructions |
| `.claude/**/*.md` | Claude skill and config files |
| `.github/instructions/*.md` | GitHub Copilot workspace instructions |

You can also pass explicit globs:

```bash
agenteval lint "**/*.instructions.md" ".cursorrules"
```

Example output:

```
  3 files analyzed, ~2,340 tokens, 12 diagnostics (47ms)

  CLAUDE.md
    error    dead-ref/missing-file          References "src/utils/auth.ts" which doesn't exist
    warning  token-count/file-too-large     File uses ~9,200 tokens (limit: 8,000)
    warning  bloat/high-bloat-score         Bloat score 0.54 exceeds threshold 0.50
    info     bloat/filler-phrases           "Please ensure" at line 42 (filler)

  AGENTS.md
    warning  overlap/high-similarity        72% overlap with CLAUDE.md sections 3-5
    info     dead-section/unused-heading    Section "## Legacy Migration" has no actionable content

  .github/copilot-instructions.md
    info     context-budget/budget-ok       1,240 tokens (within budget)
```

The linter runs seven rules:

| Rule | What it checks |
|---|---|
| `token-count` | File and total token counts against configured limits |
| `bloat` | Filler phrases, redundant wording, low signal-to-noise ratio |
| `overlap` | Duplicated content across multiple instruction files |
| `dead-ref` | References to files, paths, or commands that do not exist |
| `dead-section` | Headings with no actionable content beneath them |
| `context-budget` | Whether total instruction tokens exceed your model's context budget |
| `anti-pattern` | Custom patterns you define in config (e.g., banned phrases) |
| `skill-validator` | Validates frontmatter fields in skill/instruction files |

If any diagnostic has severity `error`, the command exits with code 1. This makes it suitable for CI pipelines:

```bash
# In your CI script
agenteval lint --severity error --format json
```

### Step 2: Harvest tasks from git history

If your team has been using AI coding tools, your git history already contains eval data. The `harvest` command scans commits for AI involvement (Co-authored-by trailers, known bot email patterns, commit message markers) and generates task YAML files from them.

Start with a dry run to see what it finds:

```bash
agenteval harvest --dry-run
```

Example output:

```
  Harvest Dry Run
  ===============

  Commits scanned:   142
  AI commits found:  23

  Detected tasks:
    * fix-auth-token-refresh (a1b2c3d)
    * add-structured-logging (d4e5f6a)
    * refactor-db-connection-pool (7b8c9d0)
```

If it finds commits, generate the task files:

```bash
agenteval harvest
```

This writes YAML files to `tasks/harvested/` by default:

```
tasks/harvested/
  fix-auth-token-refresh.yaml
  add-structured-logging.yaml
  refactor-db-connection-pool.yaml
```

Each task file contains a prompt, expected file changes, and scoring weights derived from the original commit. You can edit these files to refine the expected outcomes (called assertions).

If no AI commits are detected, the tool suggests lowering the confidence threshold:

```bash
agenteval harvest --min-confidence 0.3
```

The confidence threshold (0 to 1) controls how certain harvest needs to be that a commit involved an AI tool before generating a task from it.

You can also review your current working tree changes against quality rubrics:

```bash
agenteval harvest --live                  # Heuristic rubrics (scope, tests, hygiene)
agenteval harvest --live --analyze        # + LLM-assisted rubrics (conventions, scope)
```

If you haven't used an AI coding tool yet, skip the harvest step. You can write task YAML files by hand instead -- see [Running Evals](run.md) for the task format.

See the [Harvesting Guide](harvest.md) for full details on live review, GitHub enrichment (`--github`), and instruction snapshots.

### Step 3: Run an eval

Pick a harvested task (or write your own) and run it:

```bash
agenteval run --task tasks/harvested/fix-auth-token-refresh.yaml
```

What happens behind the scenes:

1. agenteval creates an isolated copy of your repo (a git worktree) so your working tree is untouched
2. It copies your instruction file (default: `CLAUDE.md`) into the worktree
3. It spawns the configured AI agent with the task prompt
4. When the agent finishes (or times out), agenteval captures the diff
5. It scores the result against the task's assertions
6. The result is saved to `.agenteval/results/`

Example output on success:

```
  Run complete: run-20260401-143022-a1b2c3d

  Score: 0.85
  Files changed: 3 files (+42, -18)
  Tokens: ~12,400
  Saved to: .agenteval/results/run-20260401-143022-a1b2c3d.json
```

You can also describe a task inline without a YAML file:

```bash
agenteval run --task "refactor the auth module to use structured logging"
```

To test a different instruction file, use `--instructions`:

```bash
agenteval run --task tasks/harvested/fix-auth-token-refresh.yaml \
  --instructions instructions-v2/CLAUDE.md
```

### Step 4: Compare two runs

After running the same task with different instructions (or different versions of the same instructions), compare the results:

```bash
agenteval compare run-20260401-143022-a1b2c3d run-20260401-151200-e4f5g6h
```

This shows a side-by-side breakdown of scores, token usage, and assertion outcomes. You can also generate a markdown report:

```bash
agenteval compare run-20260401-143022-a1b2c3d run-20260401-151200-e4f5g6h --report
```

### Step 5: View all results

To see every eval run you have stored:

```bash
agenteval results
```

Example output:

```
  4 result(s):

  ID                        Task                 Harness        Score    Status
  ---------------------------------------------------------------------------
  run-20260401-143022-a1b   fix-auth-token       claude-code    0.85     success
  run-20260401-151200-e4f   fix-auth-token       claude-code    0.72     success
  run-20260401-160000-x7y   add-logging          claude-code    0.91     success
  run-20260330-120000-m2n   refactor-db-pool     mock           0.60     success
```

Filter by task or harness:

```bash
agenteval results --task fix-auth-token --harness claude-code
```

Export as JSON for further analysis:

```bash
agenteval results --export json > results.json
```

### Step 6: Run CI regression checks

Once you have harvested tasks, you can run all of them in one go and fail if any score drops below a threshold or regresses compared to the previous run:

```bash
agenteval ci
```

This is designed for CI pipelines. It discovers all YAML files in `tasks/harvested/`, runs each one, compares against the most recent previous result for the same task, and exits with code 1 if any task fails.

Configure thresholds:

```bash
agenteval ci --min-score 0.7 --max-regression 0.05
```

Or set defaults in `agenteval.yaml`:

```yaml
ci:
  tasksDir: "tasks/harvested"
  minScore: 0.7
  maxRegression: 0.05
  instructions: "CLAUDE.md"
```

Example GitHub Actions step:

```yaml
- uses: lukasmetzler/agenteval@v0
  with:
    command: ci
```

## Project Structure

After using agenteval, your project will contain these generated files and directories:

```
your-project/
  agenteval.yaml              # Optional config file (you create this)
  CLAUDE.md                   # Your instruction file (already exists)
  tasks/                      # Task definitions
    harvested/                # Auto-generated by `harvest`
      fix-auth-token.yaml
      add-logging.yaml
    custom/                   # Your hand-written tasks (optional)
      my-eval-task.yaml
  .agenteval/                 # Auto-generated working directory
    results/                  # Eval run results (JSON files)
      run-20260401-143022-a1b2c3d.json
    worktrees/                # Temporary git worktrees (cleaned up automatically)
```

| Path | Created by | Committed to git? |
|---|---|---|
| `agenteval.yaml` | You (manually) | Yes |
| `tasks/` | `harvest` or you | Yes -- these are your eval benchmarks |
| `.agenteval/results/` | `run` | Your choice -- useful to track over time |
| `.agenteval/worktrees/` | `run` | No -- add to `.gitignore` |

Add this to your `.gitignore`:

```
.agenteval/worktrees/
```

## Configuration

agenteval works with zero configuration. Every setting has a sensible default. When you need to customize behavior, create an `agenteval.yaml` file in your project root:

```yaml
version: 1

# Which instruction files to scan (glob patterns)
instructionGlobs:
  - "CLAUDE.md"
  - "AGENTS.md"
  - ".github/copilot-instructions.md"

# Target model for context budget calculations
model: claude-sonnet-4-6

# Max fraction of context window your instructions should consume
contextBudget: 0.3

lint:
  maxTokensPerFile: 8000        # Warn if a single file exceeds this
  overlapThreshold: 0.3         # Flag file pairs with similarity above this
  bloatThreshold: 0.5           # Flag files with bloat score above this

run:
  timeout: 300                  # Seconds before killing the agent
  tokensBudget: 50000           # Token budget passed to the agent
  resultsDir: ".agenteval/results"

harvest:
  outputDir: "tasks/harvested"
  minConfidence: 0.5            # 0-1, how certain a commit is AI-involved
  defaultHarness: "auto"        # auto-detect which tool made the commit
  defaultTimeout: 300
```

The only required field is `version: 1`. Everything else falls back to defaults.

See [Configuration Reference](configuration.md) for the complete schema.

## Task YAML Format

Whether harvested or hand-written, task files follow this structure:

```yaml
name: fix-auth-token-refresh
description: Fix the auth token refresh logic to handle expired tokens gracefully
prompt: |
  The auth token refresh in src/auth/refresh.ts fails silently when the token
  is expired. Fix it so that expired tokens trigger a re-authentication flow
  and log a warning.
harness: claude-code
timeout: 300
assertions:
  - type: files-changed
    pattern: "src/auth/refresh.ts"
  - type: test-pass
    command: "bun test src/auth/"
  - type: no-new-warnings
    command: "bun run typecheck"
scoring:
  correctness: 0.4
  precision: 0.3
  efficiency: 0.2
  conventions: 0.1
```

| Assertion type | What it checks |
|---|---|
| `files-changed` | The agent modified files matching the glob pattern |
| `files-unchanged` | The agent did not touch files matching the pattern |
| `test-pass` | A command exits with code 0 |
| `no-new-warnings` | A command produces no more warnings than before the run |
| `convention` | A custom pattern or rule that the diff must satisfy |

## Supported Harnesses

A harness is the adapter between agenteval and your AI tool (called a "harness" because it wraps the tool in a standard interface). Each harness knows how to inject instructions and spawn the agent.

| Harness | Tool | Status |
|---|---|---|
| `claude-code` | Claude Code CLI | Supported |
| `cursor` | Cursor AI | Supported |
| `opencode` | OpenCode | Supported |
| `windsurf` | Windsurf (Codeium) | Supported |
| `copilot` | GitHub Copilot | Supported |
| `generic` | Any CLI tool | Supported (configure via `harnesses` in config) |
| `mock` | Built-in mock | For testing agenteval itself |
| `auto` | Auto-detect | Picks the best available harness |

To configure a custom harness for a tool not listed above:

```yaml
version: 1
harnesses:
  my-tool:
    command: "my-ai-tool"
    args: ["--non-interactive", "--prompt"]
    instructionPath: ".my-tool/instructions.md"
```

## Common Questions

### Do I need an API key?

Not for agenteval itself. agenteval does not call any AI APIs directly. It spawns your locally installed AI coding tool (Claude Code, Copilot, etc.) as a subprocess. You need whatever credentials that tool requires -- typically an API key or OAuth session configured in the tool itself.

### Does it work with GitHub Copilot?

Yes. Set the harness to `copilot` either in your task YAML or on the command line:

```bash
agenteval run --task my-task.yaml --harness copilot
```

agenteval discovers `.github/copilot-instructions.md` by default during lint.

### Does it work with Cursor / .cursorrules?

You can lint `.cursorrules` files by adding the glob to your config or passing it directly:

```bash
agenteval lint ".cursorrules"
```

For running evals with Cursor, use the `generic` harness and configure the command in `agenteval.yaml`.

### Can I run this in CI?

Yes. The `lint` command exits with code 1 when errors are found, making it a drop-in for CI pipelines:

```yaml
# GitHub Actions example
- uses: lukasmetzler/agenteval@v0
  with:
    command: lint
    args: "--severity error"
```

The `run` command is also CI-compatible, though it requires the AI tool to be available in the CI environment.

### Where are results stored?

In `.agenteval/results/` by default (configurable via `run.resultsDir` in `agenteval.yaml`). Each result is a JSON file named by run ID. Results include scores, assertion outcomes, token usage, and diff summaries.

### How does scoring work?

Each task defines scoring weights across four dimensions:

| Dimension | What it measures |
|---|---|
| `correctness` | Did the agent produce the right change? (assertion pass rate) |
| `precision` | Did it change only what was needed? (no unrelated modifications) |
| `efficiency` | How many tokens and how long did it take? |
| `conventions` | Did it follow the project's coding conventions? |

The overall score is a weighted average. Default weights are equal (0.25 each) unless the task YAML specifies otherwise.

### How does harvest detect AI commits?

The harvest command looks for three signals:

| Detection method | Example |
|---|---|
| Co-author trailer | `Co-authored-by: Claude <noreply@anthropic.com>` |
| Author email pattern | Known bot/AI email addresses |
| Commit message pattern | Phrases associated with AI-generated commits |

Each detected commit receives a confidence score (0 to 1). Only commits above the configured `minConfidence` threshold produce task files.

### Can I prune old results?

Yes. The `results` command supports pruning based on a retention period:

```bash
agenteval results --prune
```

The default retention is 90 days, configurable via `run.resultRetention` in `agenteval.yaml`.

## Next Steps

| I want to... | Command | Guide |
|---|---|---|
| Understand the core concepts first | | [Core Concepts](concepts.md) |
| Check instruction files for quality issues | `agenteval lint` | [Linting Guide](lint.md) |
| Build eval tasks from git history | `agenteval harvest` | [Harvesting Guide](harvest.md) |
| Run an AI agent against a task and score it | `agenteval run` | [Running Evals](run.md) |
| View and filter stored results | `agenteval results` | [Results and Comparison](results.md) |
| Compare two eval runs side-by-side | `agenteval compare` | [Results and Comparison](results.md) |
| Track score history and trends over time | `agenteval trends` | [Trends](trends.md) |
| Run regression checks in CI | `agenteval ci` | [CI Guide](ci.md) |
| Update to the latest version | `agenteval update` | |
| Customize agenteval behavior | Edit `agenteval.yaml` | [Configuration Reference](configuration.md) |
