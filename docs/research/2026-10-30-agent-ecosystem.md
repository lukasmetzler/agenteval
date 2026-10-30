# agenteval ecosystem catch-up (research date 2026-10-30)

I used primary sources only: vendor docs, GitHub source via `gh api`, the npm and PyPI registries, and arXiv. Anything I couldn't confirm from a primary source is marked **UNVERIFIED**. Nothing was written to disk.

**Current versions (npm/PyPI registry, checked 2026-10-30):**
- Agents: `@anthropic-ai/claude-code` 2.1.314, `@openai/codex` 0.166.0, `@google/gemini-cli` 0.66.0, `@github/copilot` 1.0.105, `opencode-ai` 1.19.5.
- JS tooling: `oxlint` 1.90.0 (2026-10-27), `oxfmt` 0.75.0, `oxlint-tsgolint` 7.0.2005, `@biomejs/biome` 2.6.4, `eslint` 10.14.0, `prettier` 3.9.10, `typescript` **7.0.2**.
- Python tooling: `ruff` 0.17.3 (Production/Stable), `ty` 0.0.95 (Beta).
- Adjacent tools: `agnix` 0.60.1, `rulesync` 43.3.0, `@intellectronica/ruler` 0.3.46, `ultracite` 8.1.0.

---

## 1. Instruction-file formats per agent

