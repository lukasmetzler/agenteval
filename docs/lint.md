# Linting Instruction Files

`agenteval lint` statically analyzes AI coding instruction files -- CLAUDE.md, AGENTS.md, copilot-instructions.md, and skill definitions -- for quality problems that degrade agent performance. It checks for bloated content that wastes context window tokens, duplicated instructions across files, vague or contradictory rules, broken file references, and violations of skill metadata conventions. Think of it as ESLint for the prose you feed to coding agents: it catches the problems that cause agents to silently ignore your instructions or behave unpredictably.

The linter runs 24 rules across 7 categories, using the cl100k_base tokenizer to estimate token counts. It requires no network access, no API keys, and no running agents. Results are deterministic.

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

# Markdown report for pull requests
agenteval lint --format markdown
```

### Auto-Discovery

When called without arguments, `agenteval lint` scans for instruction files matching these default globs:

- `CLAUDE.md`
- `AGENTS.md`
- `.github/copilot-instructions.md`
- `.claude/**/*.md`
- `.github/instructions/*.md`

Override these defaults in `agenteval.yaml` with the `instructionGlobs` field, or pass explicit globs as positional arguments.

### Example Output

Running `agenteval lint` on a project with several issues produces output like this:

```
  ⚠ warn   token-count/file-too-large          CLAUDE.md        ~12340 tokens exceeds limit of 8000
  ℹ info   token-count/section-heavy            CLAUDE.md:15     Section "Conventions" uses ~5765 tokens (47% of file)
  ⚠ warn   overlap/high-similarity              CLAUDE.md        CLAUDE.md and AGENTS.md share 42% similarity
  ⚠ warn   bloat/low-density                    AGENTS.md:8      Section "Overview" has low information density (score: 0.38, threshold: 0.5)
  ℹ info   bloat/filler-phrases                 AGENTS.md:8      Section "Overview" contains 3 filler phrase(s)
  ⚠ warn   anti-pattern/role-play               CLAUDE.md:1      Role-playing preambles like "You are an expert...": "You are an expert"
  ✗ error  anti-pattern/contradictory-rules     CLAUDE.md        Contradictory rules: both "always semicolons" and "never semicolons" found
  ✗ error  dead-ref/missing-file                AGENTS.md:22     Referenced file "src/utils/deprecated.ts" does not exist
  ⚠ warn   dead-ref/broken-link                 CLAUDE.md:45     Broken link [style guide](./docs/style.md) — target does not exist
  ✗ error  context-budget/exceeded              (all files)      Total instruction tokens (~72000) exceed budget of 60000 (30% of 200000 context window)

  ──────────────────────────────────────────────────────────────────────
  2 files analyzed · ~72000 tokens · 3 errors · 4 warnings · 2 info · 48ms
```

## Flag Reference

| Flag | Short | Default | Description |
|------|-------|---------|-------------|
| `[globs...]` | | auto-discover | Positional glob patterns for instruction files to lint. Overrides `instructionGlobs` from config. |
| `--config <path>` | `-c` | auto-discover | Path to `agenteval.yaml` configuration file. |
| `--format <type>` | `-f` | `console` | Output format. Accepts `console`, `json`, or `markdown`. |
| `--severity <level>` | | `info` | Minimum severity level to include in output. Accepts `info`, `warning`, or `error`. |
| `--quiet` | | `false` | Suppress all output except errors. Sets the logger to error level. |
| `--fix` | | | Auto-fix issues where possible. Not yet implemented; prints a notice and continues. |

The `--severity` flag filters the output after all rules have run. Setting `--severity warning` hides info-level diagnostics. Setting `--severity error` shows only errors.

The `--quiet` flag is more aggressive: it suppresses all logger output (debug messages, file counts) in addition to filtering to errors only.

## Rules Reference

agenteval lint runs 24 rules organized into 7 categories. Each rule has a fixed severity and a unique rule ID used for inline suppression and configuration.

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

For example, with the default model (`claude-sonnet-4-20250514`, 200,000 token window) and default `contextBudget` (0.3), the budget is 60,000 tokens. If `lint.maxTotalTokens` is set, it overrides this calculation.

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

Validates skill file metadata according to the Anthropic skill specification. These rules only apply to files with YAML frontmatter containing a `name` field.

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
model: claude-sonnet-4-20250514

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

      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: Install agenteval
        run: bun install

      - name: Lint instruction files
        run: bunx agenteval lint --severity warning --format json

      - name: Lint instruction files (PR comment)
        if: failure()
        run: |
          bunx agenteval lint --format markdown > lint-report.md
          gh pr comment "${{ github.event.pull_request.number }}" --body-file lint-report.md
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

This workflow:

1. Triggers only when instruction files or the agenteval config change.
2. Runs lint at `warning` severity -- warnings and errors both cause a failure.
3. On failure, posts the markdown report as a PR comment so the author sees what to fix.

### Exit Codes

| Code | Meaning |
|------|---------|
| `0` | No error-level diagnostics. Warnings and info may be present. |
| `1` | One or more error-level diagnostics found. |
| `2` | Configuration error, runtime error, or invalid flags. |

Only error-level diagnostics affect the exit code. Warnings and info diagnostics are reported but do not cause a non-zero exit.

## Output Formats

### Console (default)

Human-readable, colorized output for terminal use.

```
  ⚠ warn   token-count/file-too-large          CLAUDE.md        ~12340 tokens exceeds limit of 8000
  ✗ error  dead-ref/missing-file                AGENTS.md:22     Referenced file "src/utils/deprecated.ts" does not exist

  ──────────────────────────────────────────────────────────────────────
  2 files analyzed · ~15230 tokens · 1 error · 1 warning · 34ms
```

### JSON

Machine-readable output for CI pipelines, custom tooling, and programmatic analysis.

```json
{
  "diagnostics": [
    {
      "ruleId": "token-count/file-too-large",
      "severity": "warning",
      "message": "~12340 tokens exceeds limit of 8000",
      "filePath": "/path/to/CLAUDE.md",
      "meta": {
        "tokens": 12340,
        "limit": 8000
      }
    },
    {
      "ruleId": "dead-ref/missing-file",
      "severity": "error",
      "message": "Referenced file \"src/utils/deprecated.ts\" does not exist",
      "filePath": "/path/to/AGENTS.md",
      "line": 22,
      "meta": {
        "referencedPath": "src/utils/deprecated.ts",
        "resolved": "/path/to/src/utils/deprecated.ts"
      }
    }
  ],
  "stats": {
    "filesAnalyzed": 2,
    "totalTokens": 15230,
    "duration": 34.5
  }
}
```

### Markdown

Structured report suitable for pull request comments, documentation, or sharing.

```markdown
# agenteval Lint Report

**2** files analyzed · **~15230** tokens · **34ms**

## Errors (1)

- **dead-ref/missing-file** in `AGENTS.md`:22 — Referenced file "src/utils/deprecated.ts" does not exist

## Warnings (1)

- **token-count/file-too-large** in `CLAUDE.md` — ~12340 tokens exceeds limit of 8000
```

## Token Counting

agenteval uses the `cl100k_base` tokenizer from js-tiktoken. This is the same tokenizer used by GPT-4 and GPT-4o. Claude uses a different tokenizer internally, so counts are approximate -- expect 10-15% variance from Claude's actual token counts.

The token counts are deliberately conservative: they may overcount slightly, which is safer than undercounting and missing a budget violation.

## Troubleshooting

### "No instruction files found"

```
⚠ warn   lint/no-files  (none)  No instruction files found matching: CLAUDE.md, AGENTS.md, ...
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

**Cause.** The context budget is a fraction of the model's context window, not the full window. With the default settings (30% of 200,000 = 60,000 tokens), even modest instruction files can add up.

**Fix.** Check which model and budget fraction you have configured:

```yaml
model: claude-sonnet-4-20250514   # 200,000 token window
contextBudget: 0.3                 # 30% = 60,000 token budget
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
