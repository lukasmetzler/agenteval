# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.2] - 2026-04-02

### Added

- Phase 2 type definitions: TaskDefinition, InstructionSet, StoredResult, RunMetrics, RawRunResult
- HarnessAdapter interface for pluggable agent execution
- Store types: ComparisonReport, ResultQuery
- Task loader with Zod validation (YAML file, name lookup, inline ad-hoc tasks)
- Config schema extensions: `run:` section (timeout, tokensBudget, resultsDir) and `harnesses:` section
- Task fixture files for testing (example, minimal, invalid)
- 13 new tests for task loading and config schema validation

## [0.1.1] - 2026-04-02

### Fixed

- DRY: extracted `basename()` to `src/utils/path.ts` (was duplicated in 3 files)
- DRY: created shared test helpers in `tests/helpers.ts` (was duplicated in 6 test files)
- Removed ~120 lines of duplicated test boilerplate

## [0.1.0] - 2026-04-01

Phase 1 complete. First usable release of the `agenteval lint` command.

### Added

- `agenteval lint` command: analyze AI coding instruction files for quality issues
- 7 lint rules:
  - `token-count`: per-file and per-section token counting (~estimated via cl100k_base)
  - `overlap`: cross-file n-gram Jaccard similarity detection
  - `bloat`: information density scoring with filler phrase detection
  - `anti-pattern`: 7 built-in patterns + custom regex + wall-of-text + contradiction detection
  - `dead-ref`: broken markdown links and missing file reference detection
  - `context-budget`: total instruction tokens vs model context window
  - `skill`: Anthropic Agent Skills spec compliance (name, description, body length)
- 3 output formats: console (colorized), JSON (`--format json`), markdown (`--format markdown`)
- Inline suppression via `<!-- agenteval-disable [rule-id] -->` HTML comments
- Config system (`agenteval.yaml`) with Zod validation, directory walk-up discovery
- Harness mapping in config (claude-code, opencode, copilot, generic)
- Skill frontmatter parsing (name, version, allowed-tools, hooks)
- `--severity` filter, `--quiet` flag, `--fix` stub
- Exit codes: 0 (clean), 1 (errors), 2 (runtime error)
- CI pipeline (GitHub Actions): lint, typecheck, test, build binary
- Release pipeline: tagged releases with pre-built binaries (linux-x64, darwin-arm64)
- 102 tests across 13 test files
- Synthetic calibration fixtures

### Changed

- VERSION file is single source of truth (cli.ts and tests read from it)

## [0.0.4] - 2026-04-01

### Added

- Lint orchestrator wiring all 7 rules with suppression filtering
- Console, JSON, and markdown output formatters
- Full `agenteval lint` CLI command with flags
- Integration tests against fixture directories

## [0.0.3] - 2026-04-01

### Added

- OverlapDetector: cross-file n-gram Jaccard similarity detection
- BloatScorer: information density heuristics with filler phrase detection
- AntiPatternChecker: 7 built-in patterns + custom regex + wall-of-text + contradiction detection
- DeadSectionAnalyzer: broken markdown links and missing file reference detection
- ContextBudgetChecker: total instruction tokens vs model context window
- SkillValidator: Anthropic Agent Skills spec compliance (name, description, body length)
- Synthetic calibration fixtures (good-claude, bad-bloated, bad-contradictory)
- 51 new tests for lint rules

## [0.0.2] - 2026-04-01

### Added

- Config system with Zod schema, YAML loading, and directory walk-up discovery
- Harness mapping support in config (claude-code, opencode, copilot, generic)
- Markdown parser with unified/remark and YAML frontmatter extraction
- Section extractor with heading-delimited splitting
- Inline suppression comments (`<!-- agenteval-disable [rule-id] -->`)
- Skill frontmatter parsing (name, version, allowed-tools, hooks)
- Token counter using js-tiktoken cl100k_base (~estimated)
- Shared lint types (Diagnostic, LintRule, LintContext, ParsedFile)
- File glob resolution utility
- Structured logger with log levels
- 30 new tests (config, parser, sections, token counter)
- Test fixtures: simple/ and dead-refs/

## [0.0.1] - 2026-04-01

### Added

- Project scaffold with CLI skeleton (`agenteval --version`, `--help`)
- Stub commands for `lint`, `run`, `results`, `compare`, `harvest`
- CI pipeline (GitHub Actions): lint, typecheck, test, build binary
- Release pipeline: tagged releases with pre-built binaries
- Biome configuration (recommended + strict cherry-picks)
- TypeScript strict mode
