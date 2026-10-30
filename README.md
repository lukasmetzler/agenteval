# agenteval

Lint, test, and benchmark the instruction files your coding agents read: `CLAUDE.md`, `AGENTS.md`, `GEMINI.md`, Cursor and Copilot rules, and Agent Skills.

[![CI](https://github.com/lukasmetzler/agenteval/actions/workflows/ci.yml/badge.svg)](https://github.com/lukasmetzler/agenteval/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/agenteval-cli?label=npm)](https://www.npmjs.com/package/agenteval-cli)
[![npm downloads](https://img.shields.io/npm/dm/agenteval-cli)](https://www.npmjs.com/package/agenteval-cli)
[![Version](https://img.shields.io/github/v/release/lukasmetzler/agenteval?label=release)](https://github.com/lukasmetzler/agenteval/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Instruction files go stale without anything failing. The repo moves from npm to bun or from ESLint to oxlint, a script gets renamed, a file grows past what the agent reads, and `CLAUDE.md` keeps describing the old state. agenteval checks each file against the repo it describes. When you want numbers, it runs your agent on real tasks with and without the files and reports the difference.

## Install

```bash
npm install -g agenteval-cli
```

| Method | Command | Update with |
|---|---|---|
| npm | `npm install -g agenteval-cli` | `npm update -g agenteval-cli` |
| Homebrew | `brew tap lukasmetzler/agenteval && brew install agenteval` | `brew upgrade agenteval` |
| Shell | `curl -fsSL https://raw.githubusercontent.com/lukasmetzler/agenteval/main/install.sh \| bash` | `agenteval update` |
| Binary | [GitHub Releases](https://github.com/lukasmetzler/agenteval/releases) for Linux x64 and macOS (arm64, x64) | `agenteval update` |
| Source | `git clone https://github.com/lukasmetzler/agenteval && bun install && bun run build` | `git pull && bun run build` |

Homebrew, the shell script, and the release binaries need neither Bun nor Node. The npm package is a small Node wrapper that downloads the same binary on first run and checks its SHA-256.

## Quick start

Run these from the root of a repo that has instruction files:

1. `agenteval doctor` lists the agent CLIs and the toolchain agenteval detected.
2. `agenteval lint` checks every instruction file.
3. `agenteval init` writes an `agenteval.yaml` if you want to change the defaults. Lint works without one.

Here is `agenteval lint` on a bun repo that uses oxlint, where `CLAUDE.md` still has commands from an older setup:

```
  agenteval lint  ·  1 file  ·  ~50 tokens  ·  23ms
  ──────────────────────────────────────────────────────────────────────

  CLAUDE.md
     info   Section "Commands" uses ~46 tokens (92% of file)  (token-count/section-heavy)
           line 3
           → Break this section into subsections or move detail to a linked doc
     WARN   `npm install` uses npm, but this repo uses bun (lockfile)  (toolchain/wrong-package-manager)
           line 6
           → Use `bun install`
     ERROR  `bun run format` runs script "format", which package.json does not define  (toolchain/missing-script)
           line 8
           → Available scripts: lint, test, typecheck
     WARN   `npx eslint .` runs ESLint, but this repo uses oxlint (.oxlintrc.json)  (toolchain/absent-tool)
           line 9
           → Replace with the oxlint command
     info   Repo uses TypeScript (tsconfig.json), but no instruction file says how to run it  (toolchain/undocumented)
           → Add `bun run typecheck` to the commands section

  ──────────────────────────────────────────────────────────────────────
  1 error  ·  2 warnings  ·  2 info
```

## What lint checks

- **References.** Paths, links, heading anchors, and `@imports` that point at nothing, plus import cycles and chains deeper than 4 hops.
- **Commands.** Package manager, `package.json` scripts, and linters compared with the lockfile and config files. agenteval detects bun, pnpm, yarn, npm, uv, poetry, cargo, go, oxlint, oxfmt, Biome, ESLint, Prettier, TypeScript 6 and 7, Ruff, ty, Black, and mypy.
- **Frontmatter.** Fields each agent rejects or ignores in rules, subagents, commands, and skills. Skills are checked against the open Agent Skills spec.
- **Agent limits.** Files an agent truncates or skips: the 32 KiB cap on Codex's AGENTS.md chain, long Claude files, `.md` files in `.cursor/rules`, and an AGENTS.md that Claude Code ignores because a CLAUDE.md exists.
- **Content.** Context-budget overruns, contradictions, duplicated sections, filler phrases, vague instructions, and instructions that drifted from the code they describe.

Every rule, its severity, and how to fix it are in [Linting](docs/lint.md). Output formats are console, JSON, Markdown, SARIF, and GitHub annotations.

## Measure whether instructions help

`agenteval run` gives a task to an agent CLI in an isolated git worktree and scores the result against the task's assertions. With `--baseline`, it runs the same task again with every instruction file removed, so you can compare the two.

```bash
agenteval run --task tasks/add-multiply.yaml --harness claude-code --model haiku --trials 3 --baseline
```

This report comes from a two-trial run with Claude Haiku 5.5 on a small task:

```
                    with instructions     baseline (none)       Δ
  pass rate         2/2 (100%)            2/2 (100%)            +0pp
  pass@k / pass^k   yes / yes             yes / yes
  score             0.85 ± 0.00           0.85 ± 0.00           +0.00
  tokens            140945 ± 598          186127 ± 5107         -45182
  cost              $0.0089 ± 0.0001      $0.0094 ± 0.0001      -$0.0005
  turns             5.0 ± 0.0             6.5 ± 0.7             -1.5
  duration (s)      24.8 ± 5.7            22.8 ± 5.6            +1.9
```

The agent solved the task either way, and with `CLAUDE.md` it needed 45k fewer tokens and 1.5 fewer turns. Two trials can be noise, so use three or more before you trust a difference.

Published results point both ways. One study of 124 pull requests found that AGENTS.md cut median runtime by 29% and output tokens by 17% at comparable completion ([Lulla et al.](https://arxiv.org/abs/2601.20404)). Another found no general gain in success and more than 20% higher cost ([Gloaguen et al.](https://arxiv.org/abs/2602.11988)). Whether your files help depends on your repo and your files, so measure them.

Assertions include `files-changed`, `test-pass`, and `lint-delta`. `lint-delta` runs the repo's own linters on the agent's diff and counts only findings on lines the agent added. `agenteval harvest` turns past AI-assisted commits from your git history into task files.

agenteval drives Claude Code, Codex, Gemini CLI, Antigravity, Copilot CLI, Cursor CLI, OpenCode, Devin, Amp, and any CLI you configure. Tokens, cost, model, and turns come from each CLI's JSON output where it reports them. See [Harnesses](docs/harnesses.md) and [Running Evals](docs/run.md).

## Supported formats

| Agent | Files |
|---|---|
| Claude Code | `CLAUDE.md` (nested too), `CLAUDE.local.md`, `.claude/rules/`, `.claude/agents/`, `.claude/commands/` |
| AGENTS.md readers (Codex, Copilot, Cursor, OpenCode, Amp, Devin, and others) | `AGENTS.md` (nested too) |
| Gemini CLI, Antigravity | `GEMINI.md` |
| GitHub Copilot | `.github/copilot-instructions.md`, `.github/instructions/**/*.instructions.md` |
| Agent Skills | `.claude/skills/*/SKILL.md`, `.agents/skills/*/SKILL.md` |
| Cursor | `.cursor/rules/**/*.mdc` |
| Devin, Windsurf | `.devin/rules/*.md`, `.windsurf/rules/*.md` |
| Kiro | `.kiro/steering/*.md` |
| JetBrains Junie | `.junie/**/*.md` |

## Commands

| Command | What it does | Guide |
|---|---|---|
| `agenteval lint` | Check instruction files. `--fix` removes filler phrases, `--format sarif` writes SARIF. | [Linting](docs/lint.md) |
| `agenteval watch` | Re-lint when an instruction file changes | |
| `agenteval doctor` | Show detected agent CLIs, toolchain, and config | [Toolchain checks](docs/toolchain.md) |
| `agenteval run --task <file>` | Run an agent on a task and score it. `--trials N --baseline` compares against no instructions. | [Running Evals](docs/run.md) |
| `agenteval harvest` | Build tasks from AI-assisted commits. `--live` scores uncommitted changes. | [Harvesting](docs/harvest.md) |
| `agenteval results` | List stored runs and prune old ones | [Results](docs/results.md) |
| `agenteval compare <A> <B>` | Compare two runs side by side | [Results](docs/results.md) |
| `agenteval trends` | Show score history per task | [Trends](docs/trends.md) |
| `agenteval ci` | Run every task and fail on regressions | [CI Guide](docs/ci.md) |
| `agenteval init` | Write a starter config. `--hook` adds a pre-commit lint hook. | [Configuration](docs/configuration.md) |
| `agenteval update` | Update the binary to the latest release | |

## Run in CI

The GitHub Action installs agenteval and runs one command:

```yaml
- uses: lukasmetzler/agenteval@v0
  with:
    command: lint
    args: --format github
```

`--format github` turns findings into annotations on the pull request. To gate on agent performance instead, run `agenteval ci --min-score 0.7 --max-regression 0.05` in any CI system. `--format junit` writes a report that CI test views can read. See the [CI Guide](docs/ci.md).

## Agent Skill

`skills/agenteval/SKILL.md` tells a coding agent to run `agenteval lint` after it edits an instruction file, and to fix each finding by changing the instructions to match the repo. Before an eval, which runs a paid agent, the skill makes the agent ask you first. It follows the open [Agent Skills](https://agentskills.io/specification) spec.

Copy the file into the skills directory your agent reads. Claude Code reads `.claude/skills/`. Codex, Antigravity, and Zed read `.agents/skills/`.

```bash
dir=.claude/skills/agenteval   # .agents/skills/agenteval for Codex, Antigravity, or Zed
mkdir -p "$dir"
curl -fsSL https://raw.githubusercontent.com/lukasmetzler/agenteval/main/skills/agenteval/SKILL.md \
	-o "$dir/SKILL.md"
```

Agents often skip a skill unless something points them at it. Add one line to your CLAUDE.md or AGENTS.md:

```markdown
After editing CLAUDE.md, AGENTS.md, rules, or skills, use the agenteval skill to lint them.
```

In a test with Claude Haiku 5.5, the agent ignored the installed skill and wrote a command that doesn't exist. With that line, it loaded the skill, ran `agenteval lint`, switched `npm` to `bun`, and flagged the missing script instead of guessing.

## Documentation

| Guide | Covers |
|---|---|
| [Getting Started](docs/getting-started.md) | Installation, first lint, first eval |
| [Core Concepts](docs/concepts.md) | Instructions, tasks, assertions, harnesses, scoring |
| [Linting](docs/lint.md) | Every lint rule, output formats, suppression |
| [Toolchain checks](docs/toolchain.md) | Toolchain detection, `toolchain/*` rules, `lint-delta` |
| [Running Evals](docs/run.md) | Task files, trials, the baseline arm, assertions, scoring |
| [Harnesses](docs/harnesses.md) | Each agent CLI: invocation, permissions, metrics |
| [Harvesting](docs/harvest.md) | AI commit detection, task generation, live review |
| [Results](docs/results.md) | Stored runs, comparison, retention |
| [CI Guide](docs/ci.md) | Thresholds, regression gates, GitHub Actions |
| [Trends](docs/trends.md) | Score history and trend analysis |
| [Configuration](docs/configuration.md) | Every config option, supported models |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Report security issues through the process in [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE)
