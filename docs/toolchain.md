# Toolchain checks

Instruction files go stale in a specific way: the repo moves from ESLint to oxlint, from npm to bun, or renames `lint` to `check`, and CLAUDE.md keeps telling the agent to run the old command. The agent then runs a command that fails or lints with a tool the project dropped.

agenteval reads the repo's actual toolchain and uses it in two places:

1. **Lint.** The `toolchain/*` rules compare the commands in your instruction files with the toolchain.
2. **Eval.** The `lint-delta` assertion and live-review rubric run the repo's own linters on an agent's diff and count the findings it introduced.

`agenteval doctor` prints what was detected:

```
  ✓  toolchain            bun · oxlint · Biome · TypeScript 6
```

## What is detected

Detection reads files at the repo root. It never runs anything.

**Package manager.** The `packageManager` field in `package.json` wins. Otherwise the first lockfile found decides:

| Lockfile | Package manager |
|---|---|
| `bun.lock`, `bun.lockb` | bun |
| `pnpm-lock.yaml` | pnpm |
| `yarn.lock` | yarn |
| `package-lock.json` | npm |
| `uv.lock` | uv |
| `poetry.lock` | poetry |
| `Cargo.lock` | cargo |
| `go.mod` | go |

A `package.json` without a lockfile counts as npm, but `toolchain/wrong-package-manager` only fires when a lockfile proves the choice.

**Scripts.** Every entry in `package.json` `scripts`.

**Tools.** A tool counts as present when one of these exists, checked in this order: a config file, an inline config key in `package.json`, a `pyproject.toml` table, or a dependency.

| Tool | Config files | Other evidence |
|---|---|---|
| oxlint | `.oxlintrc.json`, `.oxlintrc.jsonc`, `oxlint.config.ts`, `oxlint.config.mts` | `oxlint`, `oxlint-tsgolint` dependency |
| oxfmt | `.oxfmtrc.json`, `.oxfmtrc.jsonc`, `oxfmt.config.ts`, `oxfmt.config.mts` | `oxfmt` dependency |
| Biome | `biome.json`, `biome.jsonc`, `.biome.json`, `.biome.jsonc` | `@biomejs/biome` dependency |
| ESLint | `eslint.config.{js,mjs,cjs,ts,mts,cts}`, legacy `.eslintrc*` | `eslintConfig` key, `eslint` dependency |
| Prettier | `.prettierrc*`, `prettier.config.*` | `prettier` key, `prettier` dependency |
| TypeScript | `tsconfig.json` | `typescript` (major version recorded: 6 or 7), `@typescript/native-preview` |
| Ruff | `ruff.toml`, `.ruff.toml` | `[tool.ruff]` in `pyproject.toml` |
| ty | `ty.toml` | `[tool.ty]` |
| Black | | `[tool.black]` |
| mypy | `mypy.ini`, `.mypy.ini` | `[tool.mypy]` |

## Lint rules

The checker reads commands from fenced code blocks tagged `bash`, `sh`, `shell`, `zsh`, `console`, or untagged, and from inline code spans. It splits on `&&`, `||`, `;`, and `|`, drops `$ ` prompts, comments, and `VAR=value` prefixes, and skips global installs (`npm install -g ...`), since those are instructions for humans.

````markdown
## Commands

```bash
npm install        # toolchain/wrong-package-manager: the lockfile is bun.lock
bun run format     # toolchain/missing-script: no "format" script
npx eslint .       # toolchain/absent-tool: this repo uses oxlint (.oxlintrc.json)
bun test           # fine: bun's built-in runner
```
````

| Rule | Severity | Notes |
|---|---|---|
| `toolchain/missing-script` | error | Lists the scripts that do exist. |
| `toolchain/wrong-package-manager` | warning | Suggests the same command with the right package manager. `npx`, `bunx`, and `pnpm dlx` one-offs are not flagged. |
| `toolchain/absent-tool` | warning | Names the tool the repo uses for the same job, if there is one. Only fires when the matching ecosystem is visible (`package.json` for JS tools, `pyproject.toml` for Python tools). |
| `toolchain/undocumented` | info | Reported once per tool on the root CLAUDE.md (or AGENTS.md). A tool that is only a dependency, with no config and no script using it, is not reported. A script that calls the tool counts as documenting it, so `bun run lint` covers a `lint` script that runs `biome check`. |

## lint-delta: linters as an eval signal

`lint-delta` runs the repo's linters on the files an agent changed and keeps only findings on lines the diff added, or anywhere in files it created. Problems that were already there on untouched lines don't count against the agent, so no second baseline run is needed.

```yaml
assertions:
  - type: lint-delta          # every detected linter and type checker
  - type: lint-delta
    tools: [oxlint]           # or pick tools explicitly
    maxNew: 2                 # tolerate up to 2 new findings (default 0)
```

`lint-delta` assertions score in the **conventions** dimension. The findings are stored with the result under `lint`:

```json
"lint": {
  "tools": [{ "tool": "oxlint", "status": "ok" }],
  "newDiagnostics": [
    { "tool": "oxlint", "file": "src/new.js", "line": 2, "rule": "eslint(no-debugger)", "severity": "error", "message": "`debugger` statement is not allowed" }
  ]
}
```

`no-new-warnings` without a `command` now means `lint-delta`. With a `command`, it keeps its v0.8 meaning: the command must exit 0.

`agenteval harvest` adds `lint-delta` to every task it emits when the repo has a linter agenteval can run.

### How each tool runs

agenteval always passes an explicit machine-readable format. oxlint switches its default output to a terse "agent" format when it sees variables like `CLAUDECODE` or `CODEX_SANDBOX`, so relying on the default would break parsing inside agent sessions.

| Tool | Command | Scope |
|---|---|---|
| oxlint | `oxlint --format=json <files>` | changed files |
| ESLint | `eslint -f json <files>` | changed files |
| Biome | `biome lint --reporter=sarif <files>` (Biome's JSON reporter is marked experimental) | changed files |
| Ruff | `ruff check --output-format=json --no-fix <files>` | changed files |
| tsc | `tsc --noEmit --pretty false` | whole project, findings filtered to changed files |

Binaries resolve from the worktree's `node_modules/.bin`, then the source repo's (eval worktrees don't have gitignored `node_modules`), then `PATH`. Ruff falls back to `uv run --no-sync ruff` in uv projects. A tool that can't be found shows up as `unavailable` and doesn't fail the run. Each tool gets 120 seconds.

The live review (`harvest --live`) runs linters only. A whole-project type check takes too long for an interactive review.

### Not covered yet

Prettier, oxfmt, Black, ty, and mypy are detected for the lint rules but not run by `lint-delta`. For those, use a `test-pass` assertion with the command you want.