| Agent | Files / paths | Frontmatter / scoping | Imports | Limits / notes | Source |
|---|---|---|---|---|---|
| **Claude Code** | `CLAUDE.md` or `.claude/CLAUDE.md`, `CLAUDE.local.md`, `~/.claude/CLAUDE.md`, managed CLAUDE.md, `.claude/rules/**/*.md` (recursive), `~/.claude/rules/`. Ancestor files load at launch and are concatenated root→cwd. Subdirectory CLAUDE.md files load lazily when Claude touches a file there. | Rules take `paths:` (a glob list with brace expansion, capped at 1,000 expanded patterns and 4 MiB per rule). Rules without `paths` load unconditionally. `claudeMdExcludes` skips files by glob. Block HTML comments are stripped before injection. | `@path`, relative to the importing file, max **4 hops**. Ignored inside code spans and fences. External imports trigger an approval dialog. | Target **<200 lines** per file; a warning shows over that length and when the combined total is too big. Files **>4 MiB** are skipped. Lazily loaded files are truncated at **40k chars** (200K context) or 150k–200k (1M context), enforced from v2.1.309. | [memory](https://code.claude.com/docs/en/memory) |
| ↳ AGENTS.md | Read natively **since v2.1.277**, but only when no CLAUDE.md or CLAUDE.local.md exists at or above cwd (the default `claude-md-or-agents-md` setting). `claude-md-and-agents-md` loads both. Configured via the `cc-plugin-agents-md@builtin` plugin options. | Same lazy subdirectory loading as CLAUDE.md. `InstructionsLoaded` hooks don't fire for an AGENTS.md read directly. | `@AGENTS.md` import still works. | `/doctor prompt-audit` (v2.1.283+) audits instruction files. | [memory#agents-md](https://code.claude.com/docs/en/memory) |
| **Codex CLI** | `~/.codex/AGENTS.override.md` or `AGENTS.md`, then git root→cwd. Per directory it takes the first of `AGENTS.override.md`, `AGENTS.md`, or `project_doc_fallback_filenames`; at most one file per directory. | None; nearer files come later and win. | None documented. | `project_doc_max_bytes` defaults to **32 KiB** combined. | [agents-md](https://learn.chatgpt.com/docs/agent-configuration/agents-md) |
| **Copilot** (cloud agent, formerly "coding agent"; code review; VS Code; CLI) | `.github/copilot-instructions.md`, `.github/instructions/**/*.instructions.md`, `AGENTS.md` (anywhere, nearest wins), `CLAUDE.md`/`GEMINI.md` (repo root only). Code review also reads `REVIEW.md`. CLI personal files: `~/.copilot/copilot-instructions.md`, `~/.copilot/instructions/**/*.instructions.md`. | `applyTo: "**/*.ts,**/*.tsx"`, `excludeAgent: "code-review" \| "cloud-agent"`. Support varies by surface: VS Code chat reads AGENTS.md only; the CLI supports all types. | None. | No size limit stated (a 4,000-char review limit is **UNVERIFIED**). | [repo instructions](https://docs.github.com/en/copilot/how-tos/configure-custom-instructions/add-repository-instructions), [support matrix](https://docs.github.com/en/copilot/reference/custom-instructions-support) |
| **Cursor** | `.cursor/rules/**/*.mdc`. **Plain `.md` in that folder is ignored.** Nested `AGENTS.md` is supported and combines with parents. User rules and Team rules (Team > Project > User). | `description`, `globs` (comma-separated), `alwaysApply`. Four modes: Always, Specific Files, Intelligently, Manually (`@rule`). | `@file` references are not inlined; the agent reads them with tools. | Keep rules **<500 lines**. `.cursorrules` isn't mentioned in current docs. | [rules](https://cursor.com/docs/context/rules) |
| **Gemini CLI** | `~/.gemini/GEMINI.md`, workspace dirs and ancestors, plus just-in-time subdirectory loading. `context.fileName` can add `AGENTS.md`. | None. | `@file.md` (no depth limit documented). | **Replaced by Antigravity CLI for unpaid and Google One users on 2026-06-18.** | [gemini-md](https://geminicli.com/docs/cli/gemini-md/) |
| **Antigravity CLI (`agy`)** | `GEMINI.md` and `AGENTS.md` in the workspace, `~/.gemini/GEMINI.md`. Skills in `.agents/skills/` and `~/.gemini/antigravity-cli/skills/`. MCP in `.agents/mcp_config.json` (key renamed to `serverUrl`). | — | — | Import an old setup with `agy plugin import gemini`. | [gcli-migration](https://antigravity.google/docs/cli/gcli-migration) |
| **OpenCode** | `AGENTS.md` searched upward, then `~/.config/opencode/AGENTS.md`. Falls back to `CLAUDE.md` and `~/.claude/CLAUDE.md`. `instructions: []` in `opencode.json` accepts paths, globs and URLs (5 s fetch timeout). | None. | Through `instructions`. | `OPENCODE_DISABLE_CLAUDE_CODE*` env vars disable the Claude fallbacks. Repo moved to `anomalyco/opencode` (`gh api`). | [rules](https://opencode.ai/docs/rules/) |
| **Windsurf → "Devin Desktop" / Devin Local** | `.devin/rules/*.md` plus legacy `.windsurf/rules/*.md` (both load). `.devin/global_rules.md`, `~/.devin/global_rules.md`, `~/.devin/rules/`. `AGENTS.md`, `AGENTS.local.md`, `AGENT.md` from root down to cwd. | `trigger: always_on \| glob \| model_decision \| manual`, `globs`. | — | Character limits no longer stated. Windsurf docs now redirect to docs.devin.ai. | [devin memories](https://docs.devin.ai/desktop/cascade/memories) |
| **Amp** | `AGENTS.md` from cwd up to `$HOME`, `~/.config/amp/AGENTS.md`. Subtree files load when the agent reads a file there. Falls back to `AGENT.md`, then `CLAUDE.md`. | A file pulled in with `@` can declare `globs:` and is included only after a matching file is read. | `@path`, `@~/`, and glob mentions (`@doc/*.md`). | `AMP_IGNORE_GUIDANCE_FILES` skips files by glob. | [agents-md](https://ampcode.com/docs/customize/agents-md) |
| **Kiro** | `.kiro/steering/*.md`, `~/.kiro/steering/`. Foundation files `product.md`, `tech.md`, `structure.md`. `AGENTS.md` at root, in subdirectories, and globally (always included). | `inclusion: always \| fileMatch (fileMatchPattern) \| manual \| auto (name + description)`. Only CLI V3 supports all four modes. | `#[[file:path]]`, `#[[file:path:start-end]]`, `#[[folder:name]]`. | Page updated 2026-10-21. | [steering](https://kiro.dev/docs/steering/) |
| **Zed (v1.4.0+)** | **First match wins:** `.rules` > `.cursorrules` > `.windsurfrules` > `.clinerules` > `.github/copilot-instructions.md` > `AGENT.md` > `AGENTS.md` > `CLAUDE.md` > `GEMINI.md`. Personal file at `~/.config/zed/AGENTS.md`. Skills in `.agents/skills/` and `~/.agents/skills/`. | Rules Library replaced by Skills. | — | — | [zed docs src](https://github.com/zed-industries/zed/blob/main/docs/src/ai/instructions.md) |
| **Cline** | `.clinerules/` or `.cline/rules/`, `.cursorrules`, `.windsurfrules`, `AGENTS.md`, `~/.agents/AGENTS.md`. Global rules in `~/Documents/Cline/Rules`. | `paths:` glob array. `paths: []` means never active. Invalid YAML fails open. | — | — | [cline rules](https://docs.cline.bot/features/cline-rules) |
| **Aider** | Nothing is auto-loaded. Use `--read CONVENTIONS.md` or `read:` in `.aider.conf.yml`. agents.md says Aider needs config to read AGENTS.md. | — | — | — | [conventions](https://aider.chat/docs/usage/conventions.html), [agents.md](https://agents.md/) |
| **Junie** | First match: `.junie/AGENTS.md` → `AGENTS.md` (plus `.junie/playbook.md` and `.junie/rules/*.md`) → legacy `.junie/guidelines.md` or `.junie/guidelines/`. Global `~/.junie/AGENTS.md`. Skills in `.junie/skills/`. | — | — | Page dated 2026-10-30. | [guidelines](https://junie.jetbrains.com/docs/guidelines-and-memory.html), [skills](https://junie.jetbrains.com/docs/agent-skills.html) |

**AGENTS.md standard:** it is stewarded by the Agentic AI Foundation, a Linux Foundation project ("AGENTS.md a Series of LF Projects, LLC"). It has no required format. Nearest file wins, and explicit chat prompts override it. Listed adopters include Codex, Jules, Gemini CLI, Factory, Aider, goose, opencode, Zed, Warp, VS Code, Devin/Windsurf, Junie, UiPath, Amp, Cursor, RooCode, Kilo, Phoenix, Semgrep, Copilot cloud agent, Ona and Augment ([agents.md](https://agents.md/)). Claude Code is now a native reader too ([memory](https://code.claude.com/docs/en/memory)).

---

## 2. Skills, subagents, plugins, commands, hooks, MCP

**Open Agent Skills spec** ([spec](https://agentskills.io/specification), repo [agentskills/agentskills](https://github.com/agentskills/agentskills)). Anthropic originated it and it is now open ([home](https://agentskills.io/)).

| Field | Rule |
|---|---|
| `name` (req) | 1–64 chars, `[a-z0-9-]`, no leading/trailing hyphen, **no `--`**, **must match the parent directory name** |
| `description` (req) | 1–1024 chars |
| `license`, `metadata` (string→string map) | optional |
| `compatibility` | 1–500 chars |
| `allowed-tools` | space-separated, experimental |
| Body | recommended <5,000 tokens and **<500 lines**; metadata ~100 tokens; references kept one level deep |
| Validator | `skills-ref validate ./skill` |

- **Cross-client paths:** `.agents/skills/` (project) and `~/.agents/skills/` (user) are the recommended interoperable locations. On name collisions, clients should be deterministic and warn ([client guide](https://github.com/agentskills/agentskills/blob/main/docs/client-implementation/adding-skills-support.mdx)).
- **Adopters (46 in `clients.jsx`):** Junie, Gemini CLI, OpenCode, OpenHands, Cursor, Amp, Letta, Goose, GitHub Copilot, VS Code, Claude Code, Claude, ChatGPT & Codex, Factory, pi, TRAE, Spring AI, Roo Code, Mistral Vibe, Ona, Qodo, Laravel Boost, Snowflake Cortex, Kiro, Tabnine, Databricks, Pulumi Neo, OpenClaw and others ([clients.jsx](https://github.com/agentskills/agentskills/blob/main/docs/snippets/clients.jsx)). Zed ([skills](https://github.com/zed-industries/zed/blob/main/docs/src/ai/skills.md)) and Devin ([memories](https://docs.devin.ai/desktop/cascade/memories)) also support it.
- **Codex** scans `.agents/skills` in every directory from cwd up to the repo root ([skills](https://learn.chatgpt.com/codex/skills)).

**Claude Code SKILL.md extensions** ([skills](https://code.claude.com/docs/en/skills)):
- Extra fields: `when_to_use`, `argument-hint`, `arguments`, `disable-model-invocation`, `user-invocable`, `allowed-tools`, `disallowed-tools`, `model`, `effort` (`low|medium|high|xhigh|max`), `context: fork`, `agent`, `background`, `hooks`, `paths`, `shell`, `metadata`.
- `license` and `compatibility` are accepted but ignored. Unknown fields are ignored silently.
- Uploading to claude.ai or the API with non-spec fields is a **hard error**.
- `description` + `when_to_use` is truncated at **1,536 chars** (configurable with `skillListingMaxDescChars`).
- The whole listing budget is **1% of the context window** (`skillListingBudgetFraction` or `SLASH_COMMAND_TOOL_CHAR_BUDGET`). Least-used skill descriptions drop first.
- After compaction each skill keeps its first 5k tokens, 25k total.
- Malformed YAML loads the skill with empty metadata.
- `.claude/commands/*.md` is merged into skills; a skill wins a name clash.
- Tooling: `/skill-doctor` (v2.1.252), and `claude plugin validate .claude/skills` (v2.1.233+) finds frontmatter that doesn't parse.

**Subagents** (`.claude/agents/**/*.md`, `~/.claude/agents/`, `--agents` JSON, plugin `agents/`) ([sub-agents](https://code.claude.com/docs/en/sub-agents)):
- Required: `name` (≤256 chars, no `:`) and `description`. Combined descriptions over 15k tokens trigger a startup warning.
- Optional: `tools`, `disallowedTools`, `model`, `permissionMode`, `maxTurns`, `autoCompactWindow`, `skills` (≤32), `mcpServers`, `hooks`, `memory`, `background`, `omitClaudeMd`, `effort`, `isolation: worktree`, `color`, `initialPrompt`, `experimental.cacheTtl`.
- Plugin subagents ignore `hooks`, `mcpServers` and `permissionMode`.

**Plugins** ([plugins-reference](https://code.claude.com/docs/en/plugins-reference)):
- Manifest at `.claude-plugin/plugin.json`; only `name` (kebab-case) is required.
- Components: `hooks/hooks.json`, `.mcp.json`, `.lsp.json`, `outputStyles`, `experimental.{monitors,themes,evals}`, `userConfig`.
- `claude plugin validate [--strict]` validates manifests and MCP entries.

**Hook events (current):** ConfigChange, CwdChanged, DirectoryAdded, Elicitation, ElicitationResult, FileChanged, InstructionsLoaded, MessageDisplay, Notification, PermissionDenied, PermissionRequest, PostCompact, PostModelSwitch, PostToolBatch, PostToolUse, PostToolUseFailure, PreCompact, PreModelSwitch, PreToolUse, SessionEnd, SessionStart, Setup, Stop, StopFailure, SubagentStart, SubagentStop, TaskCompleted, TaskCreated, TeammateIdle, UserPromptExpansion, UserPromptSubmit, WorktreeCreate, WorktreeRemove ([hooks](https://code.claude.com/docs/en/hooks)).

**MCP config locations:**
- Claude: `.mcp.json` (project, under `mcpServers`) and `~/.claude.json` ([mcp](https://code.claude.com/docs/en/mcp)).
- Antigravity: `.agents/mcp_config.json` ([gcli-migration](https://antigravity.google/docs/cli/gcli-migration)).
- Cursor `.cursor/mcp.json`, VS Code `.vscode/mcp.json`, Codex `config.toml [mcp_servers]`: **UNVERIFIED** (not fetched).

---

## 3. Headless invocation (for harness adapters)

| Agent | Prompt-in / non-interactive | Machine output | Usage / cost | Permission bypass | Model | Source |
|---|---|---|---|---|---|---|
| **Claude Code** | `claude -p "<prompt>"` (stdin capped at 10 MB) | `--output-format json\|stream-json` (stream needs `--verbose`, add `--include-partial-messages` for deltas); `--json-schema` gives `structured_output` | JSON has `total_cost_usd` plus a per-model breakdown (client-side estimate) | `--permission-mode acceptEdits\|auto\|dontAsk\|bypassPermissions`, `--dangerously-skip-permissions`, `--permission-prompts none` (v2.1.259+). **Since v2.1.302 `-p` starts in Manual mode.** | `--model` | [headless](https://code.claude.com/docs/en/headless), [cli-ref](https://code.claude.com/docs/en/cli-reference) |
| ↳ extras | `--max-turns`, `--max-budget-usd`, `--no-session-persistence`, `--setting-sources`. **`--bare` skips CLAUDE.md, skills and hooks, so it is wrong for instruction evals.** | `system/init` lists `plugins`, `plugin_errors`, `mcp_server_errors` | SIGTERM exits 143 | | | |
| **Codex** | `codex exec "<prompt>"` or `codex exec -` | `--json` JSONL events: `thread.started`, `turn.started`, `turn.completed`, `turn.failed`, `item.*`, `error`; `-o/--output-last-message`; `--output-schema` | `turn.completed.usage` has `input_tokens`, `cached_input_tokens`, `output_tokens`, `reasoning_output_tokens`. No cost field. | `-s read-only\|workspace-write\|danger-full-access`, `--yolo`. **`--full-auto` is no longer supported**; use `--approve-for-me`. | `-m` | [non-interactive](https://learn.chatgpt.com/docs/non-interactive-mode), [cli ref](https://learn.chatgpt.com/docs/cli/reference) |
| ↳ extras | `-C`, `--ephemeral`, `--skip-git-repo-check`, `--ignore-user-config`, `--ignore-rules`, `-c k=v`, `exec resume` | | | | | |
| **Gemini CLI** | `gemini -p` (also runs headless when there's no TTY) | `-o text\|json\|stream-json`. JSON has `response`, `stats`, `error`. Stream events: `init`, `message`, `tool_use`, `tool_result`, `error`, `result`. | `stats` (per-model fields **UNVERIFIED**) | `--approval-mode default\|auto_edit\|yolo\|plan` (`-y` deprecated) | `-m` (default `auto`) | [headless](https://geminicli.com/docs/cli/headless/), [cli-ref](https://geminicli.com/docs/cli/cli-reference/) |
| ↳ exit codes | 0 OK, 1 error, 42 input error, 53 turn limit | | | | | |
| **Antigravity CLI** | `agy -p` | `--output-format text\|json\|stream-json`, `--input-format stream-json`, `--json-schema`. Envelope: `conversation_id`, `status`, `response`, `duration_seconds`, `num_turns`. | `usage.{input,output,thinking,cache_read,total}_tokens` | `--dangerously-skip-permissions` (by default, tools needing approval are soft-denied with exit 0) | `--model`, `--effort` | [headless](https://antigravity.google/docs/cli/headless) |
| **Copilot CLI** | `copilot -p` | `--output-format json` (JSONL): **UNVERIFIED**, third-party only ([deepwiki](https://deepwiki.com/github/copilot-cli/5.6-command-line-flags-reference)) | not documented | `--allow-all-tools`, `--allow-all`, `--allow-tool=…`, `--no-ask-user`, `--assisted-approval` | `--model` | [programmatic](https://docs.github.com/en/copilot/how-tos/copilot-cli/automate-copilot-cli/run-cli-programmatically) |
| ↳ extras | `-s`, `--share=./x.md` | | | | | |
| **Cursor CLI** | binary is **`agent`**: `agent -p "<prompt>"` | `--output-format text\|json\|stream-json` (`.result`), `--stream-partial-output` | none documented; stream `result` carries `duration_ms` | `--force`/`--yolo` (without it, changes are only proposed), `--trust`, `--sandbox enabled\|disabled` | `--model` | [headless](https://cursor.com/docs/cli/headless), [params](https://cursor.com/docs/cli/reference/parameters) |
| **OpenCode** | `opencode run "<msg>"` | `--format json` (raw events, schema not documented) | `opencode stats`, `opencode export <id>` | `--auto`, `OPENCODE_PERMISSION` env | `-m provider/model`, `--agent` | [cli](https://opencode.ai/docs/cli/) |
| **Devin CLI** (Windsurf successor) | `devin -p "<prompt>"`, `--prompt-file` | no JSON for `-p`; `--export` writes ATIF transcript | not documented | `--permission-mode dangerous`, `--respect-workspace-trust false` | `--model` | [devin cli](https://docs.devin.ai/cli/reference/commands) |
| **Amp** | `amp -x "<prompt>"` (redirecting stdout also enables execute mode) | `--stream-json` (Claude-Code-compatible shape), `--stream-json-input`. `result` has `duration_ms` and `num_turns`. | `usage` object with input, output and cache tokens. **No cost field.** | `--dangerously-allow-all` **UNVERIFIED** | `--fast`; mode flag UNVERIFIED | [execute](https://ampcode.com/docs/cli/execute-mode), [stream-json](https://ampcode.com/docs/cli/streaming-json) |
| ↳ auth | `AMP_API_KEY` | | | | | |
| **Kiro CLI** | `kiro-cli chat --v3 --no-interactive "<p>"` | `--output-format stream-json` | not documented | `--trust-all-tools`, `--trust-tools=…` | `--model`, `--agent` | [headless](https://kiro.dev/docs/cli/headless/) |
| ↳ extras | exit 3 (MCP failed), 4 (agent missing); `KIRO_API_KEY` | | | | | |
| **Aider** | `aider -m "<msg>"` / `-f file`, `--yes`, `--no-auto-commits`, `--dry-run` | none | in-chat `/tokens` only | `--yes` | not in the fetched page | [scripting](https://aider.chat/docs/scripting.html) |
| **Junie CLI** | **UNVERIFIED** (`JUNIE_API_KEY`/`--auth` comes only from a third-party page) | | | | | |

**Bug in the current agenteval adapters (from reading `src/harness/*.ts`):**

| Adapter | Current invocation | Problem |
|---|---|---|
| claude-code | `claude --print --dangerously-skip-permissions <prompt>` | Works, but captures no JSON, cost or turn data |
| cursor | `cursor --cli <prompt>` | Not the documented CLI (`agent -p`) |
| windsurf | `windsurf --cli <prompt>` | No documented equivalent; successor is `devin -p` |
| opencode | `opencode --yes -- <prompt>` | Not the documented CLI (`opencode run --format json --auto`) |

Codex, Gemini/Antigravity, Copilot, Amp and Kiro have no adapter at all.

---

## 4. AI commit attribution signals (history mining)

| Tool | Signal | Source |
|---|---|---|
| Claude Code | `Co-Authored-By: <model name> <noreply@anthropic.com>`. The name is the model in use (e.g. "Claude Sonnet 5"); it falls back to `Claude` or `Claude Code`. A subagent commit names the subagent's model. Configurable or removable via `attribution` (false needs v2.1.281+); `includeCoAuthoredBy` deprecated since v2.0.62. | [settings-reference](https://code.claude.com/docs/en/settings-reference) |
| Codex | `Co-authored-by: Codex <noreply@openai.com>`; PR text `Generated with [Codex](https://openai.com/codex/).` Gated by the server-side `commit_attribution_enabled` setting, which defaults to off. | [codex source test](https://github.com/openai/codex/blob/main/codex-rs/app-server/tests/suite/v2/git_attribution.rs) |
| Copilot cloud agent | Commits are authored by Copilot (bot account id 198982749 via `gh api`, so `198982749+Copilot@users.noreply.github.com` by GitHub's noreply convention). The requester is the co-author. Trailer `Agent-Logs-Url:` (2026-03-20). | [changelog](https://github.blog/changelog/2026-03-20-trace-any-copilot-coding-agent-commit-to-its-session-logs), [search](https://github.blog/changelog/2026-06-18-copilot-authored-pull-requests-now-included-in-author-searches) |
| VS Code (Copilot) | `Co-authored-by: Copilot <copilot@github.com>`, setting `git.addAICoAuthor` (`off\|chatAndAgent\|all`, May 2026). Secondary source (heise); **the address differs from agenteval's current `noreply@github.com` pattern.** | [heise](https://heise.de/-11279554) |
| Cursor | IDE and CLI add a co-author trailer (toggle in Settings > Git, or `attribution.attributeCommitsToAgent` in `~/.cursor/cli-config.json`). Cloud agents commit as "Cursor Agent" and always add it. Exact email **UNVERIFIED** (forum staff replies). Bot `cursor[bot]` exists. | [forum](https://forum.cursor.com/t/disable-auto-co-authored-by-cursor-on-agent-commits-or-make-it-opt-in/168258) |
| Amp | `Co-authored-by: Amp <amp@ampcode.com>` and `Amp-Thread-ID: <thread-url>`, both on by default (`amp.git.commit.coauthor.enabled`, `amp.git.commit.ampThread.enabled`, `AMP_DISABLE_AMP_THREAD_TRAILER`). | [amp settings](https://ampcode.com/docs/cli/settings) |
| Aider | `Co-authored-by: aider (<model>) <aider@aider.chat>` with `--attribute-co-authored-by`; otherwise `(aider)` appended to author/committer names, and optional `aider: ` message prefix. | [aider repo.py](https://github.com/Aider-AI/aider/blob/main/aider/repo.py), [git docs](https://aider.chat/docs/git.html) |
| OpenCode, Gemini CLI | No `Co-authored-by` string found by code search of the default branches (`anomalyco/opencode`, `google-gemini/gemini-cli`). No default trailer: **UNVERIFIED**. | `gh search code` |
| PR bots (existence confirmed via `gh api users/…`) | `google-labs-jules[bot]` 161369871, `devin-ai-integration[bot]` 158243242, `chatgpt-codex-connector[bot]` 199175422, `cursor[bot]` 206951365, `claude[bot]` 209825114, `gemini-code-assist[bot]` 176961590, `amazon-q-developer[bot]` 208079219, `factory-droid[bot]` 138933559, `coderabbitai[bot]` 136622811 | GitHub API |

**Coverage of agenteval's current `detect.ts`:** it has no Amp, Kiro, Junie, OpenCode, Factory, or `Agent-Logs-Url`/`Amp-Thread-ID` trailer signals. It also has no `[bot]` login detection and no `(aider)` name-suffix detection, and it never sees `copilot@github.com` (it requires `noreply@github.com`).

---

## 5. Linting/tooling ecosystem

| Tool | Detect (config files / deps) | Machine-readable run | Exit codes | Notes | Source |
|---|---|---|---|---|---|
| **oxlint 1.90.0** | `.oxlintrc.json`, `.oxlintrc.jsonc`, `oxlint.config.ts`, `oxlint.config.mts` (one per directory; nested configs auto-discovered); deps `oxlint`, `oxlint-tsgolint` | `oxlint --format=json <files>` gives `{diagnostics[{message, code, severity, causes, url, help, filename, labels[{span{offset, length, line, column}}], related}], number_of_files, number_of_rules, threads_count, start_time}`. Other formats: `default`, `agent`, `checkstyle`, `github`, `gitlab`, `junit`, `sarif`, `stylish`, `unix`. | 0 success; 1 for errors, `--max-warnings` exceeded, `--deny-warnings`, invalid config, tsgolint error, and **no files found** | 872 built-in rules. JS plugins (`jsPlugins`, ESLint v9 API) are **alpha**. Type-aware linting (`--type-aware`, `options.typeAware`) covers 59 of 61 typescript-eslint type-aware rules and **requires TS 7.0+**. `--type-check` (experimental) can replace `tsc --noEmit`. | [linter](https://oxc.rs/docs/guide/usage/linter.html), [config](https://oxc.rs/docs/guide/usage/linter/config.html), [formats](https://oxc.rs/docs/guide/usage/linter/output-formats.html), [type-aware](https://oxc.rs/docs/guide/usage/linter/type-aware.html), [js-plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html), [result.rs](https://github.com/oxc-project/oxc/blob/main/apps/oxlint/src/result.rs) |
| ↳ **gotcha** | The default format switches automatically to **`agent`** (one line per diagnostic: `file:line:col: severity rule: msg help: …`) when env shows an agent: `AI_AGENT`, `CLAUDECODE`/`CLAUDE_CODE`, `CODEX_SANDBOX`/`CODEX_THREAD_ID`, `GEMINI_CLI`, `COPILOT_CLI`, `OPENCODE`, `JUNIE_DATA`, `CURSOR_AGENT`, `TERM_PROGRAM=kiro`, `EDITOR=devin`, `REPL_ID`. It switches to `github` when `GITHUB_ACTIONS=true`. **Always pass `--format` explicitly.** The same env list also works as an agent-detection table. | | | | [agent_detection.rs](https://github.com/oxc-project/oxc/blob/main/apps/oxlint/src/agent_detection.rs), [lint.rs](https://github.com/oxc-project/oxc/blob/main/apps/oxlint/src/command/lint.rs) |
| **oxfmt 0.75.0** (pre-1.0) | `.oxfmtrc.json`, `.oxfmtrc.jsonc`, `oxfmt.config.ts`, `oxfmt.config.mts`; dep `oxfmt` | `oxfmt --check` | not documented | Prettier output is the baseline; claims ~30× faster than Prettier | [formatter](https://oxc.rs/docs/guide/usage/formatter.html), [config](https://oxc.rs/docs/guide/usage/formatter/config.html) |
| **Biome 2.6.4** | `biome.json`, `biome.jsonc`, `.biome.json`, `.biome.jsonc` (nested supported); dep `@biomejs/biome` | `biome check --reporter=json` (**experimental, may change in patch releases**). Stable alternatives: `sarif`, `rdjson`, `gitlab`, `junit`, `checkstyle`, `github`, `summary`, `concise`. | not documented on the page | Prefer `sarif` or `rdjson` for a stable schema | [reporters](https://biomejs.dev/reference/reporters/), [configure](https://biomejs.dev/guides/configure-biome/) |
| **ESLint 10.14.0** | `eslint.config.{js,mjs,cjs,ts,mts,cts}` (TS configs need `jiti` ≥2.2 on Node; native on Bun/Deno); dep `eslint` | `eslint -f json` gives `[{filePath, messages[{ruleId, severity, message, messageId, line, column, endLine, endColumn, fix, suggestions}], suppressedMessages, errorCount, fatalErrorCount, warningCount, fixable*Count, usedDeprecatedRules}]`; `json-with-metadata` adds `rulesMeta` | **UNVERIFIED** (not fetched) | eslintrc status in v10 not confirmed | [formatters](https://eslint.org/docs/latest/use/formatters/), [config files](https://eslint.org/docs/latest/use/configure/configuration-files) |
| **Prettier 3.9.10** | `"prettier"` key in package.json/package.yaml, `.prettierrc`, `.prettierrc.{json,yml,yaml,json5,js,mjs,cjs,ts,mts,cts,toml}`, `prettier.config.{js,ts,mjs,mts,cjs,cts}` | `prettier --check` / `--list-different` (no JSON output: **UNVERIFIED**) | **UNVERIFIED** | | [configuration](https://prettier.io/docs/configuration) |
| **TypeScript 7.0.2** (native Go; released **2026-07-08**) | `tsconfig.json`, dep `typescript@^7`; `@typescript/typescript6` provides `tsc6` | `tsc --noEmit` (machine format such as `--pretty false`: **UNVERIFIED** for 7.x) | — | **No API until 7.1**, so typescript-eslint stays on TS 6. Typical full builds 8–12× faster. Now hard errors: `baseUrl`, `moduleResolution: node`, `target: es5`. New flags `--checkers`, `--builders`, `--singleThreaded`. `@typescript/native-preview` last published 2026-07-07 (npm). | [TS 7.0](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/) |
| **ruff 0.17.3** | `pyproject.toml [tool.ruff]`, `ruff.toml`, `.ruff.toml` | `ruff check --output-format=json` (also `junit`, `github`, `gitlab`, `pylint`, `azure`, `grouped`, `concise`) | — | | [settings](https://docs.astral.sh/ruff/settings/) |
| **ty 0.0.95** (Beta) | `ty.toml`, `pyproject.toml` | `ty check --output-format=sarif\|gitlab\|junit\|github\|concise` (**no json**) | `--error-on-warning`, `--exit-zero`, `--exit-zero-on-warning` | | [ty cli](https://docs.astral.sh/ty/reference/cli/) |

**Use for agenteval:**
- **(a) Instruction drift.** Parse the repo toolchain from config files, deps and lockfiles, then flag instruction files that name a different tool. Example: CLAUDE.md says "eslint" but the repo has only `.oxlintrc.json`.
- **(b) Diff scoring.** Run the detected linters only on changed files, using `--format=json`, `-f json`, or `--reporter=sarif`/`rdjson` for Biome. Score new-vs-baseline diagnostics. Treat oxlint's "no files found" exit 1 as N/A.

---

## 6. Agent eval best practices, 2026

| Source | Key points |
|---|---|
| Anthropic, "Demystifying evals for AI agents" (2026-01-09) [link](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents) | Use multiple trials. **pass@k** = at least one success in k; **pass^k** = all k succeed (75% per trial gives ~42% at k=3). Mix code, model and human graders. Grade outcomes and final state over exact paths. Use clean, isolated trials. Separate capability evals from regression evals. Read transcripts. Calibrate LLM judges against humans, give them an "Unknown" option, and use one judge per dimension. Test both should and should-not cases. Start with 20–50 tasks drawn from real failures. |
| `claude plugin eval` (v2.1.269+) [link](https://code.claude.com/docs/en/plugin-evals) | Layout: `evals/<case>/prompt.md` + `graders/*.md` (+ `case.yaml`, schema 1.1). **3 runs per case by default**, with-plugin vs **no-plugin baseline** (Δ). Six grader types: `regex`, `tool_used`, `tool_order`, `file_exists` (free), and `llm`, `baseline` (3 judge calls each). No custom-code graders. Mock MCP servers. Isolated runs that load no user or project config. `--judge-model`, `--ablation none`, `--max-cost-usd`, `--json`. `aggregate-result.json` has `schemaVersion: 1`. Exit 0 / 1 (below threshold) / 2 (partial). `claude plugin eval init` generates suites. |
| agentskills.io evaluating-skills [link](https://agentskills.io/skill-creation/evaluating-skills) | `evals/evals.json` (`id`, `prompt`, `expected_output`, `files`, `assertions`). Each case runs with and without the skill (or old vs new version). Outputs `timing.json` (tokens, ms), `grading.json` (evidence-backed PASS/FAIL), `benchmark.json` (mean/stddev plus delta). Blind A/B judging. Drop assertions that always pass. |
| OpenAI, "Testing Agent Skills Systematically with Evals" (2026-01-22) [link](https://learn.chatgpt.com/blog/eval-skills) | CSV of `id, should_trigger, prompt`, 10–20 prompts, including negative controls. Deterministic checks on the `codex exec --json` trace (`command_execution` items, thrash counts, `turn.completed` tokens). Rubric pass via `--output-schema` (`overall_pass`, `score`, `checks[]`). |
| Gloaguen et al., arXiv [2602.11988](https://arxiv.org/abs/2602.11988) (v3 2026-09-29) | AGENTbench. Context files **do not generally improve success**, raise cost **>20%**, and are followed well. Repo overviews don't help. Use them for non-standard practices and evaluate rigorously. |
| Lulla et al., arXiv [2601.20404](https://arxiv.org/abs/2601.20404) (ICSE'26 JAWs) | 10 repos, 124 PRs. AGENTS.md associated with **−28.64% median runtime** and **−16.58% output tokens**, with comparable completion. |
| Khatri, arXiv [2607.27250](https://arxiv.org/abs/2607.27250) (2026-07-28) | Claude Code + Codex, 288 runs. **Null effect on correctness**, bounded to ~10–15 pp. Failures come from implementation skill, not missing repo knowledge. Borderline tasks are agent-specific, which may explain contradictory earlier results. |
| Vercel (2026-01-27) [link](https://vercel.com/blog/agents-md-outperforms-skills-in-our-agent-evals) | Next.js 16 suite: baseline 53%, skill 53% (**not invoked in 56% of cases**), skill with explicit instruction 79%, compressed AGENTS.md docs index **100%**. Index compressed from 40 KB to 8 KB with no loss. |

---

## 7. Competing and adjacent tools

| Tool | What it has that agenteval lacks |
|---|---|
| [agnix](https://github.com/agent-sh/agnix) (0.60.1, active 2026-10-30) | **757 rules** across Claude/Codex/OpenCode/Cursor/Copilot/Kiro. Covers hooks, MCP and Kiro permission configs. **LSP** plus VS Code/JetBrains/Neovim/Zed extensions, autofix (safe/unsafe tiers), `agnix explain RULE`, browser playground, GitHub Action, `--target <tool>`. |
| Claude Code `/doctor prompt-audit` (v2.1.283+) [memory](https://code.claude.com/docs/en/memory) | Built-in LLM audit for stale, model-outdated, conflicting instructions and references to missing files/commands, with proposed edits. |
| `claude plugin validate` / `claude plugin eval` [evals](https://code.claude.com/docs/en/plugin-evals) | First-party schema validation, plus behavioral A/B evals with an ablation Δ, an HTML report and CI exit codes. |
| [skills-ref](https://github.com/agentskills/agentskills/tree/main/skills-ref) | Reference validator for the Agent Skills spec. |
| [skillgrade](https://github.com/mgechev/skillgrade) (733★) | Unit tests for skills across Claude Code, Codex and Gemini; `eval.yaml` generated from SKILL.md; web UI ([blog](https://blog.mgechev.com/2026/03/14/skillgrade/)). |
| [rulesync](https://github.com/dyoshikawa/rulesync) (43.3.0) / [ruler](https://github.com/intellectronica/ruler) (0.3.46) | Single source of truth that generates per-agent rule files, with nested loading (ruler) and import/export (rulesync). agenteval only lints; it doesn't sync. |
| [ultracite](https://www.npmjs.com/package/ultracite) (8.1.0) | "Linter and formatter for agentic development": a lint/format preset plus agent rule files. |
| [cclint](https://github.com/carlrannaberg/cclint) | Claude-only linter, stale since 2025-09. |

---

## Implications for agenteval (ranked)

1. **Fix and extend the harness adapters.**
   - Cursor (`agent -p`), OpenCode (`opencode run`) and Windsurf (now `devin -p`) call commands that aren't the documented CLIs.
   - Claude captures no JSON, cost or turns.
   - Add Codex (`exec --json`), Antigravity/Gemini (`-o json`), Copilot, Amp (`-x --stream-json`) and Kiro, and normalize their usage events into one token/cost/turns schema.
   - Avoid Claude `--bare`, which skips CLAUDE.md.
   - Sources: §3 rows [headless](https://code.claude.com/docs/en/headless), [codex](https://learn.chatgpt.com/docs/non-interactive-mode), [cursor](https://cursor.com/docs/cli/reference/parameters), [opencode](https://opencode.ai/docs/cli/), [devin](https://docs.devin.ai/cli/reference/commands).
2. **Toolchain detection and drift lint (the oxlint ask).**
   - Detect oxlint/oxfmt/Biome/ESLint/Prettier/tsc 7/ruff/ty from config files and deps.
   - Flag instruction files whose commands don't match (e.g. eslint vs oxlint, `tsc` vs `tsc6`, a removed `baseUrl`).
   - Overlaps with the `/doctor prompt-audit` "commands that don't exist" check, but agenteval can do it deterministically.
   - Sources: §5 table, [prompt-audit](https://code.claude.com/docs/en/memory).
3. **Linter-on-diff scoring signal.**
   - Run detected linters on changed files with explicit `--format=json` (oxlint), `-f json` (ESLint), `--reporter=sarif` (Biome) or `--output-format=json` (ruff), and score the delta against the base commit.
   - Pass `--format` explicitly because oxlint's default output changes under agent env vars, and handle its "no files found" exit 1.
   - Sources: [agent_detection.rs](https://github.com/oxc-project/oxc/blob/main/apps/oxlint/src/agent_detection.rs), [result.rs](https://github.com/oxc-project/oxc/blob/main/apps/oxlint/src/result.rs).
4. **Repeated trials with a baseline arm.**
   - Default to N≥3 runs, and report pass@k, pass^k and stddev.
   - Run with and without the instruction file (or old vs new version), the way `claude plugin eval` and agentskills.io do.
   - Report a token/time delta, since the research finds efficiency effects more often than correctness effects.
   - Sources: [Anthropic](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents), [plugin-evals](https://code.claude.com/docs/en/plugin-evals), [2601.20404](https://arxiv.org/abs/2601.20404), [2602.11988](https://arxiv.org/abs/2602.11988).
5. **Multi-agent instruction resolution model.**
   - Compute what each agent actually loads, which differs per agent:
     - Claude reads AGENTS.md only when there's no CLAUDE.md.
     - Zed takes the first match only.
     - Codex caps at 32 KiB.
     - Cursor ignores `.md` files in `.cursor/rules`.
     - Copilot reads CLAUDE.md and GEMINI.md at root only.
     - Claude truncates lazily loaded files at 40k chars.
   - Lint per target agent. This is agnix's `--target`, but grounded in load semantics.
   - Sources: §1 table.
6. **Update the skill validator to the current specs.**
   - Add: the no-`--` rule, the name must match the directory, `compatibility` ≤500, `effort: xhigh`, `when_to_use`/`arguments`/`disallowed-tools`/`background`/`license`.
   - Add the 1,536-char listing cap, and warn that non-spec fields hard-error when uploaded to claude.ai.
   - Add subagent rules (`name` ≤256, no `:`, `skills` ≤32) and `.agents/skills` discovery.
   - Sources: [spec](https://agentskills.io/specification), [skills](https://code.claude.com/docs/en/skills), [sub-agents](https://code.claude.com/docs/en/sub-agents).
7. **Skill-trigger evals.**
   - Should-trigger and should-not-trigger prompt sets, graded on `tool_used: Skill` or on Codex trace items.
   - Vercel found the skill wasn't invoked in 56% of cases.
   - Sources: [OpenAI](https://learn.chatgpt.com/blog/eval-skills), [Vercel](https://vercel.com/blog/agents-md-outperforms-skills-in-our-agent-evals).
8. **Refresh the harvest signals.**
   - Add Amp (`amp@ampcode.com`, `Amp-Thread-ID`), Codex `noreply@openai.com`, VS Code `copilot@github.com`, the Copilot `Agent-Logs-Url` trailer, the `(aider)` name suffix, and the `[bot]` login table.
   - Parse model names out of Claude trailers into a per-model breakdown.
   - Sources: §4.
9. **New file formats to lint.** Kiro steering `inclusion`/`fileMatchPattern` and `#[[file:]]` refs, Devin `.devin/rules` `trigger`, Amp `globs` in mentioned files, Cline `paths`, Copilot `applyTo`/`excludeAgent`, Junie `.junie/`, Antigravity `.agents/mcp_config.json`. Sources: §1.
10. **Editor and CI surface.** An LSP or `--format sarif|github` output would close the most visible gap with agnix. Source: [agnix](https://github.com/agent-sh/agnix).

**Main UNVERIFIED items:**
- Copilot CLI `--output-format json`.
- The exact Cursor trailer email.
- Junie CLI flags.
- Amp `--dangerously-allow-all`.
- Exit codes for ESLint and Prettier.
- A machine-readable output option for `tsc` 7.
- The Cursor, VS Code and Codex MCP file paths.
- Gemini CLI per-model stats fields.

