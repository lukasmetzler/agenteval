# Harnesses

A harness is the agent CLI that `agenteval run` and `agenteval ci` drive. Each one runs headless in an isolated git worktree, with permission prompts turned off, and reports usage as JSON where the CLI supports it.

```bash
agenteval run --task tasks/add-endpoint.yaml --harness codex --model gpt-5.4
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
| `amp` | `amp` | `AGENTS.md` | `amp --stream-json -x <prompt>` | tokens, turns |
| `mock` | | | writes nothing, for testing pipelines | |

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

A `harnesses:` entry with a built-in name (for example `codex`) replaces the built-in. Custom harnesses get exact token counts if the CLI prints a Claude-Code-style `{"type":"result","usage":{...}}` event. Otherwise agenteval looks for text like `total tokens: 1234` and marks the count as estimated.

## Metrics

Every result stores what the CLI reported:

| Field | Meaning |
|---|---|
| `metrics.tokensInput` / `tokensOutput` / `tokensTotal` | Token counts. For Claude Code, input includes cache reads and writes. For Codex, output includes reasoning tokens. |
| `metrics.tokenSource` | `api` (reported by the CLI), `estimated` (scraped from text), or `unavailable` |
| `metrics.costUsd` | Cost the CLI reported. Claude Code's figure is a client-side estimate. |
| `metrics.turns` | Model round trips |
| `model` | Model the CLI reported, or the requested one |
| `durationMs` | Wall-clock time of the agent process |

`null` always means "not reported", never zero. The efficiency score is left out when tokens are unavailable.
