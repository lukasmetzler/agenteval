# Linting Instruction Files

The `lint` command analyzes your AI coding instruction files for quality issues without running any agents. It catches problems like bloated files that waste context tokens, duplicate content across files, vague instructions that don't help agents, and broken references.

## When to Use This

- Before committing changes to your CLAUDE.md, AGENTS.md, or other instruction files
- As part of CI to catch instruction quality regressions
- When your agent seems to be ignoring instructions (often a sign of context budget issues)
- When onboarding a new repo to understand instruction file health

## Basic Usage

```bash
# Auto-discover and lint all instruction files
agenteval lint

# Lint specific files
agenteval lint "CLAUDE.md" "AGENTS.md"

# Lint with glob patterns
agenteval lint ".claude/**/*.md" ".github/instructions/*.md"
```

By default, agenteval looks for these files:
- `CLAUDE.md`
- `AGENTS.md`
- `.github/copilot-instructions.md`
- `.claude/**/*.md`
- `.github/instructions/*.md`

You can override this in `agenteval.yaml` (see [Configuration](configuration.md)).

## Output Formats

```bash
agenteval lint                    # Console output (default, human-readable)
agenteval lint --format json      # JSON output (for CI pipelines and tooling)
agenteval lint --format markdown  # Markdown report (for PRs and docs)
```

## Filtering Results

```bash
# Only show warnings and errors (hide info-level hints)
agenteval lint --severity warning

# Only show errors (strictest)
agenteval lint --severity error

# Minimal output: errors only, no decoration
agenteval lint --quiet
```

## All Flags

| Flag | Short | Default | Description |
|------|-------|---------|-------------|
| `[globs...]` | | auto-discover | Glob patterns for instruction files to lint |
| `--config <path>` | `-c` | auto-discover | Path to `agenteval.yaml` config file |
| `--format <type>` | `-f` | `console` | Output format: `console`, `json`, or `markdown` |
| `--severity <level>` | | `info` | Minimum severity to show: `info`, `warning`, or `error` |
| `--quiet` | | `false` | Only show errors, suppress all other output |
| `--fix` | | | Auto-fix issues where possible (not yet implemented) |

## What It Checks

### Token & Size Issues

| Rule | Severity | What it catches |
|------|----------|----------------|
| `token-count/file-too-large` | warning | File exceeds the token limit (default: 8,000). Large files waste context window. |
| `token-count/section-heavy` | info | One section dominates the file. Consider splitting. |
| `context-budget/exceeded` | error | Total tokens across all instruction files exceed the model's context budget. |
| `context-budget/near-limit` | warning | Using >80% of the context budget. Getting close to the limit. |

### Content Quality

| Rule | Severity | What it catches |
|------|----------|----------------|
| `overlap/high-similarity` | warning | Two files share >30% similar content. Duplicated instructions confuse agents. |
| `bloat/low-density` | warning | Sections with low information density. Padding wastes tokens. |
| `bloat/filler-phrases` | info | Filler phrases like "Please ensure", "It is important to". Noise. |

### Anti-Patterns

| Rule | Severity | What it catches |
|------|----------|----------------|
| `anti-pattern/role-play` | warning | "You are an expert..." preambles. Models don't need this. |
| `anti-pattern/vague-instruction` | info | "Be careful", "write good code". Too vague to help. |
| `anti-pattern/todo-in-instructions` | warning | TODO/FIXME left in instructions. Ship it or remove it. |
| `anti-pattern/meta-instruction` | info | "Read this carefully". The model is already reading it. |
| `anti-pattern/redundant-with-default` | info | Restating default model behavior. Wasted tokens. |
| `anti-pattern/time-sensitive` | warning | Date-bound references that will go stale. |
| `anti-pattern/contradictory-rules` | error | "Always X" and "Never X" in the same file. Confusing. |
| `anti-pattern/wall-of-text` | warning | Paragraphs over 500 words. Break them up. |

### References & Links

| Rule | Severity | What it catches |
|------|----------|----------------|
| `dead-ref/missing-file` | error | References a file that doesn't exist on disk. |
| `dead-ref/broken-link` | warning | Broken markdown links. |

### Skill File Validation

These rules apply to Anthropic Skills spec files (files with YAML frontmatter containing a `name` field):

| Rule | Severity | What it catches |
|------|----------|----------------|
| `skill/name-too-long` | error | Skill name exceeds 64 characters. |
| `skill/name-invalid-chars` | error | Skill name contains non-lowercase/number/hyphen characters. |
| `skill/name-reserved-word` | error | Skill name contains "anthropic" or "claude". |
| `skill/description-missing` | error | No description in skill frontmatter. |
| `skill/description-first-person` | warning | "I can..." in description. Use third person. |
| `skill/description-second-person` | warning | "You can..." in description. Use third person. |
| `skill/body-too-long` | warning | Skill body exceeds 500 lines. |

## Inline Suppression

You can suppress specific rules for sections of your instruction files:

```markdown
<!-- agenteval-disable token-count -->
## This Section Won't Trigger Token Warnings

Large content here that you intentionally want to keep...

<!-- agenteval-disable -->
## This Section Suppresses All Rules
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | No errors found (warnings and info are OK) |
| 1 | One or more error-level diagnostics found |
| 2 | Runtime or configuration error |

## CI Integration

Add to your GitHub Actions workflow:

```yaml
- name: Lint instruction files
  run: agenteval lint --format json --severity error
```

The JSON output is machine-parseable. Exit code 1 when errors are found makes the step fail.
