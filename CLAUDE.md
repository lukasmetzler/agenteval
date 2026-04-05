# agenteval

A CLI tool that evaluates AI coding instruction quality. Built with Bun + TypeScript.

## Commands

```bash
# Install (end users)
brew tap lukasmetzler/agenteval && brew install agenteval  # Homebrew
npm install -g agenteval-cli                                # npm
curl -fsSL https://raw.githubusercontent.com/lukasmetzler/agenteval/main/install.sh | bash  # curl

# Development
bun install             # install dependencies
bun test                # run all tests (417 tests)
bun run dev -- init     # create starter agenteval.yaml
bun run dev -- doctor   # environment health check
bun run dev -- lint     # lint instruction files
bun run dev -- run      # run eval (needs --task flag)
bun run dev -- results  # view stored results
bun run dev -- compare  # compare two runs
bun run dev -- harvest  # mine git history for eval datasets
bun run dev -- trends   # score history and trend analysis
bun run dev -- ci       # run all harvested tasks, fail on regression
bun run dev -- watch    # watch instruction files, re-lint on save
bun run dev -- update   # self-update to the latest release
bun run build           # compile to binary (current platform)
bun run build:linux     # cross-compile linux-x64
bun run build:darwin    # cross-compile darwin-arm64
bun run build:darwin-x64 # cross-compile darwin-x64
bun run lint            # biome check
bun run typecheck       # tsc --noEmit
bun run check           # lint + typecheck + test (CI equivalent)
```

## Architecture

```
src/
├── lint/       # Static analysis rules (Phase 1)
├── run/        # Eval runner, worktree, scorer (Phase 2)
├── harness/    # Adapter pattern: claude-code, cursor, opencode, windsurf, copilot, generic, mock
├── store/      # Result persistence + comparison (Phase 2)
├── harvest/    # Git history mining: detect AI commits, emit task YAML (Phase 3)
├── config/     # Zod schema, YAML loader
├── markdown/   # Parser, section extractor, frontmatter
├── output/     # Console, JSON, markdown formatters
├── commands/   # CLI command handlers (init, doctor, lint, run, results, compare, harvest, ci, trends, watch, update)
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
