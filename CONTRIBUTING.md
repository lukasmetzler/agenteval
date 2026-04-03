# Contributing to agenteval

## Development Setup

```bash
git clone https://github.com/lukasmetzler/agenteval.git
cd agenteval
bun install
bun run check   # lint + typecheck + tests
```

## Project Structure

```
src/
  commands/   # CLI command handlers
  config/     # Zod schema, YAML loader
  harvest/    # Git history mining, live review, rubrics
  harness/    # AI tool adapters (Claude Code, generic, mock)
  lint/       # Static analysis rules
  output/     # Console, JSON, markdown formatters
  run/        # Eval runner, worktree, scorer
  store/      # Result persistence, comparison
  utils/      # Logger, glob, path helpers
tests/
  unit/       # Per-module unit tests
  integration/ # End-to-end tests
  fixtures/   # Test data
```

## Quality Gates

Every PR must pass `bun run check`:
- **Biome** lint and formatting (tabs, 100 char width)
- **TypeScript** strict mode typecheck
- **Bun test** -- all tests must pass

## Commit Conventions

- `feat:` -- new user-facing feature (bumps minor)
- `fix:` -- bug fix or UX improvement (bumps patch)
- `chore:` -- maintenance, deps, CI (no version bump)
- `docs:` -- documentation only (no version bump)
- `test:` -- tests only (no version bump)

## Adding a Command

1. Create `src/commands/<name>.ts` with `registerXCommand(program: Command)`
2. Register in `src/cli.ts`
3. Add tests in `tests/unit/<name>.test.ts`
4. Add docs in `docs/<name>.md`
5. Update README.md command table

## Adding a Lint Rule

1. Create rule class implementing `LintRule` in `src/lint/`
2. Register in `src/lint/index.ts` `ALL_RULES` array
3. Add explanation in `src/lint/explanations.ts`
4. Add tests in `tests/unit/`
5. Document in `docs/lint.md`

## Release Process

1. Update `VERSION` file
2. Update `CHANGELOG.md`
3. Update `package.json` version
4. Squash-merge to main
5. Tag with `git tag v<version>`
6. Push tag -- release workflow builds binaries automatically

## Code Style

- Bun runtime, not Node
- TypeScript strict mode
- Biome for formatting (tabs) and linting
- No `any`, no non-null assertions
- Import types with `import type`
- `.js` extension in imports
- Real fixture tests, no mocking
