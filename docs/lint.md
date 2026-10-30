# Linting Instruction Files

`agenteval lint` statically analyzes AI coding instruction files -- CLAUDE.md, AGENTS.md, GEMINI.md, Copilot, Cursor, Devin/Windsurf and Kiro rules, skills, and subagent definitions -- for quality problems that degrade agent performance. It checks for bloated content that wastes context window tokens, duplicated instructions across files, vague or contradictory rules, broken file references, and violations of skill metadata conventions. Think of it as ESLint for the prose you feed to coding agents: it catches the problems that cause agents to silently ignore your instructions or behave unpredictably.

The linter runs 65 rules across 12 categories, using the cl100k_base tokenizer to estimate token counts. It requires no network access, no API keys, and no running agents. Results are deterministic.

## When to Use It

**Before committing instruction changes.** Run `agenteval lint` as a pre-commit check after editing any instruction file. Catches typos in file references, accidental duplication, and content that blew past your token budget.

**In CI.** Add it to your GitHub Actions or other CI pipeline so instruction quality regressions block the build, the same way linting catches code quality regressions.

**When an agent seems to ignore instructions.** If an agent is not following your rules, the most common cause is that your instruction files exceed the model's context budget and get truncated. `agenteval lint` surfaces this with the `context-budget/exceeded` rule.

**When onboarding a new repository.** Run lint against existing instruction files to get a baseline health report before making changes.

## Basic Usage

```bash
# Lint all instruction files (auto-discovered)
agenteval lint

# Lint specific files
agenteval lint "CLAUDE.md" "AGENTS.md"

# Lint with glob patterns
agenteval lint ".claude/**/*.md" ".github/instructions/*.md"

# Only show warnings and errors
agenteval lint --severity warning

# JSON output for CI
agenteval lint --format json

# Inline annotations on a GitHub pull request
agenteval lint --format github

# SARIF for GitHub code scanning
agenteval lint --format sarif > agenteval.sarif

# Markdown report for pull requests
agenteval lint --format markdown
```

### Auto-Discovery

When called without arguments, `agenteval lint` scans for every instruction, rule, skill, and agent file format it knows:

| Pattern | Kind | Read by |
|---|---|---|
| `**/CLAUDE.md`, `CLAUDE.local.md` | instruction | Claude Code (nested files load lazily) |
| `**/AGENTS.md` | instruction | Codex, Copilot, Cursor, OpenCode, Amp, Devin, Zed, Junie, Claude Code (fallback) |
| `**/GEMINI.md` | instruction | Gemini CLI, Antigravity |
| `.github/copilot-instructions.md` | instruction | GitHub Copilot |
| `.github/instructions/**/*.instructions.md` | Copilot path instruction (`applyTo`) | GitHub Copilot |
| `.claude/rules/**/*.md` | Claude rule (`paths`) | Claude Code |
| `.claude/agents/**/*.md` | subagent | Claude Code |
| `.claude/commands/**/*.md` | slash command | Claude Code |
| `.claude/skills/*/SKILL.md`, `.agents/skills/*/SKILL.md` | skill | Claude Code, Codex, Cursor, Gemini CLI, and other Agent Skills clients |
| `.cursor/rules/**/*.{md,mdc}` | Cursor rule (`globs`, `alwaysApply`) | Cursor (reads `.mdc` only; `.md` files are picked up so lint can warn about them) |
| `.devin/rules/*.md`, `.windsurf/rules/*.md` | Devin rule (`trigger`) | Devin Desktop / Windsurf |
| `.kiro/steering/*.md` | Kiro steering (`inclusion`) | Kiro |
| `.junie/**/*.md` | instruction | JetBrains Junie |

Each file is classified by its path, and the frontmatter checks for that kind run on it. A `.claude/rules/` file with `paths:` is checked as a rule, not as a skill. `node_modules`, `.git`, `dist`, and `.agenteval` are always skipped.

Override these defaults in `agenteval.yaml` with the `instructionGlobs` field, or pass explicit globs as positional arguments. `@path` imports in CLAUDE.md, GEMINI.md, and rule files are followed (up to 4 hops), checked, and counted toward the context budget, even when the imported file matches no glob.

### Example Output

Running `agenteval lint` on a project with a CLAUDE.md and one skill that both have problems produces output like this. Diagnostics are grouped by file, each with its severity, message, rule ID, line, and a suggested fix:

