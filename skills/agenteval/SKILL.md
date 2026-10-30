---
name: agenteval
description: Use when editing agent instruction files (CLAUDE.md, AGENTS.md, GEMINI.md, rules, skills, subagents), when asked if they are correct or stale, or when asked whether instructions help an agent. Runs agenteval and fixes its findings.
license: MIT
compatibility: Requires the agenteval CLI (npm install -g agenteval-cli) and a git repository.
---

## Overview

agenteval checks agent instruction files against the repo they describe: broken references, commands that don't match `package.json` or the lockfile, frontmatter the agent ignores, files an agent truncates, and context-budget overruns. It can also run an agent on a task with and without the instructions and report the difference.

Run it as `agenteval`. If that is not on PATH, use `npx -y agenteval-cli` in its place.

## Lint after every instruction edit

1. Run `agenteval lint --format json` from the repo root. The JSON has `diagnostics[]` with `ruleId`, `severity`, `filePath`, `line`, `message`, and often `suggestion`.
2. Fix every `error`, then every `warning`, using the table below. Read the cited file and line before editing. For `toolchain/*` findings, check `package.json`, the lockfile, and the linter config, and write the command the repo actually uses.
3. Run `agenteval lint --severity warning` again.

Done when that run reports no errors and no warnings, or each remaining warning is one you told the user about with the reason you left it. `info` findings are suggestions; mention them only if they touch the lines you edited.

| Rule prefix | What it means | Fix |
|---|---|---|
| `dead-ref/` | A path, link, or anchor points at nothing | Correct the path, or remove the reference if the file is gone |
| `import/` | An `@path` import is missing, circular, or more than 4 hops deep | Fix the path (relative to the importing file) or flatten the chain |
| `toolchain/` | A command doesn't match the repo: wrong package manager, missing script, a linter the repo doesn't use, or a tool nobody documents | Use the real command from `package.json` scripts and the lockfile's package manager |
| `frontmatter/`, `skill/` | Frontmatter the agent rejects or ignores | Use the field names and values in the message; a skill's `name` must equal its directory |
| `agent-limits/` | An agent truncates or skips the file | Split the file, move detail into `.claude/rules/` or nested files, or rename `.md` rules in `.cursor/rules/` to `.mdc` |
| `context-budget/`, `token-count/` | Too much loads at session start | Move rarely needed sections behind a link or into path-scoped rules |
| `anti-pattern/`, `bloat/` | Vague, contradictory, or padded prose | Rewrite as a concrete instruction; `agenteval lint --fix` removes filler phrases |
| `drift/` | A referenced file changed long after the instructions did | Read the file and update the instructions that describe it |

When a finding is intentional (an example that shows a broken path, for instance), suppress it for the next section with `<!-- agenteval-disable rule-id -->` instead of changing the text.

## Measure whether instructions help

Evals run a real agent and cost money, so ask the user before starting one and say which harness and model you will use.

1. Write a task file (`name`, `prompt`, `assertions` such as `files-changed`, `test-pass`, `lint-delta`), or use one from `tasks/`. `agenteval harvest --dry-run` lists past AI commits that can become tasks.
2. Run `agenteval run --task <file> --harness <agent> --model <cheap model> --trials 3 --baseline`.
3. Report the Δ column: pass rate, score, tokens, cost, and turns with instructions versus without. With fewer than 3 trials, say the result may be noise.

`agenteval doctor` shows which agent CLIs and toolchain agenteval detected. Harness names, assertion fields, and scoring are in the agenteval docs at https://github.com/lukasmetzler/agenteval/tree/main/docs.
