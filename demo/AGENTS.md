# Agent Instructions

## Language

We use TypeScript with strict mode. Runtime is Bun.
Use tabs for indentation.

## Testing

Run tests with `bun test`. Write tests for all new functions.
Do not mock the file system -- use real fixture files.

## Code Style

- No `any` types
- Explicit return types on public functions
- Prefer `const` over `let`
- Use early returns to reduce nesting
- Keep functions under 50 lines

## Pull Requests

Every PR needs one approval before merging.
Add tests for new code. No unused imports.