```
  agenteval lint  ·  2 files  ·  ~118 tokens  ·  30ms
  ──────────────────────────────────────────────────────────────────────

  CLAUDE.md
     info   Section "Notes" contains 3 filler phrase(s)  (bloat/filler-phrases)
           line 15
           → Rewrite without phrases like 'make sure to', 'it is important that'
     WARN   Role-playing preambles like "You are an expert...": "You are"  (anti-pattern/role-play)
           line 1
           → Remove the preamble — models already know how to code
     info   Vague instructions without specifics: "make sure to"  (anti-pattern/vague-instruction)
           line 15
           → Replace with a specific example or threshold
     WARN   Draft artifacts left in instructions: "TODO"  (anti-pattern/todo-in-instructions)
           line 15
           → Either complete the TODO or remove it
     ERROR  Contradictory rules: both "always semicolons" and "never semicolons" found  (anti-pattern/contradictory-rules)
           → Remove one of the contradicting rules
     WARN   Broken link [the style guide](./docs/style.md) — target does not exist  (dead-ref/broken-link)
           line 13
           → Fix the link target or remove the link
     ERROR  Referenced file "src/auth/refresh.ts" does not exist  (dead-ref/missing-file)
           line 13
           → Remove the reference or create the missing file
     ERROR  `bun run lint` runs script "lint", which package.json does not define  (toolchain/missing-script)
           line 8
           → Available scripts: test

  .claude/skills/Deploy/SKILL.md
     ERROR  Skill name "Deploy" must contain only lowercase letters, numbers, and hyphens  (skill/name-invalid-chars)
           → Use only lowercase letters, numbers, and hyphens
     info   Skill description should start with trigger conditions (e.g., 'Use when...'). Descriptions that summarize the workflow cause Claude to skip reading the body.  (skill/description-not-trigger)
           → Rewrite as 'Use when [specific triggering condition]'
     info   SKILL.md is missing an '## Overview' section. Good skills start with a concise overview of their purpose.  (skill/missing-overview-section)
           → Add a '## Overview' section after the frontmatter with 1-2 sentences explaining what this skill does

  ──────────────────────────────────────────────────────────────────────
  4 errors  ·  3 warnings  ·  4 info
  Fix the errors above — they indicate broken references or contradictions that will confuse your AI agent.
```

## Quick Overview

agenteval lint runs 65 rules across 12 categories. Here is what each category checks:

| Category | What it catches |
|----------|----------------|
| **TokenCounter** | Files or sections that are too large and waste context window space |
| **OverlapDetector** | Duplicated content across multiple instruction files |
| **BloatScorer** | Low-density prose, filler phrases, and repetitive wording |
| **AntiPatternChecker** | Role-play preambles, vague instructions, contradictions, TODOs |
| **DeadSectionAnalyzer** | References to files, links, or anchors that no longer exist |
| **ContextBudgetChecker** | Tokens loaded at session start exceeding your model's context budget |
| **SkillValidator** | SKILL.md files that break the Agent Skills spec |
| **FrontmatterValidator** | Wrong or unknown frontmatter on rules, subagents, commands, and per-agent rule files |
| **ImportResolver** | `@path` imports that are missing, circular, or too deep |
| **AgentLimits** | Files an agent truncates, skips, or ignores because of its documented limits |
| **ToolchainChecker** | Commands that don't match the repo's package manager, scripts, or linters |
| **DriftDetector** | Referenced files changed long after the instructions describing them |

Run `agenteval lint` and read the output -- it explains each issue it finds. The detailed rule reference below is for when you want to understand a specific rule in depth.

## Flag Reference

| Flag | Short | Default | Description |
|------|-------|---------|-------------|
| `[globs...]` | | auto-discover | Positional glob patterns for instruction files to lint. Overrides `instructionGlobs` from config. |
| `--config <path>` | `-c` | auto-discover | Path to `agenteval.yaml` configuration file. |
| `--format <type>` | `-f` | `console` | Output format. Accepts `console`, `json`, `markdown`, `sarif` (SARIF 2.1.0), or `github` (Actions annotations). |
| `--severity <level>` | | `info` | Minimum severity level to include in output. Accepts `info`, `warning`, or `error`. |
| `--quiet` | | `false` | Show only error-level diagnostics and suppress log output. Overrides `--severity`. |
| `--fix` | | | Remove filler phrases (`bloat/filler-phrases`) in place, then lint again. Other rules are not auto-fixed. Edits prose lines only; code blocks, tables, and indentation stay as they are. |
| `--explain` | | | Console format only: print a longer explanation under each rule that fired (why it matters and how to fix it). |

The `--severity` flag filters the output after all rules have run. Setting `--severity warning` hides info-level diagnostics. Setting `--severity error` shows only errors.

The `--quiet` flag does the same as `--severity error` and also suppresses logger output (warnings such as "No instruction files found", debug messages).

## Rules Reference

Each rule has a fixed severity and a unique rule ID used for inline suppression and configuration. The first seven categories have one section per rule with examples; the newer categories are summarized in tables after the SkillValidator section.

---

### TokenCounter

Checks individual file and section sizes using the cl100k_base tokenizer.

#### `token-count/file-too-large`

| | |
|---|---|
| **Severity** | warning |
| **Default threshold** | 8,000 tokens |
| **Config** | `lint.maxTokensPerFile` |

**What it detects.** Files whose estimated token count exceeds the per-file limit. Large instruction files consume a disproportionate share of the model's context window, leaving less room for the actual task.

**Why it matters.** Models have finite context windows. A 12,000-token CLAUDE.md in a 200k context window may seem harmless, but once you factor in the codebase, conversation history, and tool output, that instruction file could be the difference between the model seeing your code and not.

**How to fix.** Split large files into focused, smaller files. Move reference material (API docs, schema definitions) into separate files that the agent can read on demand rather than loading into every conversation.

**Example -- before:**
```markdown
# CLAUDE.md
<!-- 12,000 tokens of instructions covering everything from git conventions
     to API schemas to deployment procedures -->
```

**Example -- after:**
```markdown
# CLAUDE.md
<!-- 3,000 tokens: core conventions, architecture overview, key rules -->

# .claude/api-schemas.md
<!-- 4,000 tokens: API schemas, moved out of main file -->

# .claude/deployment.md
<!-- 5,000 tokens: deployment procedures, loaded only when relevant -->
```

#### `token-count/section-heavy`

| | |
|---|---|
| **Severity** | info |
| **Trigger** | A single section uses more than 40% of its file's tokens (only fires when the file has multiple sections) |

