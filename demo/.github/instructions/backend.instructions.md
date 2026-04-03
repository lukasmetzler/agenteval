# Backend Instructions

## API Design

REST endpoints must follow our OpenAPI spec. Every endpoint needs:
- Zod input validation
- Standardized error responses
- Rate limiting headers
- Request logging with correlation IDs

## Database

Use the query builder, not raw SQL. All queries must use parameterized inputs.
Migrations go in `src/db/migrations/` with timestamp prefixes.

## Performance

Cache database queries that don't change often. Use Redis for session storage.
Set reasonable timeouts on all external HTTP calls (default: 10s).
