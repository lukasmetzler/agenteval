# agenteval Demo

Try agenteval on these sample instruction files. They contain intentional problems that agenteval will catch.

## Quick test

```bash
# From the repo root:
agenteval lint -c demo/agenteval.yaml
agenteval lint -c demo/agenteval.yaml --explain
agenteval harvest --dry-run
agenteval doctor
```

Or with bun:

```bash
bun run dev -- lint -c demo/agenteval.yaml
bun run dev -- lint -c demo/agenteval.yaml --explain
```

## What you'll see

The sample CLAUDE.md has intentional issues:

- A section that uses too many tokens (the API Guidelines section is bloated)
- A dead file reference (docs/schema.md, openapi.yaml do not exist)
- Filler phrases that waste context ("thoroughly test everything", "comprehensive coverage", "in a robust manner")
- Vague instructions mixed in with concrete ones

The sample AGENTS.md overlaps with CLAUDE.md on language, testing, and code review sections. agenteval flags this because duplicated instructions waste context budget and risk contradictions when one copy gets updated but the other does not.

These are the kinds of problems agenteval catches before they waste your AI agent's context window.