**What it detects.** Sections that dominate their parent file, suggesting the file's content is unbalanced.

**Why it matters.** A section consuming 60% of a file usually means that section should be its own file, or the file's scope is too broad.

**How to fix.** Extract the heavy section into a dedicated file, or break it into smaller subsections.

---

### OverlapDetector

Compares all pairs of instruction files to find duplicated content.

#### `overlap/high-similarity`

| | |
|---|---|
| **Severity** | warning |
| **Default threshold** | 0.3 (30% Jaccard similarity) |
| **Config** | `lint.overlapThreshold` |

**What it detects.** Pairs of files with high content similarity, measured by Jaccard similarity of 5-gram word sets. A similarity of 0.3 means 30% of the combined unique 5-grams appear in both files.

**Why it matters.** Duplicated instructions waste tokens and create maintenance burden. When you update one copy but not the other, the agent receives contradictory guidance. Models do not handle contradictions well -- they pick one version arbitrarily.

**How to fix.** Consolidate duplicated content into a single source of truth. If both files need the information, put it in one file and reference it from the other.

**Example -- before:**
```
CLAUDE.md:    "Use Biome for formatting. Tabs, not spaces. Line width 100."
AGENTS.md:    "Format with Biome. Use tabs. Max line width is 100 characters."
```

**Example -- after:**
```
CLAUDE.md:    "Use Biome for formatting. Tabs, not spaces. Line width 100."
AGENTS.md:    "See CLAUDE.md for formatting rules."
```

---

### BloatScorer

Measures information density of each section using vocabulary diversity, sentence length, and filler phrase frequency.

#### `bloat/low-density`

| | |
|---|---|
| **Severity** | warning |
| **Default threshold** | 0.5 (density score from 0 to 1, lower = more bloated) |
| **Config** | `lint.bloatThreshold` |

**What it detects.** Sections with low information density. The density score combines three signals: unique word ratio (40% weight), sentence length penalty (30% weight, penalizes sentences over 40 words), and filler phrase penalty (30% weight).

**Why it matters.** Every token in your instruction file costs context window space. Bloated prose with repetitive vocabulary and long-winded sentences carries the same information in more tokens than necessary.

**How to fix.** Rewrite the section to be more concise. Replace long explanatory paragraphs with bullet points. Remove filler phrases. State each rule once, directly.

**Example -- before:**
```markdown
## Code Style
It is important to note that when writing code for this project, you should
make sure to always use consistent formatting. Please keep in mind that we use
tabs for indentation. In order to maintain consistency, please make sure to
follow the established conventions at all times.
```

**Example -- after:**
```markdown
## Code Style
- Indentation: tabs
- Formatter: Biome (runs on save)
- Line width: 100 characters
```

#### `bloat/filler-phrases`

| | |
|---|---|
| **Severity** | info |

**What it detects.** Occurrences of common filler phrases that add words without adding meaning. The detected phrases are:

- "it is important to note that"
- "please make sure to"
- "keep in mind that"
- "it should be noted that"
- "as a general rule"
- "in order to"
- "at the end of the day"
- "for the purpose of"
- "it goes without saying"
- "needless to say"
- "as previously mentioned"
- "in terms of"
- "with respect to"
- "in the event that"
- "on a regular basis"

**Why it matters.** These phrases are noise. They consume tokens without conveying information to the model.

**How to fix.** Delete them. "In order to run tests" becomes "To run tests." "It is important to note that we use Biome" becomes "We use Biome."

---

### AntiPatternChecker

Detects common instruction authoring mistakes based on pattern matching.

#### `anti-pattern/role-play`

| | |
|---|---|
| **Severity** | warning |
| **Pattern** | Lines starting with "You are", "Act as", "Pretend to be", "Imagine you are", "Assume the role" |

**What it detects.** Role-playing preambles at the start of instruction files.

**Why it matters.** Modern coding agents do not need persona assignments. "You are an expert TypeScript developer" does not improve code quality -- the model already has that capability. These preambles waste tokens and sometimes cause the model to generate overly verbose responses to "stay in character."

**How to fix.** Remove the preamble. Replace it with specific, actionable rules.

**Example -- before:**
```markdown
You are an expert TypeScript developer with deep knowledge of React and Next.js.
You always write clean, well-documented code.
```

**Example -- after:**
```markdown
## Stack
- TypeScript strict mode
- React 19 with Server Components
- Next.js 15 App Router
```

#### `anti-pattern/vague-instruction`

| | |
|---|---|
| **Severity** | info |
| **Pattern** | "be careful", "write good code", "make sure to", "try your best", "do your best" |

**What it detects.** Instructions that are too vague to be actionable.

**Why it matters.** "Write good code" does not change model behavior. The model was already trying to write good code. Specific instructions like "all functions must have JSDoc comments" or "never use `any` type" give the model concrete rules to follow.

**How to fix.** Replace vague instructions with specific, verifiable rules.

#### `anti-pattern/todo-in-instructions`

| | |
|---|---|
| **Severity** | warning |
| **Pattern** | `TODO`, `FIXME`, `HACK`, `XXX` (case-sensitive) |

**What it detects.** Draft markers left in instruction files.

**Why it matters.** A TODO in your instruction file means there is an incomplete rule that the agent may misinterpret. Either finish writing the rule or remove the placeholder.

**How to fix.** Complete the TODO or remove it.

#### `anti-pattern/meta-instruction`

| | |
|---|---|
| **Severity** | info |
| **Pattern** | "read this carefully", "follow these instructions", "pay attention to", "important to understand" |

