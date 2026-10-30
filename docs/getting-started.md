# Getting Started with agenteval

New to agenteval? Read [Core Concepts](concepts.md) first to understand the terminology.

## The Problem

Every team using AI coding tools has instruction files -- CLAUDE.md, AGENTS.md, GEMINI.md, Cursor rules, copilot-instructions.md -- but nobody tests them. You write a rule like "always use structured logging" and hope the agent follows it. You add a section about your testing conventions and have no idea if it changes the agent's behavior. Instructions accumulate, bloat, contradict each other, and rot.

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

agenteval ships as a standalone binary. The Homebrew, shell-script, and prebuilt-binary installs need neither Bun nor Node. The npm package is a small Node wrapper (Node 18+) that runs the same binary.

### npm (recommended)

```bash
npm install -g agenteval-cli
```

The package has no install script. On first run, its Node wrapper downloads the prebuilt binary for your platform (Linux x64, macOS ARM64/x64) to `~/.agenteval/bin/` and runs it from there; it downloads again when the package version changes. Also works with `npx -y agenteval-cli lint` for one-off use. Updates with `npm update -g agenteval-cli`.

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

Before running a command, agenteval checks GitHub for a newer release, at most once a day and with a 2-second timeout. When the latest release is newer than the installed version, the next command prints a one-line notice on stderr. The check is skipped when the `CI` environment variable is set or when `AGENTEVAL_NO_UPDATE_CHECK=1`.

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

Then run the help command to confirm all commands are available:

```bash
agenteval --help
```

You should see the list of available commands: `init`, `doctor`, `lint`, `run`, `results`, `compare`, `harvest`, `ci`, `trends`, `update`, and `watch`. Run `agenteval doctor` to check git, the config file, and which agent CLIs are installed.

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
| `**/CLAUDE.md`, `CLAUDE.local.md` | Claude Code project instructions, including nested ones |
| `**/AGENTS.md` | The cross-agent standard (Codex, Copilot, Cursor, OpenCode, Amp, Devin, ...) |
| `**/GEMINI.md` | Gemini CLI and Antigravity |
| `.claude/**/*.md` | Claude Code rules, skills, subagents, and commands |
| `.agents/skills/**/*.md` | Agent Skills shared across tools |
| `.github/copilot-instructions.md`, `.github/instructions/**/*.instructions.md` | GitHub Copilot |
| `.cursor/rules/**/*.{md,mdc}` | Cursor rules (Cursor reads only `.mdc`; lint warns about `.md` files there) |
| `.devin/rules/*.md`, `.windsurf/rules/*.md` | Devin / Windsurf rules |
| `.kiro/steering/*.md`, `.junie/**/*.md` | Kiro and JetBrains Junie |

