# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
