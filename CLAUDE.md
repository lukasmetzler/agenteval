# agenteval

A CLI tool that evaluates AI coding instruction quality. Built with Bun + TypeScript.

## Commands

```bash
bun install             # install dependencies
bun test                # run all tests (301 tests)
bun run dev -- lint     # lint instruction files
bun run dev -- run      # run eval (needs --task flag)
bun run dev -- results  # view stored results
bun run dev -- compare  # compare two runs
bun run dev -- harvest  # mine git history for eval datasets
bun run build           # compile to binary
bun run lint            # biome check
bun run typecheck       # tsc --noEmit
bun run check           # lint + typecheck + test (CI equivalent)
```

## Architecture

```
src/
├── lint/       # Static analysis rules (Phase 1)
├── run/        # Eval runner, worktree, scorer (Phase 2)
├── harness/    # Adapter pattern: claude-code, generic, mock (Phase 2)
├── store/      # Result persistence + comparison (Phase 2)
├── harvest/    # Git history mining: detect AI commits, emit task YAML (Phase 3)
├── config/     # Zod schema, YAML loader
├── markdown/   # Parser, section extractor, frontmatter
├── output/     # Console, JSON, markdown formatters
├── commands/   # CLI command handlers (lint, run, results, compare, harvest)
└── utils/      # Logger, glob, path helpers
```

The lint pipeline: config -> glob files -> parse markdown -> count tokens -> run rules -> format output.

The eval pipeline: load task -> create worktree -> inject instructions -> spawn agent -> capture diff -> score assertions -> store result.

The harvest pipeline: git log -> parse commits -> detect AI signals (14 tools, co-author/email/message) -> filter by confidence -> snapshot instructions -> emit TaskDefinition YAML.

The live review pipeline: git diff (working tree) -> run heuristic rubrics (scope-discipline, test-coverage, diff-hygiene) + optional LLM rubrics (convention-compliance, progressive-disclosure via --analyze) -> weighted score and report.

All lint rules implement the `LintRule` interface in `src/lint/types.ts`.
All harness adapters implement the `HarnessAdapter` interface in `src/harness/types.ts`.
Token counting uses js-tiktoken (cl100k_base), numbers are approximate (~estimated).

## Conventions

- Bun runtime, not Node
- Biome for formatting (tabs) and linting (recommended + strict cherry-picks)
- TypeScript strict mode
- Tests use Bun's built-in test runner with real fixture files (no mocking)
- Feature branches: `feat/<name>`, bug fixes: `fix/<name>`, maintenance: `chore/<name>`
- Squash-merge to main, tagged releases with semver
- VERSION file is single source of truth for version string
- CHANGELOG.md updated with every merge (Keep a Changelog format)
- Patch = internal/fix, Minor = new user-facing feature, no Major until v1.0
- Minor releases (new features) MUST include docs/ updates and README links — docs are a quality gate, not an afterthought

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming -> invoke office-hours
- Bugs, errors, "why is this broken", 500 errors -> invoke investigate
- Ship, deploy, push, create PR -> invoke ship
- QA, test the site, find bugs -> invoke qa
- Code review, check my diff -> invoke review
- Update docs after shipping -> invoke document-release
- Weekly retro -> invoke retro
- Design system, brand -> invoke design-consultation
- Visual audit, design polish -> invoke design-review
- Architecture review -> invoke plan-eng-review