The full table, including which agent reads which file, is in [Auto-Discovery](lint.md#auto-discovery). You can also pass explicit globs:

```bash
agenteval lint "docs/agents/*.md" ".cursorrules"
```

Example output (shortened):

```
  agenteval lint  ·  2 files  ·  ~118 tokens  ·  30ms
  ──────────────────────────────────────────────────────────────────────

  CLAUDE.md
     WARN   Role-playing preambles like "You are an expert...": "You are"  (anti-pattern/role-play)
           line 1
           → Remove the preamble — models already know how to code
     ERROR  Contradictory rules: both "always semicolons" and "never semicolons" found  (anti-pattern/contradictory-rules)
           → Remove one of the contradicting rules
     ERROR  Referenced file "src/auth/refresh.ts" does not exist  (dead-ref/missing-file)
           line 13
           → Remove the reference or create the missing file
     ERROR  `bun run lint` runs script "lint", which package.json does not define  (toolchain/missing-script)
           line 8
           → Available scripts: test

  .claude/skills/Deploy/SKILL.md
     ERROR  Skill name "Deploy" must contain only lowercase letters, numbers, and hyphens  (skill/name-invalid-chars)
           → Use only lowercase letters, numbers, and hyphens

  ──────────────────────────────────────────────────────────────────────
  4 errors  ·  3 warnings  ·  4 info
  Fix the errors above — they indicate broken references or contradictions that will confuse your AI agent.
```

The linter runs 65 rules in 12 categories:

| Category | What it checks |
|---|---|
| `token-count` | File and section sizes against configured limits |
| `overlap` | Duplicated content across instruction files |
| `bloat` | Low-density prose and filler phrases |
| `anti-pattern` | Role-play preambles, vague or contradictory rules, TODOs, plus custom patterns from config |
| `dead-ref` | File references, links, and anchors that point nowhere |
| `context-budget` | Tokens loaded at session start against your model's context budget |
| `skill` | `SKILL.md` files that break the Agent Skills spec |
| `frontmatter` | Wrong or unknown frontmatter on rules, subagents, commands, and per-agent rule files |
| `import` | `@path` imports that are missing, circular, or too deep |
| `agent-limits` | Content an agent truncates or ignores because of its documented limits |
| `toolchain` | Commands that don't match the repo's package manager, scripts, or linters |
| `drift` | Referenced files that changed long after the instructions describing them |

See the [Quick Overview](lint.md#quick-overview) and the rule reference in the [Linting Guide](lint.md) for details. Add `--explain` to print why each rule that fired matters and how to fix it.

If any diagnostic has severity `error`, the command exits with code 1. This makes it suitable for CI pipelines:

```bash
# In your CI script
agenteval lint --severity error --format json
```

### Step 2: Harvest tasks from git history

If your team has been using AI coding tools, your git history already contains eval data. The `harvest` command scans commits for AI involvement (Co-authored-by and agent session trailers, commits authored by an agent's own account, commit message markers like "Generated with Claude Code") and generates task YAML files from them.

Start with a dry run to see what it finds:

```bash
agenteval harvest --dry-run
```

Example output:

```
  agenteval harvest · dry run
  ───────────────────────────

  Commits scanned      4
  AI-assisted          2 (50%)

  ┌─────────┬──────────┬──────┬────────────────────────────────────────────┐
  │ Hash    │ Tool     │ Conf │ Message                                    │
  ├─────────┼──────────┼──────┼────────────────────────────────────────────┤
  │ 56b44e4 │ claude   │ 0.6  │ feat: add auth helper                      │
  │ e220da2 │ claude   │ 0.9  │ fix: handle null input in parser           │
  └─────────┴──────────┴──────┴────────────────────────────────────────────┘
  Completed in 0.0s
```

If it finds commits, generate the task files:

```bash
agenteval harvest
```

This writes one YAML file per commit to `tasks/harvested/` by default, named after the commit's short hash:

```
tasks/harvested/
  harvest-56b44e4.yaml
  harvest-e220da2.yaml
```

Each task file contains a prompt derived from the commit message, a `files-changed` assertion for every file the commit touched, a `test-pass` assertion when the commit touched test files, and a `lint-delta` assertion when the repo has a linter or type checker agenteval can run. Harvested tasks use fixed scoring weights (correctness 0.5, precision 0.3, efficiency 0.1, conventions 0.1). You can edit these files to refine the expected outcomes (called assertions).

The confidence threshold (`--min-confidence` or `harvest.minConfidence`, 0 to 1, default 0.5) controls how certain harvest needs to be that a commit involved an AI tool. Each signal has a fixed confidence: 0.9 for a co-author or session trailer, 0.8 for a commit authored by the agent's own account, 0.6 for a message pattern. Any threshold from 0 to 0.6 selects the same commits; 0.7 or 0.8 drops message-pattern matches. If no AI commits are detected, lowering the threshold won't help: the commits carry no signal agenteval recognizes.

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

1. agenteval creates an isolated copy of your repo (a git worktree) so your working tree is untouched. A harvested task starts from the parent of its source commit.
2. It runs the task's `setup` commands, if any
3. It copies your instruction file (default: `CLAUDE.md`) to the path the harness reads (`CLAUDE.md` for Claude Code, `AGENTS.md` for Codex, and so on)
4. It spawns the configured AI agent with the task prompt
5. When the agent finishes, agenteval captures the diff. If the agent times out, the run is saved with status `timeout` and no diff or scores.
6. It scores the result against the task's assertions
7. The result is saved to `.agenteval/results/`

Example output on success (from the `mock` harness, which reports no tokens; real harnesses add `Tokens`, `Cost`, and `Model` lines when the CLI reports them):

```
  agenteval run
  ─────────────

  Task                 refactor-auth
  Score                0.62/1.0
  Files changed        0 file(s) changed, 0 insertion(s), 0 deletion(s)
  Result               success
  Saved to             /path/to/project/.agenteval/results/run-20261030-203518-c0f006.json
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
agenteval compare run-20261030-203518-c0f006 run-20261030-203527-cbe245
```

This shows both runs side by side on the five scores (correctness, precision, efficiency, conventions, overall) with the delta for each. When both runs come from harvested tasks with instruction snapshots, it also lists which instruction files were added, removed, or changed. You can also generate a markdown report:

```bash
agenteval compare run-20261030-203518-c0f006 run-20261030-203527-cbe245 --report
```

### Step 5: View all results

To see every eval run you have stored:

```bash
agenteval results
```

Example output:

```
  Results (5)
  ───────────

  ┌──────────────────────────┬──────────────────┬─────────────┬───────┬─────────┐
  │ ID                       │ Task             │ Harness     │ Score │ Status  │
  ├──────────────────────────┼──────────────────┼─────────────┼───────┼─────────┤
  │ run-20261030-203528-2ff4ea │ fix-login        │ mock        │ 0.71  │ success │
  │ run-20261030-203528-dcd4dc │ refactor-auth    │ mock        │ 1.00  │ success │
  │ run-20261030-203527-cbe245 │ refactor-auth    │ mock        │ 0.81  │ success │
  │ run-20261030-203526-172b38 │ fix-login        │ mock        │ 1.00  │ success │
  │ run-20261030-203518-c0f006 │ refactor-auth    │ mock        │ 0.62  │ success │
  └──────────────────────────┴──────────────────┴─────────────┴───────┴─────────┘
```

Filter by task or harness:

```bash
agenteval results --task refactor-auth --harness claude-code
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

This is designed for CI pipelines. It picks up every `*.yaml` file directly in `tasks/harvested/` (subdirectories and `.yml` files are not read), runs each one, compares its score against the most recent previous result for the same task, and after all tasks have run exits with code 1 if any task failed.

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
  agenteval.yaml              # Optional config file (`agenteval init` or you)
  CLAUDE.md                   # Your instruction file (already exists)
  tasks/                      # Task definitions
    harvested/                # Auto-generated by `harvest`
      harvest-56b44e4.yaml
      harvest-e220da2.yaml
    custom/                   # Your hand-written tasks (optional)
      my-eval-task.yaml
  .agenteval/                 # Auto-generated working directory
    results/                  # Eval run results (JSON files)
      run-20261030-203518-c0f006.json
    worktrees/                # Temporary git worktrees (cleaned up automatically)
```

| Path | Created by | Committed to git? |
|---|---|---|
| `agenteval.yaml` | `agenteval init`, or you | Yes |
| `tasks/` | `harvest` or you | Yes -- these are your eval benchmarks |
| `.agenteval/results/` | `run` | Your choice -- useful to track over time |
| `.agenteval/worktrees/` | `run` | No -- add to `.gitignore` |

Add this to your `.gitignore`:

```
.agenteval/worktrees/
```

## Configuration

agenteval works with zero configuration. Every setting has a sensible default. When you need to customize behavior, run `agenteval init` to create a starter `agenteval.yaml` in your project root, or write one yourself:

```yaml
version: 1

# Which instruction files to scan (glob patterns).
# Leave this out to scan every known format.
instructionGlobs:
  - "CLAUDE.md"
  - "AGENTS.md"
  - ".github/copilot-instructions.md"

# Target model for context budget calculations
model: claude-opus-5-5

# Max fraction of context window your instructions should consume
contextBudget: 0.3

lint:
  maxTokensPerFile: 8000        # Warn if a single file exceeds this
  overlapThreshold: 0.3         # Flag file pairs with similarity above this
  bloatThreshold: 0.5           # Flag sections with a density score below this

run:
  timeout: 300                  # Seconds before killing the agent (when the task sets no timeout)
  tokensBudget: 50000           # Token count that scores 0 on efficiency (not passed to the agent)
  resultsDir: ".agenteval/results"

harvest:
  outputDir: "tasks/harvested"
  minConfidence: 0.5            # 0-1, how certain a commit is AI-involved
  defaultHarness: "auto"        # harness written into harvested tasks; auto is resolved at run time
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
  - type: no-new-warnings        # with a command: the command must exit 0
    command: "bun run typecheck"
  - type: lint-delta             # no new linter or type-checker findings on changed lines
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
| `no-new-warnings` | With `command`: the command exits with code 0. Without `command`: same as `lint-delta` |
| `convention` | A regex `pattern` that must be absent from (default) or, with `expect: present-in-changes`, present in the lines the diff adds |
| `lint-delta` | The repo's detected linters and type checker report no new findings on the lines the agent changed (`tools`, `maxNew` optional) |

## Supported Harnesses

A harness is the adapter between agenteval and your AI tool. Each one knows where the agent reads instructions, how to run it headless, and how to read token and cost numbers from its output.

| Harness | Tool | Metrics |
|---|---|---|
| `claude-code` | Claude Code (`claude`) | tokens, cost, turns, model |
| `codex` | OpenAI Codex CLI | tokens, turns |
| `gemini` | Gemini CLI | tokens, model |
| `antigravity` | Antigravity CLI (`agy`) | tokens, turns |
| `copilot` | GitHub Copilot CLI | none |
| `cursor` | Cursor CLI (`agent`) | none |
| `opencode` | OpenCode | tokens, cost, steps |
| `devin` | Devin CLI (`windsurf` is an alias) | none |
| `amp` | Amp | tokens, cost, turns, model |
| `mock` | Built-in mock | For testing agenteval itself |
| `auto` | Auto-detect | First installed CLI whose instruction file exists, else the first installed CLI |

Any other CLI works through `harnesses:` in the config:

```yaml
version: 1
harnesses:
  my-tool:
    command: "my-ai-tool"
    args: ["--non-interactive", "--prompt"]
    instructionPath: ".my-tool/instructions.md"
```

Exact invocations and metric fields are in [Harnesses](harnesses.md).

## Common Questions

### Do I need an API key?

Not for agenteval itself. agenteval does not call any AI APIs directly. It spawns your locally installed AI coding tool (Claude Code, Codex, Copilot, etc.) as a subprocess. You need whatever credentials that tool requires -- typically an API key or OAuth session configured in the tool itself.

### Does it work with GitHub Copilot?

Yes. Install the Copilot CLI (`copilot`) and set the harness to `copilot` in your task YAML or on the command line:

```bash
agenteval run --task my-task.yaml --harness copilot
```

Lint discovers `.github/copilot-instructions.md` and `.github/instructions/**/*.instructions.md` by default and checks their `applyTo` frontmatter. The Copilot CLI documents no JSON output, so runs report no token counts.

### Does it work with Cursor / .cursorrules?

Lint discovers `.cursor/rules/**/*.{md,mdc}` by default, checks `description`, `globs`, and `alwaysApply`, and warns about `.md` files in that folder, which Cursor ignores. The legacy `.cursorrules` file isn't in current Cursor docs; lint it explicitly with `agenteval lint ".cursorrules"` if you still have one.

For evals, use `--harness cursor`. It runs the Cursor CLI (`agent -p --force`) with instructions in `AGENTS.md`.

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
| `correctness` | Pass rate of the `files-changed`, `files-unchanged`, `test-pass`, and command-based `no-new-warnings` assertions |
| `precision` | Share of changed files that match a `files-changed` pattern |
| `efficiency` | `1 - (tokensTotal - tokensCacheRead) / run.tokensBudget`, clamped to 0..1. Left out when the harness reports no tokens |
| `conventions` | Pass rate of `convention` and `lint-delta` assertions. Left out when the task has none |

The overall score is a weighted average of the dimensions that have data. Default weights are 0.4 / 0.3 / 0.2 / 0.1 (correctness / precision / efficiency / conventions) unless the task YAML specifies otherwise; harvested tasks use 0.5 / 0.3 / 0.1 / 0.1.

### How does harvest detect AI commits?

The harvest command looks for three signals:

| Detection method | Example | Confidence |
|---|---|---|
| Co-author or agent session trailer | `Co-authored-by: Claude <noreply@anthropic.com>` | 0.9 |
| Commit authored by the agent's own account | A coding agent's bot account as the commit author | 0.8 |
| Commit message pattern | `Generated with Claude Code` in the message | 0.6 |

Only commits at or above the configured `minConfidence` threshold (default 0.5) produce task files.

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
