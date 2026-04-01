# agenteval

A CLI tool that evaluates AI coding instruction quality. Built with Bun + TypeScript.

## Commands

```bash
bun install          # install dependencies
bun test             # run all tests
bun run dev -- lint  # run CLI in dev mode
bun run build        # compile to binary
bun run lint         # biome check
bun run typecheck    # tsc --noEmit
bun run check        # lint + typecheck + test (CI equivalent)
```

## Architecture

The linter pipeline: config → glob files → parse markdown → count tokens → run rules → format output.

All lint rules implement the `LintRule` interface in `src/lint/types.ts`.
Token counting uses js-tiktoken (cl100k_base) — numbers are approximate (~estimated).

## Conventions

- Bun runtime, not Node
- Biome for formatting (tabs) and linting (recommended + strict cherry-picks)
- TypeScript strict mode
- Tests use Bun's built-in test runner with real fixture files (no mocking)
- Feature branches: `feat/<name>`, bug fixes: `fix/<name>`
- Squash-merge to main, tagged releases with semver
- CHANGELOG.md updated with every merge

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
