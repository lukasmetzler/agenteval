# Harnesses

A harness is the agent CLI that `agenteval run` and `agenteval ci` drive. Each one runs headless in an isolated git worktree, with permission prompts turned off, and reports usage as JSON where the CLI supports it.

```bash
agenteval run --task tasks/add-endpoint.yaml --harness claude-code --model claude-sonnet-5-5
```

## Built-in harnesses

| `--harness` | CLI | Instructions are copied to | Invocation | Metrics |
|---|---|---|---|---|
| `claude-code` | `claude` | `CLAUDE.md` | `claude -p --output-format json --permission-mode bypassPermissions --no-session-persistence` (prompt on stdin) | tokens incl. cache, cost, turns, model |
| `codex` | `codex` | `AGENTS.md` | `codex exec --json -s workspace-write --skip-git-repo-check --ephemeral -` (prompt on stdin) | tokens incl. reasoning, turns |
| `gemini` | `gemini` | `GEMINI.md` | `gemini -o json --approval-mode yolo -p <prompt>` | tokens per model, model |
| `antigravity` | `agy` | `GEMINI.md` | `agy --output-format json --dangerously-skip-permissions -p <prompt>` | tokens, turns |
| `copilot` | `copilot` | `.github/copilot-instructions.md` | `copilot --allow-all-tools --no-ask-user -p <prompt>` | none (no documented JSON output) |
| `cursor` | `agent` | `AGENTS.md` | `agent --output-format json --force -p <prompt>` | none |
| `opencode` | `opencode` | `AGENTS.md` | `opencode run --format json --auto <prompt>` | tokens, cost, steps (best effort, schema undocumented) |
| `devin` | `devin` | `AGENTS.md` | `devin --permission-mode dangerous -p <prompt>` | none |
| `amp` | `amp` | `AGENTS.md` | `amp --stream-json -x <prompt>` | tokens incl. cache, cost, turns, model (same result event as Claude Code) |
| `mock` | | | changes no files and reports no metrics, for testing pipelines | |

`windsurf` still works as an alias for `devin` and prints a deprecation warning.

The claude, codex, and opencode flags were checked against `--help` of claude 2.1.314, codex 0.163, and opencode 2.2.3. The others follow each vendor's headless documentation as of October 2026 (sources in [the research notes](research/2026-10-30-agent-ecosystem.md#3-headless-invocation-for-harness-adapters)).

Some details matter for fair comparisons:

- **claude-code doesn't use `--bare`.** That mode skips CLAUDE.md, which is the file under test.
- **Instructions go where the agent reads them.** `--instructions v2/CLAUDE.md --harness codex` copies the file to `AGENTS.md` in the worktree. Before 0.9 the file kept its own name, so Codex never saw it.
- **The prompt goes over stdin** where the CLI accepts it, so long prompts don't hit the OS argument-length limit.
- **Timeouts escalate.** After `timeout` seconds the agent gets SIGTERM, then SIGKILL 10 seconds later.
- **Personal config still applies.** agenteval doesn't isolate `~/.claude/CLAUDE.md`, `~/.codex/AGENTS.md`, and the like. For clean comparisons, run evals in CI or under a user without personal instruction files.

## Choosing a harness automatically

`harness: auto` (the default in task files) picks the first installed CLI, in the table order, whose instruction file exists in the repo. If none of those exist, it picks the first installed CLI. `agenteval doctor` lists which CLIs it found:

```
  ✓  agent CLIs           claude-code, codex, opencode (for agenteval run; claude also powers --analyze)
```

## Models

`--model` on `run`, or `model:` in a task file, passes the model to the CLI's own flag (`--model`, `-m`). Without it the CLI uses its default. The result records the model the CLI reported, falling back to the requested one:

```bash
agenteval run --task tasks/refactor.yaml --harness claude-code --model claude-sonnet-5-5
```

## Custom harnesses

Any CLI that takes a prompt as its last argument works through `harnesses:` in `agenteval.yaml`:

```yaml
harnesses:
  my-agent:
    command: my-agent
    args: ["--non-interactive", "--yes"]
    instructionPath: AGENTS.md   # where the instruction file is copied
```

```bash
agenteval run --task tasks/fix-bug.yaml --harness my-agent
```

A `harnesses:` entry with a built-in name (for example `codex`) replaces the built-in with a custom harness: the prompt goes in as the last argument, the instruction file is copied to `instructionPath` (default `AGENTS.md`), and the built-in's flags and metric parsing are gone. Custom harnesses get exact token counts if the CLI prints a Claude-Code-style `{"type":"result","usage":{...}}` event. Otherwise agenteval looks for text like `total tokens: 1234` and marks the count as estimated.

## Metrics

Every result stores what the CLI reported:

| Field | Meaning |
|---|---|
| `metrics.tokensInput` / `tokensOutput` / `tokensTotal` | Token counts. For Claude Code, input includes cache reads and writes. For Codex, output includes reasoning tokens. |
| `metrics.tokensCacheRead` | Input tokens served from the prompt cache (part of `tokensInput`). Left out of the efficiency score. |
| `metrics.tokenSource` | `api` (reported by the CLI), `estimated` (scraped from text), or `unavailable` |
| `metrics.costUsd` | Cost the CLI reported. Claude Code's figure is a client-side estimate. |
| `metrics.turns` | What the CLI reports as turns. Claude Code and Amp count model round trips. Codex counts one turn per prompt, so it is always 1; OpenCode counts steps. Don't compare turns across harnesses. |
| `model` | Model the CLI reported, or the requested one |
| `durationMs` | Wall-clock time of the agent process |

`null` always means "not reported", never zero. The efficiency score is left out when tokens are unavailable.

A run fails with status `error` when the CLI exits non-zero or reports a failure in its JSON output (Claude `is_error`, Codex `turn.failed`, OpenCode `error` events). The `error` field carries the reason the agent gave, for example `The 'gpt-6-astra' model is not supported when using Codex with a ChatGPT account.`

## Verification status

Checked against real CLI output on 2026-10-30:

| Harness | Version | What was run |
|---|---|---|
| claude-code | 2.1.314 | Eval tasks, trials with baseline, `ci`, the `--analyze` judge. Output recorded in `tests/fixtures/harness/claude-code.recorded.json`. |
| codex | 0.163 | Eval task with `gpt-5.6-luna`, plus the model-not-supported error path. Output recorded in `tests/fixtures/harness/codex.recorded.jsonl`. |
| opencode | 2.2.3 | Error path only (the providers available had no valid key). Token parsing follows the event shape and is unverified. |
| gemini, antigravity, copilot, cursor, devin, amp | | Not installed. Built from vendor docs, unverified. |
