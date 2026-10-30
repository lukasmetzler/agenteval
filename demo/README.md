# agenteval Demo

Sample instruction files for five of the formats agenteval understands: CLAUDE.md, AGENTS.md, Copilot repository and path instructions, and a Claude Code skill. The other formats (GEMINI.md, Cursor, Devin/Windsurf, Kiro, Junie, subagents, slash commands) are not covered here; see [Auto-Discovery](../docs/lint.md#auto-discovery) for the full list.

## Files included

```
demo/
  CLAUDE.md                                      # Claude Code instructions (intentional issues)
  AGENTS.md                                      # Generic agent instructions (overlaps with CLAUDE.md)
  .github/copilot-instructions.md                # GitHub Copilot instructions (meta + vague)
  .github/instructions/backend.instructions.md   # Scoped GitHub instructions
  .claude/skills/deploy/SKILL.md                 # Claude Code skill (name doesn't match its directory)
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

The demo files have intentional issues. The lint command above reports, among others:

| Issue | File | Rule |
|-------|------|------|
| Dead file references (`docs/schema.md`, `src/db/migrations/`) | CLAUDE.md | dead-ref/missing-file |
| Dead file reference (`src/db/migrations/`) | backend.instructions.md | dead-ref/missing-file |
| Filler phrase ("please make sure to") | CLAUDE.md | bloat/filler-phrases |
| Vague instructions ("make sure to", "Be careful") | CLAUDE.md, copilot-instructions.md | anti-pattern/vague-instruction |
| Meta-instruction ("Read this carefully") | copilot-instructions.md | anti-pattern/meta-instruction |
| Skill `name` differs from its directory (`deploy-to-production` in `deploy/`) | SKILL.md | skill/name-directory-mismatch |
| Skill description doesn't start with a trigger ("Use when...") | SKILL.md | skill/description-not-trigger |

Run from the repo root, the toolchain and drift rules also look at this repository's own `package.json` and git history, so you'll see `toolchain/undocumented` and `drift/stale-reference` findings too. AGENTS.md shares topics with CLAUDE.md but stays below the default overlap threshold (0.3), so no overlap warning fires.

These are the kinds of problems that waste your AI agent's context window or produce unpredictable behavior.
