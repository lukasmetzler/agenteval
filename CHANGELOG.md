# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.7.6] - 2026-04-05

### Fixed

- Install script: tag extraction failed on minified GitHub API JSON, causing 404 on binary download
- Auto-release workflow: combined tag + build + release into one job (tags from `GITHUB_TOKEN` don't trigger other workflows)
- `release.yml` now supports `workflow_dispatch` for manual retriggers
- Docs: updated version string and command list in getting-started guide

## [0.7.5] - 2026-04-05

### Fixed

- `agenteval update` now downloads to a temp file first, then replaces the binary. Fixes "text file busy" error on Linux where you can't overwrite a running executable.

## [0.7.4] - 2026-04-05

Instruction drift detection, inspired by community feedback on Reddit.

### Added

- New lint rule `drift/stale-reference`: warns when source files referenced in instructions have been modified more recently than the instruction file itself (7-day threshold). Catches the #1 problem reported by users — instructions describing refactored code that the AI confidently follows.
- Human-readable time differences in drift warnings ("3 weeks", "2 months")

## [0.7.3] - 2026-04-03

### Added

- `agenteval update` command: self-update to the latest release. Detects platform, downloads binary, replaces itself.
- Background version check: once per day, checks GitHub for newer versions. Shows a one-time notification when an update is available.
- Compiled binary now shows correct version (`--version` was showing "unknown")

### Fixed

- Version embedding: build script injects version at compile time instead of reading files at runtime

## [0.7.2] - 2026-04-03

Skill validation rules inspired by the superpowers repo (94% PR rejection rate).

### Added

- `skill/description-not-trigger` — descriptions should start with "Use when..." to tell Claude WHEN to invoke the skill, not WHAT the workflow does
- `skill/too-long-no-supporting-files` — SKILL.md over 300 lines should extract heavy content into supporting files
- `skill/missing-overview-section` — good skills start with a `## Overview` section
- `skill/first-person-body` — skill bodies should use imperative voice ("Deploy...") not first-person ("I deploy...")
- 9 new tests (398 → 407)

## [0.7.1] - 2026-04-03

Bulletproof linting. Based on in-depth research of Anthropic skills spec, GitHub Copilot instructions, AGENTS.md, and Cursor rules.

### Added

- **Markdown link checker**: heading anchors (`#section`), image references (`![](path)`), cross-file heading validation (`foo.md#heading`), reference-style links (`[text][ref]`), new diagnostics: `dead-ref/broken-anchor`, `dead-ref/undefined-reference`
- **Code block exclusion**: fenced code blocks (`\`\`\``) and inline code spans stripped before analysis in bloatScorer, antiPatternChecker, and bare path detection. Eliminates false positives from code examples.
- **Skill validator hardening**: validates effort (`low`/`medium`/`high`/`max`), context (`fork`), shell (`bash`/`powershell`), detects unknown frontmatter fields, warns on description truncation at 250 chars, flags unreachable skills
- New shared utility `src/lint/utils.ts` with `stripCodeBlocks`, `stripInlineCode`, `stripAllCode`
- 6 new skill diagnostics: `skill/invalid-effort`, `skill/invalid-context`, `skill/invalid-shell`, `skill/unknown-field`, `skill/description-truncation`, `skill/unreachable`
- `SkillFrontmatterFields` expanded from 7 to 16 fields covering the full Anthropic spec
- 38 new tests (360 → 398)

## [0.7.0] - 2026-04-03

"Insight Engine". Score history and temporal trend analysis.

### Added

- `agenteval trends` command: score history and trend analysis
  - Single task mode (`--task <name>`): shows run-by-run history with deltas, best/worst/average, trend direction
  - All tasks mode (default): summary table with runs, latest, best, worst, and trend per task
  - Trend detection: improving (↑), regressing (↓), or stable (→) based on last 3 scores
  - Three output formats: console (box tables), JSON (structured), markdown
  - Empty state handling with suggestions for available tasks
- `docs/trends.md` with command reference, examples, and trend detection explanation

### Changed

- 9 commands total: init, doctor, lint, harvest, run, results, compare, ci, trends
- Updated README, CLAUDE.md, getting-started.md with trends references

## [0.6.0] - 2026-04-03

"Continuous Quality". Instruction quality regression detection in CI.

### Added

- `agenteval ci` command: runs all harvested eval tasks, scores each one, fails the build on regressions
  - Absolute threshold: fail if score drops below `--min-score` (default 0.5)
  - Relative threshold: fail if score regresses more than `--max-regression` vs previous run (default 0.1)
  - Progress output showing each task with score, delta, and pass/fail status
  - Summary with pass/fail counts, elapsed time, and failure details
  - Configurable via `ci` section in agenteval.yaml or CLI flags
- CI config section in agenteval.yaml: `tasksDir`, `minScore`, `maxRegression`, `instructions`
- `docs/ci.md` with full CI guide, GitHub Actions example, threshold tuning tips
- 7 new tests for CI config validation, previous-result lookup, and CLI integration

### Changed

- TODOS.md: removed `agenteval ci` item (now implemented)
- README.md: added ci to commands table and documentation index
- CLAUDE.md: added ci to command list
- getting-started.md: added CI as Step 6 in the workflow

## [0.5.9] - 2026-04-03

### Added

- `harvest --live` shows current git branch name in output
- Elapsed time shown after harvest dry-run and harvest summary (e.g., "Completed in 0.8s")
- `--help` hint shown after unknown command errors ("run agenteval --help for usage")

### Fixed

- Version fallback in compiled binary updated from stale 0.3.2 to 0.5.9
- package.json version synced to 0.5.8

## [0.5.8] - 2026-04-03

### Added

- Dependabot configuration for automated dependency updates (npm weekly + GitHub Actions weekly)
- Dependency groups: lint-and-types (biome, typescript, @types), markdown (remark, mdast, unified)

### Changed

- All dependencies pinned to exact versions (removed `^` caret ranges)
- package.json version synced with VERSION file (was stuck at 0.3.2)

## [0.5.7] - 2026-04-03

### Added

- `agenteval doctor` command: environment health check verifying git, config, instruction files, claude CLI, and gh CLI with pass/warn/fail checklist
- Human-readable compare summary: "Run B scored 15% higher. Correctness improved from 0.60 to 0.90. Instruction changes: CLAUDE.md." replaces bare "Winner: Run B"
- `generateSummary()` exported from compare module for programmatic access

### Changed

- Compare console output shows percentage change, best-improving dimension, and instruction file changes
- Compare markdown output includes the summary as a bold line

## [0.5.6] - 2026-04-03

### Added

- `lint --explain` flag: shows inline rule explanations (What it checks, Why it matters, How to fix) for every triggered diagnostic
- Rule explanations map in `src/lint/explanations.ts` covering all 24 lint rules
- Rich harvest dry-run table: shows commit hash, detected tool, confidence score, and truncated message instead of bare task names
- `CommitSummary` type and `commitSummaries` field in HarvestResult for dry-run metadata
- Actionable suggestions on live review rubrics: each rubric prints what to do when score is low
  - Scope: "Consider splitting into focused commits"
  - Tests: "Add tests for the files you changed"
  - Hygiene: "Remove console.log/debugger statements before committing"
- `suggestion` field on `RubricResult` type

## [0.5.5] - 2026-04-03

### Added

- `agenteval init` command: creates starter agenteval.yaml with commented config and next steps
- Task loader validates filename-like references (catches typos like `--task my-taask.yaml` instead of silently creating ad-hoc tasks)
- Top-level error handler in CLI: unexpected errors show clean message instead of stack trace

### Changed

- Compare: "Run not found" error now suggests `agenteval results` to list available runs
- Lint: "No instruction files found" now shows which globs were checked and suggests creating CLAUDE.md
- Harness registry: "Unknown harness" error shows built-in list and YAML config example
- Git errors: "Failed to read git history" adds context about repo state
- Worktree errors: explains possible causes (disabled worktrees, conflicting changes)
- Config loader: debug log when using defaults, suggests `agenteval init`

## [0.5.4] - 2026-04-03

### Changed

- Lint output: message-first layout with rule ID as dim parenthetical, branded "agenteval lint" header with stats
- Harvest: branded headers, detection rate percentage (e.g., "37 AI-assisted (97%)"), task lists capped at 10 with "... and N more"
- Live review: branded "agenteval review" header, clean empty state message
- Run: branded header, task name shown, score displays with /1.0 suffix
- Compare: branded header, run IDs highlighted in cyan
- Fixed: `--live` no longer shows "Scanning git history" progress message

## [0.5.3] - 2026-04-03

### Added

- New `src/output/terminal.ts` shared formatting helpers: `stripAnsi`, ANSI-safe `padEnd`, `header`, `rule`, `kvLine`, `scoreColor`
- Lint diagnostics grouped by file with tree-line prefix for visual structure
- Box-drawing tables for live review, compare, and results commands
- Separator row before "Overall" in comparison tables

### Changed

- All CLI output uses consistent visual language: same headers, indent levels, box characters
- ANSI-safe column alignment throughout (fixes chalk-colored strings breaking padEnd)
- Harvest dry-run uses key-value layout with counts in parentheses
- Results listing rendered as proper box-drawing table

## [0.5.2] - 2026-04-03

### Added

- Actionable fix suggestions on every lint diagnostic (e.g., "Remove filler phrases", "Fix the link target or remove the link")
- Summary guidance after lint output: fix errors first, address warnings, or all-clear confirmation
- Colorized CLI output across all commands using chalk:
  - Lint: suggestions rendered dim with arrow prefix
  - Harvest: bold headers, colored counts, progress indicator ("Scanning git history...")
  - Live review: scores color-coded green/yellow/red by value
  - Compare: green/red for winner/loser indicators and deltas, colored instruction diff status
  - Run: green for success, red for failure, scores colored by value
  - Results: status and scores colored by outcome
  - Logger: colored prefixes for warn/error/debug

### Changed

- `Diagnostic` type now includes optional `suggestion` field
- All 24 lint rules emit suggestions on their diagnostics
- ConsoleFormatter refactored with extracted helper functions for diagnostics and guidance

## [0.5.1] - 2026-04-03

### Added

- New `docs/concepts.md` guide explaining the 5 core concepts (instruction files, tasks, assertions, harnesses, scoring) in plain English with workflow diagram

### Changed

- README rewritten as a landing page: workflow diagram, "Quick Start" section, single command table. Moved reference tables (lint rules, harness adapters, task YAML, config) to docs/.
- All docs restructured beginner-first: usage examples before reference material, "Advanced" sections for internals
- `docs/harvest.md`: added "When to Use Each Mode" section, moved detection algorithms to Advanced
- `docs/run.md`: moved practical workflow up, added Reference heading before scoring formulas
- `docs/lint.md`: added Quick Overview with category table, Rules Reference heading before 24-rule encyclopedia
- `docs/configuration.md`: added note before Complete Configuration ("you don't need most of these options")
- `docs/getting-started.md`: linked concepts.md, added "No AI commits yet?" path, defined jargon inline (worktree, harness, assertions)

## [0.5.0] - 2026-04-03

"Close the Loop". Harvest metadata flows through to comparison and scoring.

### Added

- **Snapshot-aware comparison**: `agenteval compare` now shows instruction file diffs (added/removed/changed/unchanged) when both runs have instruction snapshots. Console and markdown output include an "Instruction Changes" section.
- **Confidence-weighted scoring**: new `confidenceAdjustedOverall` field in results. Harvested tasks with low detection confidence (0.6) score proportionally less than high-confidence ones (0.9). Raw overall score unchanged.
- **Test-pass assertion inference**: harvest now auto-adds `test-pass` assertions when the commit diff includes test files. Test command detected from package.json (`bun test` / `npm test` fallback).
- **Configurable rubric thresholds**: `liveReview.rubrics` config section in agenteval.yaml with per-rubric `enabled` and `weight` settings. Weighted average scoring.
- **LLM-assisted rubrics** (`--analyze` flag, requires `--live`): two new rubrics that send diff + instruction files to Claude for evaluation:
  - `convention-compliance` — "does this diff follow the conventions in CLAUDE.md?" (0-10)
  - `progressive-disclosure` — "are changes appropriately scoped and layered?" (0-10)
  - JSON response parsing with graceful fallback for varied LLM output formats
- Harvest metadata (sourceCommit, instructionSnapshot, prUrl, detectionConfidence) now stored in run results and available for comparison

### Changed

- `StoredResult` includes optional harvest metadata fields
- `ResultScores` includes optional `confidenceAdjustedOverall`
- `selectAndScoreRubrics()` extracted as async pure function for testability
- `emitTaskYaml()` accepts optional `repoPath` for test command detection
- Compare engine imports `diffInstructionSnapshots` from harvest module

## [0.4.0] - 2026-04-03

Phase 3.1 "The Observatory". Instruction snapshots, live review, GitHub enrichment.

### Added

- **Instruction snapshotter**: every harvested task now captures the CLAUDE.md/AGENTS.md content that was in effect at the commit, stored inline as `instructionSnapshot` in the task YAML. Enables A/B comparison of instruction quality across commits.
- **Live review mode** (`harvest --live`): analyze your current working tree diff against three heuristic rubrics:
  - `scope-discipline` — measures change concentration across directories (0-10)
  - `test-coverage` — ratio of test files to implementation files (0-10)
  - `diff-hygiene` — detects console.log, debugger, formatting-only hunks (0-10)
- **GitHub API enrichment** (`harvest --github`): optional flag enriches harvested tasks with PR body, URL, and labels via `gh` CLI. Terse commit messages get PR context appended to the task prompt. Zero new npm dependencies.
- Extended `TaskDefinition` with optional fields: `sourceCommit`, `instructionSnapshot`, `prUrl`, `prBody`, `detectionConfidence`, `harvestDate`
- `AICommit` now includes `detectedTool` field (e.g. "claude", "copilot", "cursor")
- `detectSignals()` returns the matched tool name alongside method and confidence
- Expanded AI tool detection to 14 tools (added Amazon Q, Gemini/Jules, Codeium/Windsurf, Tabnine, Sourcegraph Cody, Codex CLI, Sweep, Grit.io, Continue.dev)
- Broadened message pattern detection for `auto-generated`, `ai-generated`, and co-author mentions of copilot/cursor/gemini/codex
- Documentation quality gate: minor releases must ship with docs/ updates

### Changed

- `emitTaskYaml()` accepts optional metadata parameter for snapshots and PR info
- `harvest()` now loads config to resolve `instructionGlobs` for snapshot capture
- `RawCommit` type exported from `types.ts` (previously internal to `detect.ts`)
- `HarvestResult` includes optional `liveReview` field for live mode results

## [0.3.2] - 2026-04-01

### Fixed

- File rename handling in harvest diff stats: `{old => new}/file.ts` and `old => new` patterns now correctly extract the destination path
- Malformed co-author trailers now emit a warning instead of being silently dropped
- NaN `--min-confidence` validation (already shipped in v0.3.0 but untested for the warning path)

### Changed

- Removed `format` field from `HarvestOptions` type (presentation concern, only used at CLI level)
- Extracted `parseNumstat()` as a testable function for diff stat parsing

### Added

- 6 new tests: `parseNumstat` rename handling (4), malformed trailer warning (1), `noreply@github.com` false positive (already existed but verified)

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
