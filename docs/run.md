# agenteval run

`agenteval run` executes an AI coding agent against a defined task, measures the outcome, and stores a structured result. It creates an isolated git worktree, injects your instruction files, spawns the agent, captures the diff, evaluates assertions, computes a composite score, and writes the result to disk.

This is the core command for evaluating instruction quality. Run the same task before and after an instruction change, then use `agenteval compare` to see whether performance improved.

---

## When to use it

- You changed your instruction files and want to know if the agent performs better or worse.
- You want to compare how different AI tools handle the same task.
- You are building a regression suite: "does my agent still pass these tasks after this refactor?"
- You want a quantitative baseline before iterating on prompt wording or file structure.

---

## Prerequisites

1. **Git repository.** The runner uses `git worktree` for isolation. You must be inside a git repo with at least one commit.
2. **AI coding tool installed.** The harness you select (Claude Code, Copilot, etc.) must be accessible on your `PATH`. Use `--harness mock` if you want to test the pipeline without a real agent.
3. **Bun runtime.** agenteval is built on Bun. Install it at [bun.sh](https://bun.sh) if you have not already.
4. **Task definition.** Either a YAML file, a task name that resolves to a file in `tasks/`, or an inline description string.

---

## Basic usage

### Run a task defined in a YAML file

```bash
agenteval run --task tasks/refactor-auth.yaml
```

### Run a task by name (resolved from `tasks/` directory)

```bash
agenteval run --task refactor-auth
# Resolves to tasks/refactor-auth.yaml or tasks/refactor-auth.yml
```

### Run an ad-hoc task (no YAML file needed)

```bash
agenteval run --task "refactor the auth module to use structured logging"
```

Ad-hoc tasks have no assertions and use default scoring weights. Useful for quick experiments.

### Specify a harness

```bash
agenteval run --task tasks/refactor-auth.yaml --harness claude-code
```

### Use a different instruction file

```bash
agenteval run --task tasks/refactor-auth.yaml --instructions instructions-v2/CLAUDE.md
```

### Run several trials and compare against no instructions

```bash
agenteval run --task tasks/refactor-auth.yaml --trials 5 --baseline
```

See [Trials and the baseline arm](#trials-and-the-baseline-arm).

### Point to a specific config file

```bash
agenteval run --task tasks/refactor-auth.yaml -c ./my-agenteval.yaml
```

---

## Flag reference

| Flag | Short | Required | Default | Description |
|---|---|---|---|---|
| `--task <task>` | | Yes | | YAML file path, task name from `tasks/`, or inline description |
| `--harness <name>` | | No | Value from task YAML, or `auto` | `claude-code`, `codex`, `gemini`, `antigravity`, `copilot`, `cursor`, `opencode`, `devin`, `amp`, a `harnesses:` key, `mock`, or `auto`. See [Harnesses](harnesses.md). |
| `--model <model>` | | No | Task `model`, else the CLI's default | Model passed to the agent CLI |
| `--instructions <path>` | | No | `CLAUDE.md` | Instruction file to inject. The harness decides the target name (`CLAUDE.md`, `AGENTS.md`, `GEMINI.md`, ...). |
| `--trials <n>` | | No | Task `trials`, else `1` | Independent attempts (1-100) |
| `--baseline` | | No | off | Also run every trial with all instruction files removed and report the difference |
| `--format <format>` | | No | `console` | `console` or `json` (trial report on stdout, progress on stderr) |
| `--config <path>` | `-c` | No | Auto-discovered `agenteval.yaml` | Path to the agenteval configuration file |

### Task resolution order

The `--task` value is resolved in this order:

1. **File path.** If the value is a path to an existing `.yaml` or `.yml` file, parse it directly.
2. **Name lookup.** If a file named `tasks/<value>.yaml` or `tasks/<value>.yml` exists, parse it.
3. **Inline description.** Otherwise, treat the value as a plain-text task description. An ad-hoc task is created with no assertions, `auto` harness, 300-second timeout, and default scoring weights.

---

## Trials and the baseline arm

Agents are nondeterministic. The same task with the same instructions can pass once and fail the next time, so one run says little about whether an instruction file helps. Studies of AGENTS.md/CLAUDE.md files also find the effect mostly in tokens and time, less in correctness ([research notes](research/2026-10-30-agent-ecosystem.md#6-agent-eval-best-practices-2026)). Measure both.

`--trials N` runs the task N times. `--baseline` runs each trial a second time with every instruction, rule, skill, and agent file removed from the worktree. The two arms alternate, so a slow or flaky backend affects both alike. Example output:

```
  agenteval run  ·  refactor-auth  ·  5 trial(s)
  ──────────────────────────────────────

                    with instructions     baseline (none)       Δ
  pass rate         4/5 (80%)             3/5 (60%)             +20pp
  pass@k / pass^k   yes / no              yes / no
  score             0.84 ± 0.12           0.71 ± 0.18           +0.13
  tokens            41210 ± 5120          58930 ± 9802          -17720
  cost              $0.4120 ± 0.0510      $0.5893 ± 0.0980      -$0.1773
  turns             12.4 ± 2.1            17.0 ± 3.4            -4.6
  duration (s)      96.2 ± 11.0           131.5 ± 20.3          -35.3
```

| Row | Meaning |
|---|---|
| pass rate | Trials where the run succeeded and every assertion passed |
| pass@k | At least one of the k trials passed (k = `--trials`) |
| pass^k | All k trials passed. A low pass^k with a high pass@k means the agent can do it but not reliably. |
| score, tokens, cost, turns, duration | Mean ± sample standard deviation; `n/a` when the harness doesn't report the metric |
| Δ | With instructions minus baseline. Green means better (higher score and pass rate, lower tokens, cost, turns, and time). |

With fewer than 3 trials the report warns that differences may be noise. Every trial is saved as its own result with `trial: { group, index, of, arm }`, so `agenteval results` and `trends` see all of them. `--format json` prints the report as JSON for scripts.

Set a default in the task file:

```yaml
name: refactor-auth
trials: 3
```

---

## Practical workflow: testing instruction changes

This walkthrough shows how to use `agenteval run` to measure the impact of an instruction file change.

### Step 1: Define a task

Create `tasks/add-error-handling.yaml`:

```yaml
name: add-error-handling
description: "Add try/catch error handling to all API route handlers"
prompt: "Add proper error handling with try/catch to every route handler in src/api/. Return 500 with a JSON error body on failure. Log the error with logger.error."
timeout: 180

assertions:
	- type: files-changed
	  pattern: "src/api/**/*.ts"
	- type: files-unchanged
	  pattern: "src/models/**"
	- type: test-pass
	  command: "bun test"
	- type: no-new-warnings
	  command: "bun run lint"
	- type: convention
	  pattern: "catch\\s*\\("
	  expect: present-in-changes
	- type: convention
	  pattern: "console\\.log"

scoring:
	correctness: 0.4
	precision: 0.3
	efficiency: 0.1
	conventions: 0.2
```

### Step 2: Run the baseline

```bash
agenteval run --task add-error-handling
```

Note the run ID and score from the output.

### Step 3: Edit your instructions

Modify `CLAUDE.md` to add guidance about error handling patterns. For example, add a section explaining the project's error handling conventions.

### Step 4: Run again

```bash
agenteval run --task add-error-handling
```

### Step 5: Compare

```bash
agenteval compare --baseline run-20260401-143022 --candidate run-20260401-144510
```

The comparison shows score deltas per dimension and highlights which assertions flipped between pass and fail.

---

## Reference

The sections below are reference material. You don't need to read them all before running your first eval.

---

## Task definition format

A task YAML file describes what to ask the agent, how long to wait, what to check, and how to score the result.

### Complete example

```yaml
name: refactor-auth
description: "Refactor auth module to use the structured logger"
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
  - type: no-new-warnings
    command: "bun run lint"
  - type: convention
    pattern: "logger\\.info"
    expect: present-in-changes

scoring:
  correctness: 0.4
  precision: 0.3
  efficiency: 0.2
  conventions: 0.1
```

### Field-by-field reference

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `name` | string | Yes | | Short identifier for the task. Used in result filenames and comparison output. |
| `description` | string | Yes | | Human-readable explanation of what the task does. |
| `prompt` | string | No | Same as `description` | The exact text sent to the AI agent. Use this when the agent prompt should differ from the human description. |
| `harness` | string | No | `auto` | A built-in harness, a `harnesses:` key from `agenteval.yaml`, or `auto`. See [Harnesses](harnesses.md). |
| `model` | string | No | CLI default | Model passed to the agent CLI. `--model` overrides it. |
| `timeout` | number | No | `300` | Maximum seconds to wait for the agent (and for each setup or assertion command). The agent gets `SIGTERM`, then `SIGKILL` 10 seconds later. |
| `trials` | number | No | `1` | Independent attempts per run. `--trials` overrides it. |
| `setup` | string[] | No | | Shell commands run in the worktree before the agent starts, for example `bun install`. A failing command fails the run. |
| `assertions` | array | No | `[]` | List of assertion objects evaluated after the agent completes. See below. |
| `scoring` | object | No | See defaults | Weight configuration for the four scoring dimensions. See the scoring section. |
| `sourceCommit` | string | No | | Source commit hash. Set automatically by `agenteval harvest`. |
| `instructionSnapshot` | object | No | | Map of instruction file contents at the source commit. Set by harvest. |
| `prUrl` | string | No | | GitHub PR URL. Set by harvest with `--github`. |
| `prBody` | string | No | | GitHub PR body text. Set by harvest with `--github`. |
| `detectionConfidence` | number | No | | AI detection confidence (0.0-1.0). Set by harvest. Used for confidence-weighted scoring. |
| `detectedModel` | string | No | | Model named in the source commit's attribution, for example `Claude Opus 5.5`. Set by harvest. |
| `harvestDate` | string | No | | ISO 8601 timestamp when the task was harvested. |

The `sourceCommit`, `instructionSnapshot`, `prUrl`, `prBody`, `detectionConfidence`, and `harvestDate` fields are set automatically by `agenteval harvest`. You don't need to set them manually in hand-written task YAML. When present, they enable snapshot-aware comparison and confidence-weighted scoring.

A task with `sourceCommit` starts its worktree at that commit's parent, the state the original agent saw. Other tasks start at `HEAD`. In CI this needs the full history (`actions/checkout` with `fetch-depth: 0`).

The `test-pass` assertion type may also be auto-generated by harvest when the commit diff includes test files (matching `test`, `spec`, or `__tests__` patterns). Harvest also adds a `lint-delta` assertion when the repo has a linter agenteval can run.

---

## Assertion types

Assertions define what a correct outcome looks like. Each assertion is evaluated after the agent finishes and the diff is captured. Every assertion produces a pass/fail result that feeds into the scoring system.

### files-changed

Checks that the agent modified at least one file matching a glob pattern.

```yaml
assertions:
  - type: files-changed
    pattern: "src/auth/**/*.ts"
```

| Field | Required | Description |
|---|---|---|
| `pattern` | Yes | Glob pattern matched against changed file paths (relative to repo root). Uses [minimatch](https://github.com/isaacs/minimatch) syntax. |

**Passes when:** At least one file in the diff matches the pattern.
**Fails when:** No changed files match the pattern.

Use this to verify the agent touched the files it was supposed to touch.

### files-unchanged

Checks that the agent did not modify any files matching a glob pattern.

```yaml
assertions:
  - type: files-unchanged
    pattern: "src/billing/**"
```

| Field | Required | Description |
|---|---|---|
| `pattern` | Yes | Glob pattern. Any matching file in the diff causes a failure. |

**Passes when:** Zero changed files match the pattern.
**Fails when:** One or more changed files match the pattern.

Use this to verify the agent did not make collateral changes to unrelated modules.

### test-pass

Runs a shell command in the worktree and checks that it exits with code 0.

```yaml
assertions:
  - type: test-pass
    command: "bun test"
```

| Field | Required | Description |
|---|---|---|
| `command` | Yes | Shell command executed via `sh -c` in the worktree directory. |

**Passes when:** The command exits with code 0.
**Fails when:** The command exits with a non-zero code.

Use this to verify that tests still pass after the agent's changes.

### lint-delta

Runs the repo's own linters and type checker on the files the agent changed and counts the findings on lines it added (or anywhere in files it created). Findings on untouched lines don't count.

```yaml
assertions:
  - type: lint-delta              # every detected linter and type checker
  - type: lint-delta
    tools: [oxlint, tsc]
    maxNew: 1
```

| Field | Required | Description |
|---|---|---|
| `tools` | No | `auto` (default) or a list of `oxlint`, `eslint`, `biome`, `ruff`, `tsc` |
| `maxNew` | No | New findings tolerated. Default `0`. |

**Passes when:** At most `maxNew` new findings and at least one tool ran.
**Fails when:** More new findings, or no listed tool could run.

Scored in the **conventions** dimension. The findings are saved in the result's `lint` field. See [Toolchain checks](toolchain.md#lint-delta-linters-as-an-eval-signal) for how each tool is invoked.

### no-new-warnings

Without a `command`, `no-new-warnings` is the same as `lint-delta` with `tools: auto`.

With a `command`, it keeps its v0.8 meaning: the command runs via `sh -c` in the worktree and must exit 0. Prefer `lint-delta`, which ignores problems that existed before the agent started.

```yaml
assertions:
  - type: no-new-warnings
    command: "bun run lint"
```

### convention

Checks whether a regex pattern is present (or absent) in the added lines of the diff.

```yaml
assertions:
  - type: convention
    pattern: "logger\\.info"
    expect: present-in-changes
```

```yaml
assertions:
  - type: convention
    pattern: "console\\.log"
    # expect is omitted, so the pattern must be absent
```

| Field | Required | Description |
|---|---|---|
| `pattern` | Yes | Regular expression tested against added lines (lines starting with `+` in the diff, excluding `+++` headers). |
| `expect` | No | Set to `present-in-changes` to require the pattern. Omit or set to any other value to require the pattern is absent. |

**Passes when:** The pattern is found and `expect` is `present-in-changes`, or the pattern is not found and `expect` is not `present-in-changes`.
**Fails when:** The opposite of the above.

Convention assertions are scored separately from other assertion types. They feed into the `conventions` scoring dimension rather than `correctness`.

---

## Scoring system

Each run produces scores across four dimensions, combined into a single overall score between 0.0 and 1.0.

### Dimensions

| Dimension | Default weight | Computation | Range |
|---|---|---|---|
| `correctness` | 0.4 | Ratio of passed non-convention assertions to total non-convention assertions. If there are no non-convention assertions, defaults to 1.0. | 0.0 -- 1.0 |
| `precision` | 0.3 | Ratio of changed files that match at least one expected file pattern (from `files-changed` assertions). Unexpected changes reduce the score. If no files changed and no patterns were expected, defaults to 1.0. | 0.0 -- 1.0 |
| `efficiency` | 0.2 | `1 - (tokensUsed / tokensBudget)`, where tokensUsed leaves out prompt-cache reads. Lower token usage scores higher. Returns `null` if token data is unavailable (harness did not report tokens). | 0.0 -- 1.0 or null |
| `conventions` | 0.1 | Ratio of passed convention assertions to total convention assertions. Returns `null` if there are no convention assertions. | 0.0 -- 1.0 or null |

### Overall score computation

The overall score is a weighted average of the available dimensions:

```
overall = sum(score_i * weight_i) / sum(weight_i)
```

If a dimension is `null` (efficiency when tokens are unavailable, conventions when there are no convention assertions), its weight is excluded from both the numerator and denominator. The remaining weights are effectively redistributed proportionally.

**Example:** A task with no convention assertions and unavailable token metrics:

| Dimension | Score | Weight | Contribution |
|---|---|---|---|
| correctness | 1.0 | 0.4 | 0.40 |
| precision | 0.8 | 0.3 | 0.24 |
| efficiency | null | 0.2 | excluded |
| conventions | null | 0.1 | excluded |
| **overall** | | 0.7 | **(0.40 + 0.24) / 0.7 = 0.91** |

### Tuning weights

Override the default weights in your task YAML:

```yaml
scoring:
  correctness: 0.5
  precision: 0.2
  efficiency: 0.2
  conventions: 0.1
```

The weights are conceptual -- they do not need to sum to exactly 1.0 because the computation normalizes by the sum of active weights. However, keeping them at 1.0 makes intent clearer.

Guidance:

- Increase `correctness` when pass/fail matters more than surgical precision.
- Increase `precision` when you want to penalize agents that make unnecessary changes.
- Increase `efficiency` when token cost is a concern.
- Increase `conventions` when coding style adherence is important.

### Token budget

The `efficiency` dimension compares token usage against `run.tokensBudget` in `agenteval.yaml` (default: 50,000). Prompt-cache reads (`metrics.tokensCacheRead`) are not counted: agents re-read their system prompt and history every turn, and in a measured Claude Code run with Haiku they were 203,000 of 241,000 tokens. Counting them would put almost every run at 0. If the agent uses more tokens than the budget, the efficiency score is 0. Adjust the budget to match the complexity of your tasks:

```yaml
# agenteval.yaml
run:
  tokensBudget: 100000
```

---

## The eval pipeline

The following diagram shows the complete execution flow:

```
  agenteval run --task tasks/refactor-auth.yaml
       |
       v
  +---------------------+
  | 1. Load task         |  Parse YAML, validate schema, resolve defaults
  +---------------------+
       |
       v
  +---------------------+
  | 2. Clean stale       |  Remove worktrees older than 1 hour
  |    worktrees         |  (from previous failed runs)
  +---------------------+
       |
       v
  +---------------------+
  | 3. Resolve harness   |  "auto" -> detect from instruction files
  |                      |  Otherwise use the specified adapter
  +---------------------+
       |
       v
  +---------------------+
  | 4. Check harness     |  Run "which <command>" to verify the
  |    availability      |  AI tool is installed
  +---------------------+
       |
       v
  +---------------------+
  | 5. Create worktree   |  git worktree add --detach at HEAD
  |                      |  Location: .agenteval/worktrees/<run-id>
  +---------------------+
       |
       v
  +---------------------+
  | 6. Inject            |  Copy instruction file (e.g., CLAUDE.md)
  |    instructions      |  into the worktree root
  +---------------------+
       |
       v
  +---------------------+
  | 7. Spawn agent       |  Run the AI tool with the task prompt
  |                      |  Wait for completion or timeout
  +---------------------+
       |
       v
  +---------------------+
  | 8. Capture diff      |  git diff HEAD in the worktree
  |                      |  Parse changed file list
  +---------------------+
       |
       v
  +---------------------+
  | 9. Run assertion     |  Execute test-pass and no-new-warnings
  |    commands          |  shell commands in the worktree
  +---------------------+
       |
       v
  +---------------------+
  | 10. Score            |  Evaluate all assertions against the diff
  |                      |  Compute correctness, precision,
  |                      |  efficiency, conventions, overall
  +---------------------+
       |
       v
  +---------------------+
  | 11. Store result     |  Write JSON to .agenteval/results/<run-id>.json
  +---------------------+
       |
       v
  +---------------------+
  | 12. Clean up         |  git worktree remove --force
  |     worktree         |  Always runs, even on error
  +---------------------+
       |
       v
  Print summary + exit
```

The worktree is always removed in a `finally` block, so cleanup happens even if the agent crashes or times out.

---

## Harness adapters

Each built-in harness runs an agent CLI headless, copies the instruction file to where that agent reads it, and parses tokens, cost, turns, and model from the CLI's JSON output. `auto` picks the first installed CLI whose instruction file exists in the repo.

The full table with exact invocations, metrics, and custom harness setup is in [Harnesses](harnesses.md).

---

## Understanding results

### Console output

A successful run prints:

```
✓ Run complete: run-20260401-143022
  Score: 0.85
  Files changed: 3 file(s) changed, 42 insertion(s), 8 deletion(s)
  Tokens: ~12500
  Saved to: .agenteval/results/run-20260401-143022.json
```

A failed or timed-out run prints the error and exits with code 1:

```
✗ Run timeout: run-20260401-143022
  Timed out after 120 seconds
```

### Result JSON structure

Each run produces a JSON file in `.agenteval/results/`. The structure:

```json
{
  "id": "run-20260401-143022",
  "timestamp": "2026-04-01T14:30:22.000Z",
  "task": "refactor-auth",
  "harness": "claude-code",
  "instructions": "/home/user/project/CLAUDE.md",
  "status": "success",
  "metrics": {
    "tokensInput": 4200,
    "tokensOutput": 8300,
    "tokensTotal": 12500,
    "tokenSource": "api"
  },
  "scores": {
    "correctness": 1.0,
    "precision": 0.8,
    "efficiency": 0.75,
    "conventions": 1.0,
    "overall": 0.89
  },
  "assertions": [
    {
      "type": "files-changed",
      "expected": "src/auth/** modified",
      "actual": "2 file(s) matched: src/auth/login.ts, src/auth/session.ts",
      "passed": true
    },
    {
      "type": "test-pass",
      "expected": "bun test exits 0",
      "actual": "exit 0",
      "passed": true
    }
  ],
  "diffSummary": "3 file(s) changed, 42 insertion(s), 8 deletion(s)",
  "model": null,
  "error": null
}
```

### Key fields

| Field | Description |
|---|---|
| `id` | Unique run identifier. Format: `run-YYYYMMDD-HHMMSS-xxxxxx` (random suffix). |
| `status` | `success`, `error`, or `timeout`. A non-zero agent exit, or a failure the agent reports in its JSON output (`turn.failed`, `is_error`), is `error` with the reported reason in `error`. |
| `metrics.tokenSource` | `api` (parsed from harness output), `estimated` (approximated), or `unavailable`. |
| `scores.overall` | Weighted composite score from 0.0 to 1.0. `null` if no assertions were defined. |
| `assertions` | Per-assertion pass/fail with expected vs. actual details. |
| `diffSummary` | Human-readable summary: files changed, insertions, deletions. |
| `changedFiles` | Files the agent's diff touched, including files it created. |
| `lint` | Tool status and new findings from `lint-delta` assertions. |
| `trial` | `group`, `index`, `of`, and `arm` when the run was one of several trials. |

### Where files are saved

| Path | Contents |
|---|---|
| `.agenteval/results/<run-id>.json` | Full result for each run |
| `.agenteval/worktrees/<run-id>/` | Temporary worktree (removed after each run) |

Both directories are configurable in `agenteval.yaml`:

```yaml
run:
  resultsDir: ".agenteval/results"
  worktreesDir: ".agenteval/worktrees"
```

---

## Troubleshooting

### Timeout

**Symptom:** Run status is `timeout`. The agent took longer than the configured limit.

**Causes and fixes:**

- The task is too complex for the timeout. Increase `timeout` in the task YAML.
- The agent is stuck in a loop. Check the agent's output in the result JSON (`error` field).
- The default timeout is 300 seconds. For large refactors, set 600 or higher.

```yaml
timeout: 600
```

### Harness not found

**Symptom:** Error message `Harness "<name>" is not available on this system`.

**Causes and fixes:**

- The AI tool is not installed or not on your `PATH`. `agenteval doctor` lists the agent CLIs it found.
- For custom harnesses, verify the `command` in `agenteval.yaml` is correct.
- Use `--harness mock` to test the pipeline without a real agent.

### Auto-detection fails

**Symptom:** Error `No supported agent CLI found on PATH`.

**Fix:** Install one of the agent CLIs listed in [Harnesses](harnesses.md), or pass `--harness` (for example `mock` or a custom `harnesses:` entry).

### Worktree creation fails

**Symptom:** Error `Failed to create worktree`.

**Causes and fixes:**

- Not inside a git repository. Run `git init` if needed.
- No commits in the repository. Make at least one commit.
- A stale worktree with the same name exists. Delete it manually with `git worktree remove .agenteval/worktrees/<run-id> --force` or wait for the next run to clean it automatically (stale worktrees older than 1 hour are purged on startup).
- Disk space is full. Free space and retry.

### Instruction path escapes project directory

**Symptom:** Error `Instruction path "<path>" escapes project directory`.

**Fix:** The `--instructions` path must resolve to a location inside the current working directory. Use a relative path or an absolute path within the project.

### No assertions defined (score is null)

**Symptom:** Overall score is `null` or `N/A`.

**Cause:** The task has no assertions. This happens with ad-hoc tasks or YAML files with an empty `assertions` list. Without assertions, there is nothing to score.

**Fix:** Add assertions to your task YAML to get meaningful scores.

### Config error (exit code 2)

**Symptom:** Process exits with code 2 before any run starts.

**Causes:**

- Invalid task YAML (missing required fields, bad types).
- Unknown harness name passed to `--harness`.
- Invalid `agenteval.yaml` configuration.

Check the error message for specifics and validate your YAML against the schemas documented above.

---

## Exit codes

| Code | Meaning |
|---|---|
| 0 | Run completed successfully |
| 1 | Run completed with an error or timed out (with `--trials`/`--baseline`: any trial did) |
| 2 | Configuration error (invalid task file, unknown harness, bad instruction path) |