**What it detects.** Instructions about how to read instructions.

**Why it matters.** The model is already processing every token in the file. Telling it to "read carefully" or "pay attention" does not change its behavior. These are wasted tokens.

**How to fix.** Remove the meta-instructions. The content speaks for itself.

#### `anti-pattern/redundant-with-default`

| | |
|---|---|
| **Severity** | info |
| **Pattern** | "write valid", "use proper syntax", "follow best practices", "write clean code", "be consistent" |

**What it detects.** Instructions that restate what models already do by default.

**Why it matters.** Models already attempt to produce valid syntax and follow best practices. Restating these defaults wastes tokens without changing behavior. Use your token budget for project-specific rules that the model would not know otherwise.

**How to fix.** Remove the redundant instruction. Replace it with a specific rule if there is a concrete standard you want enforced.

#### `anti-pattern/time-sensitive`

| | |
|---|---|
| **Severity** | warning |
| **Pattern** | Date-bound phrases like "as of January 2025", "starting in 2024", "until 2025" |

**What it detects.** References to specific dates that will become outdated.

**Why it matters.** Instruction files persist across sessions and team members. A rule like "as of March 2025, use the new API" will confuse agents and humans once that date passes. Write timeless rules, or use version numbers instead of dates.

**How to fix.** Replace date references with version-pinned or evergreen phrasing.

**Example -- before:**
```markdown
As of January 2025, use the v2 API endpoints.
```

**Example -- after:**
```markdown
Use the v2 API endpoints (v1 is deprecated).
```

#### `anti-pattern/contradictory-rules`

| | |
|---|---|
| **Severity** | error |

**What it detects.** Files that contain both "always X" and "never X" for the same word. For example, "always use semicolons" and "never use semicolons" in the same file.

**Why it matters.** Contradictory rules are the most damaging instruction quality issue. The model cannot satisfy both rules, so it picks one arbitrarily. This produces inconsistent behavior that is difficult to debug.

**How to fix.** Find the contradiction and remove one of the conflicting rules. Use `agenteval lint --format json` to see the `meta.item` field, which tells you the conflicting word.

#### `anti-pattern/wall-of-text`

| | |
|---|---|
| **Severity** | warning |
| **Trigger** | Any paragraph (separated by blank lines) with more than 500 words |

**What it detects.** Extremely long paragraphs without any structural breaks.

**Why it matters.** Walls of text are harder for models to parse into discrete rules. Breaking content into shorter paragraphs, lists, or subsections improves the model's ability to locate and apply specific instructions.

**How to fix.** Break the paragraph into multiple paragraphs, use headings to create sections, or convert prose to bullet points.

---

### DeadSectionAnalyzer

Checks that file references and markdown links in instruction files point to files that actually exist on disk.

#### `dead-ref/missing-file`

| | |
|---|---|
| **Severity** | error |

**What it detects.** Bare file path references (like `src/utils/helper.ts` or `./config/schema.ts`) that point to files not present on disk. The rule recognizes paths starting with `./`, `../`, `src/`, `lib/`, `app/`, `config/`, `scripts/`, and `docs/`.

**Why it matters.** If your instruction file tells the agent to "see `src/utils/deprecated.ts` for the legacy API," but that file was deleted last month, the agent will either hallucinate the file's contents or waste time looking for it.

**How to fix.** Update the reference to point to the correct file, or remove the reference if the file is no longer relevant.

#### `dead-ref/broken-link`

| | |
|---|---|
| **Severity** | warning |

**What it detects.** Markdown links (`[text](path)`) where the target path does not exist on disk. HTTP/HTTPS URLs and anchor links (`#section`) are ignored.

**Why it matters.** Broken links degrade the usefulness of instruction files for both agents and human readers.

**How to fix.** Update the link to point to the correct path, or remove it.

---

### ContextBudgetChecker

Checks whether the total token count across all instruction files fits within the configured context budget.

#### `context-budget/exceeded`

| | |
|---|---|
| **Severity** | error |
| **Config** | `model`, `contextBudget`, `lint.maxTotalTokens` |

**What it detects.** The combined token count of all instruction files exceeds the budget. The budget is calculated as:

```
budget = modelContextWindow * contextBudget
```

