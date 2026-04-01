---
name: example-project
description: Well-structured instructions for a TypeScript API project.
---

# Project Instructions

## Code Style

Use TypeScript strict mode. Prefer `const` over `let`. Use early returns for cleaner control flow.

All functions must have explicit return types. No `any` types allowed.

## Commands

```bash
bun test           # run all tests
bun run build      # compile to dist/
bun run lint       # biome check
```

## Architecture

The API follows a layered architecture:
- `src/routes/` — HTTP route handlers
- `src/services/` — business logic
- `src/db/` — database access layer

## Testing

Every new function needs a unit test. Integration tests go in `tests/integration/`.
Use real database fixtures, no mocking.

## Git

Feature branches: `feat/<name>`. Bug fixes: `fix/<name>`.
Squash-merge to main. Update CHANGELOG.md with every merge.
