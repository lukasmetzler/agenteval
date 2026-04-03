# agenteval Demo

Sample instruction files covering every format agenteval understands.

## Files included

```
demo/
  CLAUDE.md                                      # Claude Code instructions (intentional issues)
  AGENTS.md                                      # Generic agent instructions (overlaps with CLAUDE.md)
  .github/copilot-instructions.md                # GitHub Copilot instructions (meta + vague)
  .github/instructions/backend.instructions.md   # Scoped GitHub instructions
  .claude/skills/deploy/SKILL.md                 # Anthropic skill file (first-person description)
  agenteval.yaml                                 # Config pointing at all demo files
```

## Try it

From the repo root:

```bash
# Lint all demo instruction files
bun run dev -- lint -c demo/agenteval.yaml

# Same, with full rule explanations
bun run dev -- lint -c demo/agenteval.yaml --explain

# Check your environment
bun run dev -- doctor

# Preview AI commits in this repo
bun run dev -- harvest --dry-run
```

## What you'll see

The demo files have intentional issues:

| Issue | File | Rule |
|-------|------|------|
| Dead file reference (`docs/schema.md`) | CLAUDE.md | dead-ref/missing-file |
| Dead file reference (`openapi.yaml`) | CLAUDE.md | dead-ref/missing-file |
| Filler phrases ("make sure to") | CLAUDE.md | bloat/filler-phrases |
| Vague instruction ("Be careful") | copilot-instructions.md | anti-pattern/vague-instruction |
| Meta-instruction ("Read this carefully") | copilot-instructions.md | anti-pattern/meta-instruction |
| Content overlap (language, testing) | CLAUDE.md + AGENTS.md | overlap/high-similarity |
| First-person skill description | SKILL.md | skill/description-first-person |

These are the kinds of problems that waste your AI agent's context window or produce unpredictable behavior.
