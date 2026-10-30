---
name: agenteval
description: Use after editing agent instruction files (CLAUDE.md, AGENTS.md, GEMINI.md, rules, skills, subagents), when asked whether they are broken or stale, or when asked whether they help the agent. Lints them with agenteval and fixes the findings.
license: MIT
compatibility: Requires the agenteval CLI (npm install -g agenteval-cli) and a git repository.
---

## Overview

agenteval checks instruction files against the repo they describe: paths, `package.json` scripts, the lockfile, linter configs. Fix a finding by changing the instructions to match the repo; change the repo only when the user asks for it.

Run the CLI as `agenteval`. If that is not on PATH, use `npx -y agenteval-cli` in its place.

## Lint after every instruction edit

1. Run `agenteval lint --format json` from the repo root. Each entry in `diagnostics[]` has `ruleId`, `severity`, `filePath`, `line`, `message`, and often `suggestion`.
2. Fix every `error`, then every `warning`, using the table below.
3. Run `agenteval lint --severity warning` again.

The lint is **clean** when that run reports no errors and no warnings, or each remaining warning is one you told the user about, with the reason you left it. Repeat steps 2 and 3 until it is clean. `info` findings are suggestions; mention them only when they touch lines you edited.

| Rule prefix | Finding | Fix |
|---|---|---|
| `dead-ref/` | A path, link, or anchor points at nothing | Correct the path, or remove the reference if the target is gone |
| `import/` | An `@path` import is missing, circular, or more than 4 hops deep | Fix the path (relative to the importing file) or flatten the chain |
| `toolchain/` | A command doesn't match the repo: wrong package manager, missing script, a linter the repo doesn't use, or a tool nobody documents | Write the command the repo uses: `package.json` scripts, the lockfile's package manager, the configured linter |
| `frontmatter/`, `skill/` | Frontmatter the agent rejects or ignores | Use the field names and values in the message; a skill's `name` must equal its directory |
| `agent-limits/` | An agent truncates or skips the file | Split the file, move detail into `.claude/rules/` or nested files, or rename `.md` rules in `.cursor/rules/` to `.mdc` |
| `context-budget/`, `token-count/` | Too much loads at session start | Move rarely needed sections behind a link or into path-scoped rules |
| `overlap/` | Two sections say nearly the same thing | Keep one and delete or merge the other |
| `anti-pattern/`, `bloat/` | Vague, contradictory, or padded prose | Rewrite as a concrete instruction; `agenteval lint --fix` removes filler phrases |
| `drift/` | A referenced file changed long after the instructions did | Read the file and update the instructions that describe it |

When a finding is intentional (an example that shows a broken path, for instance), put `<!-- agenteval-disable rule-id -->` above that section to suppress the rule for it, and keep the text.

## Measure whether instructions help

Evals run a real agent and cost money. Ask the user before starting one, and name the harness and model you will use.

1. Write a task file (`name`, `prompt`, `assertions` such as `files-changed`, `test-pass`, `lint-delta`), or use one from `tasks/`. `agenteval harvest` turns past AI commits into task files under `tasks/harvested/`; `--dry-run` lists them first.
2. Run `agenteval run --task <file> --harness <agent> --model <cheap model> --trials 3 --baseline`.
3. Report the Δ column: pass rate, score, tokens, cost, and turns with instructions versus without. With fewer than 3 trials, say the result may be noise.

`agenteval doctor` shows which agent CLIs and toolchain agenteval detected. Harness names, assertion fields, and scoring are in the docs at https://github.com/lukasmetzler/agenteval/tree/main/docs.
