# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.1] - 2026-04-01

### Fixed

- Release workflow now uses `fetch-depth: 0` for full git history (harvest tests need parent commits)

## [0.3.0] - 2026-04-01

Phase 3 begins. Mine your git history for AI-involved commits and generate eval benchmarks from real work.

### Added

- `agenteval harvest` command: scan git history, detect AI-involved commits, emit TaskDefinition YAML files
  - Detection heuristics: Co-authored-by trailers (Claude, Copilot, Cursor, Devin, Aider), author email patterns, commit message patterns
  - Confidence scoring per detection method (0.6-0.9), configurable threshold via `--min-confidence`
  - Prompt inference from commit messages with conventional-commit prefix stripping and past-tense to imperative conversion
  - `--dry-run` scorecard mode: list detected commits without writing files
  - `--since`, `--until`, `--commit` date/hash filtering
  - `--output`, `--force`, `--format json`, `--harness`, `--timeout` options
  - Idempotent: skips existing files unless `--force` is passed
  - Emitted YAML is compatible with `agenteval run --task`
- `harvest` section in `agenteval.yaml` config schema: `outputDir`, `minConfidence`, `defaultHarness`, `defaultTimeout`
- TODOS.md for tracking future work (CI integration)
- 39 new tests (193 total): real repo detection, synthetic fixtures for all AI tool patterns, error edge cases

### Fixed

- False positive: `noreply@github.com` co-author no longer detected as Copilot unless the name also contains "copilot" (prevents flagging human squash-merge commits)
- NaN `--min-confidence` values now correctly rejected instead of silently filtering all commits
- Write failures in task YAML generation now log the actual error instead of silently returning null

## [0.2.1] - 2026-04-02

### Fixed

- **Security:** Command injection in assertion runner — replaced naive space-split with `sh -c` shell execution
- **Security:** Path traversal in `--instructions` flag — validate resolved path stays under project directory
- **Security:** Unsafe harness cast — validate `--harness` value against known harness list before use
- **Security:** Invalid regex in convention assertions — catch SyntaxError and report as failed assertion
- Improved logging for silent catch blocks in result pruning

## [0.2.0] - 2026-04-02

Phase 2 complete. Full eval loop: run agents, measure results, compare instruction versions.

### Added

- `agenteval run --task <task>` command: execute eval runs with harness adapters
  - Supports YAML task files, task name lookup, and inline ad-hoc descriptions
  - Git worktree isolation with automatic cleanup
  - Claude Code adapter, generic adapter, mock adapter
  - Scoring with correctness, precision, efficiency, conventions
  - Results saved as JSON to `.agenteval/results/`
- `agenteval results` command: list, filter, prune, and export stored results
  - Filter by task, harness, status; limit results
  - Export as JSON or markdown
  - Prune by retention period
- `agenteval compare <runA> <runB>` command: side-by-side comparison
  - Console table, JSON, and markdown output formats
  - Winner determination with metric deltas
  - Handles failed/partial runs gracefully

### Changed

- `run`, `results`, `compare` commands are now fully implemented (were stubs since v0.0.1)

## [0.1.4] - 2026-04-02

### Added

- Result store: write, read, list, prune results as individual JSON files
- Result listing with query filters (task, harness, status, limit) sorted by timestamp
- Result pruning by retention period (e.g., "90d")
- Comparison engine: side-by-side metric comparison with winner determination
- One-sided null score handling (scored run beats failed run)
- Console table formatter for comparisons
- Markdown formatter for comparison reports
- 18 new tests (store CRUD, filtering, pruning, comparison, formatting)

## [0.1.3] - 2026-04-02

### Added

- Run engine: git worktree management (create, remove, stale cleanup)
- Assertion evaluator: files-changed, files-unchanged, test-pass, no-new-warnings, convention
- Scorer: correctness, precision, efficiency, conventions with weighted overall score
- Precision handles zero-files-changed edge case and weight renormalization
- Claude Code harness adapter (CLI spawning, token parsing from output)
- Generic harness adapter (configurable command, args, instruction path)
- Mock harness adapter for deterministic testing (no real agent spawned)
- Harness registry with auto-detection from instruction file presence
- Run orchestrator: worktree lifecycle, adapter dispatch, scoring pipeline
- minimatch dependency for glob pattern matching in assertions
- 20 new tests (assertions, scorer, registry)

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