For example, with the default model (`claude-opus-5-5`, 1,000,000 token window) and default `contextBudget` (0.3), the budget is 300,000 tokens. If `lint.maxTotalTokens` is set, it overrides this calculation. Only files loaded at session start count (see [Other rules](#other-rules)).

**Why it matters.** If instruction files consume too much of the context window, there is not enough room left for the codebase, conversation, and tool output. The agent's performance degrades because it cannot see the full picture.

**How to fix.** Reduce the total size of your instruction files. Use `agenteval lint --format json` to see per-file token counts in the diagnostics. Target the largest files first.

#### `context-budget/near-limit`

| | |
|---|---|
| **Severity** | warning |
| **Trigger** | Total tokens exceed 80% of the budget but have not exceeded it yet |

**What it detects.** A warning that you are approaching the context budget limit.

**Why it matters.** At 80% of budget, you have little headroom. The next instruction file edit could push you over the limit.

**How to fix.** Review your instruction files for content that can be trimmed, consolidated, or moved to on-demand files.

---

### SkillValidator

Validates skill file metadata according to the Agent Skills specification. These rules run only on files classified as skills, which means files named `SKILL.md`. Other files with a `name` field in their frontmatter are not checked here.

#### `skill/name-too-long`

| | |
|---|---|
| **Severity** | error |
| **Limit** | 64 characters |

**What it detects.** Skill names exceeding the maximum length.

**How to fix.** Shorten the skill name. Use hyphens to abbreviate: `my-really-long-and-descriptive-skill-name` becomes `my-skill`.

#### `skill/name-invalid-chars`

| | |
|---|---|
| **Severity** | error |
| **Allowed** | Lowercase letters (`a-z`), digits (`0-9`), hyphens (`-`) |

**What it detects.** Skill names containing uppercase letters, spaces, underscores, or other characters outside the allowed set.

**How to fix.** Rename the skill using only lowercase letters, digits, and hyphens.

**Example -- before:**
```yaml
name: My_Skill v2
```

**Example -- after:**
```yaml
name: my-skill-v2
```

#### `skill/name-reserved-word`

| | |
|---|---|
| **Severity** | error |
| **Reserved words** | `anthropic`, `claude` |

**What it detects.** Skill names containing the reserved words "anthropic" or "claude."

**How to fix.** Choose a different name that does not include reserved words.

#### `skill/description-missing`

| | |
|---|---|
| **Severity** | error |

**What it detects.** Skill files with no `description` field in their frontmatter, or a `description` that is empty or whitespace-only.

**How to fix.** Add a description that explains what the skill does in one or two sentences.

```yaml
---
name: format-check
description: Runs Biome format checks and reports violations with file paths and line numbers.
---
```

#### `skill/description-first-person`

| | |
|---|---|
| **Severity** | warning |
| **Pattern** | "I can", "I will", "I help", "I am", "I'll", "I'm" |

**What it detects.** First-person language in skill descriptions.

**Why it matters.** Skill descriptions should use third person ("Formats code" not "I format code") for consistency and clarity in skill registries.

**How to fix.** Rewrite using third person.

**Example -- before:**
```yaml
description: I can format your TypeScript files using Biome.
```

**Example -- after:**
```yaml
description: Formats TypeScript files using Biome.
```

#### `skill/description-second-person`

| | |
|---|---|
| **Severity** | warning |
| **Pattern** | "You can", "You will", "You should", "You'll", "You're" |

**What it detects.** Second-person language in skill descriptions.

**How to fix.** Rewrite using third person, same as for first-person.

#### `skill/body-too-long`

| | |
|---|---|
| **Severity** | warning |
| **Limit** | 500 lines (body after frontmatter) |

**What it detects.** Skill files where the body content (everything after the YAML frontmatter closing `---`) exceeds 500 lines.

**How to fix.** Split the skill into multiple smaller skills, or extract reference material into separate files.

#### Other SkillValidator rules

SkillValidator runs only on `SKILL.md` files. The rules follow the open [Agent Skills spec](https://agentskills.io/specification) plus Claude Code's documented extensions.

| Rule | Severity | Fires when |
|---|---|---|
| `skill/frontmatter-invalid` | error | SKILL.md has no parseable YAML frontmatter. Agents load it with empty metadata, so it never triggers. |
| `skill/name-invalid-hyphens` | error | `name` starts or ends with `-`, or contains `--`. |
| `skill/name-directory-mismatch` | error | `name` differs from the skill's directory under `skills/`. The spec requires them to match. |
| `skill/name-xml-tags` | error | `name` contains XML tags. |
| `skill/description-too-long` | error | `description` is over 1024 characters. |
| `skill/description-xml-tags` | error | `description` contains XML tags. |
| `skill/description-truncation` | info | `description` is over 250 characters. Descriptions share one always-loaded listing budget, and the least-used are dropped first when it runs out. |
| `skill/listing-truncated` | info | `description` plus `when_to_use` is over 1536 characters, where Claude Code cuts the listing entry. |
| `skill/description-not-trigger` | info | `description` doesn't start with a trigger ("Use when..."). |
| `skill/compatibility-too-long` | error | `compatibility` is over 500 characters. |
| `skill/unknown-field` | warning | A frontmatter key is neither in the spec nor a known Claude Code extension. claude.ai and the API reject skills with non-spec fields on upload. |
| `skill/invalid-effort` | error | `effort` is not `low`, `medium`, `high`, `xhigh`, or `max`. |
| `skill/invalid-context` | error | `context` is not `fork`. |
| `skill/invalid-shell` | error | `shell` is not `bash` or `powershell`. |
| `skill/unreachable` | warning | `disable-model-invocation: true` together with `user-invocable: false`: nothing can invoke the skill. |
| `skill/too-long-no-supporting-files` | info | Body is over 300 lines and the skill directory has no other `.md` files. |
| `skill/missing-overview-section` | info | No `## Overview` heading. |
| `skill/first-person-body` | info | The body says "I will", "I deploy", and so on. |

### FrontmatterValidator

Checks the frontmatter of every non-skill file kind against what its agent documents. Instruction files (CLAUDE.md, AGENTS.md, ...) are not checked.

| Kind | Known fields |
|---|---|
| Claude rule | `paths`, `description` |
| Copilot path instruction | `applyTo`, `excludeAgent` (`code-review` or `cloud-agent`), `name`, `description` |
| Cursor rule | `description`, `globs`, `alwaysApply` |
| Devin/Windsurf rule | `trigger` (`always_on`, `glob`, `model_decision`, `manual`), `globs`, `description` |
| Kiro steering | `inclusion` (`always`, `fileMatch`, `manual`, `auto`), `fileMatchPattern`, `name`, `description` |
| Subagent | `name` (required, max 256, no `:`), `description` (required), `tools`, `model`, `skills` (max 32), `effort`, `isolation`, and the other documented fields |
| Slash command | `description`, `argument-hint`, `allowed-tools`, `model`, `disable-model-invocation` |

| Rule | Severity | Fires when |
|---|---|---|
| `frontmatter/malformed` | error | The frontmatter isn't a YAML mapping, so the agent ignores it. |
| `frontmatter/missing-required` | error | A required field is missing (subagent `name` or `description`). |
| `frontmatter/invalid-value` | error | A field has the wrong type or an unknown enum value. |
| `frontmatter/unknown-field` | warning | A key the agent doesn't document, often a typo (`glob` instead of `globs`). |
| `frontmatter/never-applied` | warning or error | The file can never activate: a Copilot instruction without `applyTo`, a Devin `trigger: glob` without `globs`, a Kiro `fileMatch` without `fileMatchPattern`, or Kiro `auto` without `name` and `description`. |

### ImportResolver

Follows `@path` imports in instruction and Claude rule files the way Claude Code does: relative to the importing file, ignored inside code, at most 4 hops. Only tokens that look like files count (`@AGENTS.md`, `@docs/style.md`, `@./notes`), so `@types/node` or `@alice` in prose are not imports. Home-directory imports (`@~/...`) are personal and skipped.

| Rule | Severity | Fires when |
|---|---|---|
| `import/missing` | error | The imported file does not exist. |
| `import/cycle` | warning | An import leads back to a file already in the chain. |
| `import/too-deep` | warning | An import sits more than 4 hops deep, where Claude Code stops following. |

### AgentLimits

Deterministic checks for limits the agents document. Each one marks content an agent drops without telling you.

| Rule | Severity | Fires when |
|---|---|---|
| `agent-limits/codex-size` | warning | An AGENTS.md plus its ancestors is over 32 KiB. Codex stops reading there (`project_doc_max_bytes`). |
| `agent-limits/claude-lines` | info | A CLAUDE.md is over 200 lines, where Claude Code starts warning. |
| `agent-limits/claude-truncation` | warning | A nested CLAUDE.md is over 40,000 characters. Claude Code truncates lazily loaded files there on 200K-context models. |
| `agent-limits/cursor-md-ignored` | warning | A `.md` file in `.cursor/rules/`. Cursor only reads `.mdc`. |
| `agent-limits/cursor-lines` | info | A Cursor rule is over 500 lines. |
| `agent-limits/claude-ignores-agents-md` | info | Root CLAUDE.md and AGENTS.md both exist and CLAUDE.md doesn't import `@AGENTS.md`. Claude Code reads AGENTS.md only when there is no CLAUDE.md. |

### ToolchainChecker

Reads the shell commands in fenced shell blocks and inline code, and compares them with the repo's real toolchain: lockfile, `package.json` scripts, and linter configs. See [Toolchain checks](toolchain.md) for what is detected and how.

| Rule | Severity | Fires when |
|---|---|---|
| `toolchain/missing-script` | error | `bun run format` (or `npm run`, `pnpm x`, `yarn x`) names a script `package.json` doesn't define. |
| `toolchain/wrong-package-manager` | warning | `npm install` in a repo whose lockfile says bun, pnpm, or yarn. |
| `toolchain/absent-tool` | warning | `npx eslint .` in a repo that lints with oxlint, or `black .` in a repo that formats with Ruff. |
| `toolchain/undocumented` | info | The repo has a linter, type checker, or test script that no instruction file tells the agent how to run. |

### Other rules

| Rule | Severity | Fires when |
|---|---|---|
| `dead-ref/broken-anchor` | warning | A `#anchor` link points at a heading that doesn't exist (same file or linked file). |
| `dead-ref/undefined-reference` | warning | A `[text][ref]` link has no `[ref]: url` definition. |
| `drift/stale-reference` | warning | A file the instructions mention changed in git more than 7 days after the instruction file last did. |
| `context-budget/unknown-model` | info | `model` isn't in agenteval's table, so the budget assumes a 200,000-token window. Set `lint.maxTotalTokens` to silence it. |
| `lint/no-files` | warning | No file matched `instructionGlobs`. |

The context budget counts only what an agent loads at session start: root instruction files, rules without `paths`, and everything they `@import`. Nested CLAUDE.md/AGENTS.md files, path-scoped rules, skills, and subagents load on demand and are not counted.

## Inline Suppression

Suppress specific rules or all rules for the next section using HTML comments.

### Suppress a Specific Rule

```markdown
<!-- agenteval-disable token-count -->
## Large Reference Table

This section intentionally exceeds the per-file token limit because
it contains a lookup table that must stay together.

| Code | Meaning | Details |
|------|---------|---------|
| ...  | ...     | ...     |
```

The suppression applies to the section immediately following the comment. In this example, the `token-count/file-too-large` and `token-count/section-heavy` rules will not fire for the "Large Reference Table" section.

### Suppress All Rules

```markdown
<!-- agenteval-disable -->
## Generated Content

This section is auto-generated and should not be linted.
```

When no rule ID is specified, all rules are suppressed for the next section.

### Suppression Scope

Suppressions are section-scoped, not file-scoped. A suppression comment only affects the next markdown section (from the next heading to the heading after that). It does not suppress rules for the entire file.

```markdown
## Section A
Content here IS linted.

<!-- agenteval-disable bloat -->
## Section B
Content here is NOT linted for bloat rules.

## Section C
Content here IS linted again (suppression expired).
```

## Configuration

All lint behavior can be configured in `agenteval.yaml`. See [Configuration](configuration.md) for the full config reference.

### Lint-Specific Fields

```yaml
version: 1

# Which files to scan (overridden by CLI globs)
instructionGlobs:
  - "CLAUDE.md"
  - "AGENTS.md"
  - ".claude/**/*.md"

# Model determines context window size for budget calculation
model: claude-opus-5-5

# What fraction of the context window instructions may consume (0-1)
contextBudget: 0.3

lint:
  # Maximum tokens per individual file (default: 8000)
  maxTokensPerFile: 8000

  # Maximum total tokens across all files
  # If set, overrides the contextBudget * modelContextWindow calculation
  maxTotalTokens: 50000

  # Jaccard similarity threshold for overlap detection (0-1, default: 0.3)
  overlapThreshold: 0.3

  # Minimum density score before warning (0-1, default: 0.5)
  bloatThreshold: 0.5

  # Additional regex patterns to flag as anti-patterns
  antiPatterns:
    - "\\bfoo_bar\\b"
    - "legacy API"

  # Glob patterns for files to exclude from linting
  ignore:
    - ".claude/archive/**"
    - "**/CHANGELOG.md"
```

### Tuning Thresholds

**Raising `maxTokensPerFile`** to 12000 allows larger individual files before warning. Useful for monorepos with comprehensive instruction files.

```yaml
lint:
  maxTokensPerFile: 12000
```

**Lowering `overlapThreshold`** to 0.15 makes the overlap detector more sensitive, catching files with only 15% shared content. Useful for projects with many small, focused instruction files where any duplication is undesirable.

```yaml
lint:
  overlapThreshold: 0.15
```

**Raising `overlapThreshold`** to 0.5 makes it more lenient, allowing files to share up to 50% content before warning. Useful when files intentionally share boilerplate headers.

```yaml
lint:
  overlapThreshold: 0.5
```

**Raising `bloatThreshold`** to 0.7 flags sections that are only moderately dense. Useful for teams that prioritize concise writing.

```yaml
lint:
  bloatThreshold: 0.7
```

**Adding custom anti-patterns** lets you flag project-specific terms or phrases.

```yaml
lint:
  antiPatterns:
    - "\\bmaster\\b"          # Flag "master" — use "main" instead
    - "\\bblacklist\\b"       # Flag "blacklist" — use "denylist" instead
    - "DO NOT EDIT"           # Flag lock comments that confuse agents
```

Custom patterns are treated as regular expressions with the case-insensitive flag. They fire at `warning` severity with rule IDs `anti-pattern/custom-0`, `anti-pattern/custom-1`, etc.

### Excluding Files

Use `lint.ignore` to exclude files from scanning:

```yaml
lint:
  ignore:
    - ".claude/archive/**"      # Archived instructions
    - ".claude/examples/**"     # Example files not used in production
    - "**/CHANGELOG.md"         # Not an instruction file
```

## CI Integration

### GitHub Actions

```yaml
name: Lint Instructions
on:
  pull_request:
    paths:
      - "CLAUDE.md"
      - "AGENTS.md"
      - ".claude/**"
      - ".github/copilot-instructions.md"
      - ".github/instructions/**"
      - "agenteval.yaml"

jobs:
  lint-instructions:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Lint instruction files
        uses: lukasmetzler/agenteval@v0
        with:
          command: lint
          args: "--format github"

      - name: Lint instruction files (PR comment)
        if: failure()
        run: |
          npx -y agenteval-cli lint --format markdown > lint-report.md
          gh pr comment "${{ github.event.pull_request.number }}" --body-file lint-report.md
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

This workflow:

1. Triggers only when instruction files or the agenteval config change.
2. Runs lint through the agenteval GitHub Action, which installs the release binary. `--format github` turns each diagnostic into an inline annotation on the pull request. The step fails only when there is at least one error-level diagnostic; warnings and info are reported but don't fail the build.
3. On failure, posts the markdown report as a PR comment so the author sees what to fix. Outside the Action, `npx -y agenteval-cli` runs the npm package without a global install.

### Exit Codes

| Code | Meaning |
|------|---------|
| `0` | No error-level diagnostics. Warnings and info may be present. |
| `1` | One or more error-level diagnostics found. |
| `2` | Configuration error, runtime error, or invalid flags. |

Only error-level diagnostics affect the exit code. Warnings and info diagnostics are reported but do not cause a non-zero exit.

## Output Formats

### Console (default)

Human-readable, colorized output for terminal use, grouped by file. This is the same project as in [Example Output](#example-output), run with `--severity warning`:

```
  agenteval lint  ·  2 files  ·  ~118 tokens  ·  35ms
  ──────────────────────────────────────────────────────────────────────

  CLAUDE.md
     WARN   Role-playing preambles like "You are an expert...": "You are"  (anti-pattern/role-play)
           line 1
           → Remove the preamble — models already know how to code
     WARN   Draft artifacts left in instructions: "TODO"  (anti-pattern/todo-in-instructions)
           line 15
           → Either complete the TODO or remove it
     ERROR  Contradictory rules: both "always semicolons" and "never semicolons" found  (anti-pattern/contradictory-rules)
           → Remove one of the contradicting rules
     ...

  ──────────────────────────────────────────────────────────────────────
  4 errors  ·  3 warnings
  Fix the errors above — they indicate broken references or contradictions that will confuse your AI agent.
```

### JSON

Machine-readable output for CI pipelines, custom tooling, and programmatic analysis.

```json
{
  "diagnostics": [
    {
      "ruleId": "anti-pattern/role-play",
      "severity": "warning",
      "message": "Role-playing preambles like \"You are an expert...\": \"You are\"",
      "filePath": "/path/to/project/CLAUDE.md",
      "line": 1,
      "section": "Project",
      "meta": {
        "match": "You are",
        "patternId": "role-play"
      },
      "suggestion": "Remove the preamble — models already know how to code"
    },
    {
      "ruleId": "dead-ref/missing-file",
      "severity": "error",
      "message": "Referenced file \"src/auth/refresh.ts\" does not exist",
      "filePath": "/path/to/project/CLAUDE.md",
      "line": 13,
      "meta": {
        "referencedPath": "src/auth/refresh.ts",
        "resolved": "/path/to/project/src/auth/refresh.ts"
      },
      "suggestion": "Remove the reference or create the missing file"
    }
  ],
  "stats": {
    "filesAnalyzed": 2,
    "totalTokens": 118,
    "duration": 35.30098099999998
  }
}
```

The example is shortened to two diagnostics. `line`, `section`, `meta`, and `suggestion` are present only when the rule sets them.

### Markdown

Structured report suitable for pull request comments, documentation, or sharing.

```markdown
# agenteval Lint Report

**2** files analyzed · **~118** tokens · **36ms**

## Errors (4)

- **anti-pattern/contradictory-rules** in `CLAUDE.md` — Contradictory rules: both "always semicolons" and "never semicolons" found
- **dead-ref/missing-file** in `CLAUDE.md`:13 — Referenced file "src/auth/refresh.ts" does not exist
- **skill/name-invalid-chars** in `.claude/skills/Deploy/SKILL.md` — Skill name "Deploy" must contain only lowercase letters, numbers, and hyphens
- **toolchain/missing-script** in `CLAUDE.md`:8 — `bun run lint` runs script "lint", which package.json does not define

## Warnings (3)

- **anti-pattern/role-play** in `CLAUDE.md`:1 — Role-playing preambles like "You are an expert...": "You are"
- **anti-pattern/todo-in-instructions** in `CLAUDE.md`:15 — Draft artifacts left in instructions: "TODO"
- **dead-ref/broken-link** in `CLAUDE.md`:13 — Broken link [the style guide](./docs/style.md) — target does not exist
```

## Token Counting

agenteval counts tokens with OpenAI's `cl100k_base` encoding from js-tiktoken. The models agenteval targets use their own tokenizers, so the counts are approximate. Expect 10-15% variance from Claude's actual token counts.

The token counts are deliberately conservative: they may overcount slightly, which is safer than undercounting and missing a budget violation.

## Troubleshooting

### "No instruction files found"

```
  (none)
     WARN   No instruction files found matching: **/CLAUDE.md, CLAUDE.local.md, **/AGENTS.md, ...  (lint/no-files)
```

**Cause.** None of the default globs matched any files in the current working directory.

**Fix.** Either create an instruction file (e.g., `CLAUDE.md` in the project root), pass explicit glob patterns (`agenteval lint "docs/instructions.md"`), or configure `instructionGlobs` in `agenteval.yaml`.

### Too many false positives

**Cause.** Default thresholds are tuned for medium-sized projects. Very large projects or projects with intentionally verbose instruction files may trigger warnings that are not actionable.

**Fix.** Adjust thresholds in `agenteval.yaml`:

```yaml
lint:
  maxTokensPerFile: 15000    # Raise from default 8000
  overlapThreshold: 0.5      # Raise from default 0.3
  bloatThreshold: 0.3        # Lower from default 0.5
```

For specific sections that should be exempt, use inline suppression:

```markdown
<!-- agenteval-disable bloat -->
## Detailed API Reference
...
```

### Overlap warnings on unrelated files

**Cause.** Files that share common boilerplate (headers, license blocks, standard preambles) can trigger overlap warnings even though their substantive content differs.

**Fix.** Raise the overlap threshold or use `lint.ignore` to exclude files that are expected to share content:

```yaml
lint:
  overlapThreshold: 0.4
  ignore:
    - ".claude/shared-header.md"
```

### Context budget exceeded but files seem small

**Cause.** The context budget is a fraction of the model's context window, not the full window. The default model (`claude-opus-5-5`) has a 1,000,000-token window, so the default budget is 300,000 tokens. A model with a smaller window, or a model name agenteval doesn't know (it then assumes 200,000 tokens and reports `context-budget/unknown-model`), gives a much smaller budget.

**Fix.** Check which model and budget fraction you have configured:

```yaml
model: my-local-model     # not in the table: assumes 200,000 tokens
contextBudget: 0.3        # 30% = 60,000 token budget
```

To increase the budget, either raise `contextBudget` or set `lint.maxTotalTokens` explicitly:

```yaml
lint:
  maxTotalTokens: 100000
```

### Custom anti-pattern not firing

**Cause.** Custom anti-patterns are regular expressions. Special regex characters need to be escaped, and the pattern must match within a single section.

**Fix.** Test your regex independently. Remember that YAML requires double-escaping backslashes:

```yaml
lint:
  antiPatterns:
    - "\\bfoo_bar\\b"     # Correct: word boundary around foo_bar
    - "\bfoo_bar\b"       # Wrong: YAML interprets \b as backspace
```
