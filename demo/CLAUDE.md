# Project Instructions

This is the main instruction file for our AI coding assistant.

## Language and Runtime

We use TypeScript with strict mode enabled. The runtime is Bun, not Node.
All imports must use explicit file extensions (.ts, .js).
Use tabs for indentation, not spaces.

## Architecture

The project follows a modular architecture with clear separation of concerns.
Each module lives in its own directory under `src/`. Shared utilities go in `src/utils/`.

When adding new features, create a new directory under `src/` with an `index.ts` barrel export.
Always add tests in the corresponding `tests/` directory.

## Testing

Tests use Bun's built-in test runner. Run `bun test` to execute the full suite.
Write tests for every new function. Use real fixture files -- do not mock file system operations.

Please make sure to always thoroughly test everything and ensure comprehensive coverage
of all edge cases in a robust manner to maintain quality.

## Database Schema

All database migrations live in `src/db/migrations/`. When changing the schema,
create a new migration file with a timestamp prefix. Never modify existing migrations.
The current schema is documented in `docs/schema.md`.

## API Guidelines

REST endpoints follow the OpenAPI spec in `openapi.yaml`. Every endpoint must have:
- Input validation via Zod schemas
- Error responses that match our standard error format
- Rate limiting headers
- Request logging with correlation IDs
- Authentication middleware (except public endpoints)
- Response compression for payloads over 1KB
- Cache-Control headers for GET requests
- CORS configuration matching the allowed origins list
- Content-Type negotiation for JSON and MessagePack
- Pagination via cursor-based tokens (not offset)
- ETags for conditional requests
- Request timeout of 30 seconds
- Circuit breaker patterns for downstream calls
- Retry logic with exponential backoff
- Health check endpoint at /health
- Graceful shutdown handling
- OpenTelemetry trace propagation

## Code Review

All PRs require at least one approval. The reviewer should check for:
- Correct TypeScript types (no `any`)
- Test coverage for new code
- No unused imports
- Consistent naming conventions

## Deployment

We deploy to production via GitHub Actions. The workflow is in `.github/workflows/deploy.yml`.
Staging deploys happen on every push to `main`. Production deploys require a manual approval step.
