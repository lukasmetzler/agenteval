export interface RuleExplanation {
	what: string;
	why: string;
	fix: string;
}

export const RULE_EXPLANATIONS: Record<string, RuleExplanation> = {
	"lint/no-files": {
		what: "Checks that at least one instruction file was found matching the configured globs.",
		why: "Without instruction files, agenteval cannot evaluate or improve your AI coding setup.",
		fix: "Create a CLAUDE.md in your project root or update instructionGlobs in agenteval.yaml.",
	},
	"token-count/file-too-large": {
		what: "Checks if a single instruction file exceeds the configured token limit.",
		why: "Large files consume too much of the AI agent's context window, leaving less room for code and conversation.",
		fix: "Split into multiple files or remove low-value sections.",
	},
	"token-count/section-heavy": {
		what: "Flags sections that dominate the file's token budget.",
		why: "One oversized section crowds out other instructions the agent needs.",
		fix: "Break into subsections or move detail to a linked document.",
	},
	"overlap/high-similarity": {
		what: "Detects content duplication across instruction files.",
		why: "Duplicated instructions waste context tokens and can cause contradictions when one copy is updated but not the other.",
		fix: "Consolidate into one file or extract shared content into a common include.",
	},
	"bloat/low-density": {
		what: "Measures the information density of each section.",
		why: "Low-density text (filler phrases, hedging, repetition) wastes tokens without helping the agent.",
		fix: "Rewrite concisely. Remove filler phrases like 'make sure to' and 'it is important that'.",
	},
	"bloat/filler-phrases": {
		what: "Counts common filler phrases in each section.",
		why: "Filler phrases dilute instructions without adding value.",
		fix: "Delete the filler and state the instruction directly.",
	},
	"anti-pattern/vague-instruction": {
		what: "Finds instructions that lack specifics.",
		why: "Vague instructions like 'be careful' give the agent no actionable guidance.",
		fix: "Replace with a concrete rule, threshold, or example.",
	},
	"anti-pattern/role-play": {
		what: "Flags 'You are an expert...' preambles.",
		why: "Role-play prompts waste tokens. The model already knows how to code.",
		fix: "Remove the preamble and state what you want directly.",
	},
	"anti-pattern/todo-in-instructions": {
		what: "Flags TODO/FIXME left in instruction files.",
		why: "Draft artifacts confuse the agent about what's a real instruction.",
		fix: "Complete the TODO or remove it.",
	},
	"anti-pattern/meta-instruction": {
		what: "Flags 'Read this carefully' type instructions.",
		why: "Meta-instructions about how to read instructions waste tokens.",
		fix: "Delete — the model processes all instructions by default.",
	},
	"anti-pattern/redundant-with-default": {
		what: "Flags instructions that restate default model behavior.",
		why: "Restating defaults wastes tokens without changing behavior.",
		fix: "Remove unless you have evidence the model ignores this without the instruction.",
	},
	"anti-pattern/time-sensitive": {
		what: "Flags date-bound references that will become outdated.",
		why: "Stale dates make instructions unreliable over time.",
		fix: "Use relative references or remove the date.",
	},
	"anti-pattern/contradictory-rules": {
		what: "Detects 'always X' paired with 'never X'.",
		why: "Contradictions confuse the agent and produce unpredictable behavior.",
		fix: "Remove one of the conflicting rules.",
	},
	"anti-pattern/wall-of-text": {
		what: "Flags paragraphs over 500 words.",
		why: "Walls of text are hard for agents to parse for specific instructions.",
		fix: "Break into sections with headers and bullet points.",
	},
	"dead-ref/missing-file": {
		what: "Checks that file paths referenced in instructions actually exist.",
		why: "References to missing files mislead the agent about the codebase.",
		fix: "Remove the reference or create the missing file.",
	},
	"dead-ref/broken-link": {
		what: "Checks that markdown links point to valid targets.",
		why: "Broken links signal unmaintained instructions.",
		fix: "Fix the link target or remove the link.",
	},
	"dead-ref/broken-anchor": {
		what: "Checks that heading anchors (#section-name) point to actual headings.",
		why: "Broken heading links confuse readers and agents trying to navigate instructions.",
		fix: "Fix the anchor to match an existing heading, or add the missing heading.",
	},
	"dead-ref/undefined-reference": {
		what: "Checks that reference-style links [text][ref] have corresponding [ref]: url definitions.",
		why: "Undefined references render as literal text instead of links.",
		fix: "Add the missing reference definition or switch to inline link syntax.",
	},
	"context-budget/exceeded": {
		what: "Checks if total instruction tokens exceed the configured context budget.",
		why: "Instructions that exceed the budget leave insufficient room for the agent to work.",
		fix: "Remove low-value content or increase contextBudget in config.",
	},
	"context-budget/near-limit": {
		what: "Warns when instructions use >80% of the budget.",
		why: "Near-limit instructions leave little headroom for growth.",
		fix: "Consider trimming before adding more content.",
	},
	"skill/name-too-long": {
		what: "Validates Anthropic skill file metadata (name, description, body).",
		why: "Invalid skill metadata prevents the skill from being discovered and loaded.",
		fix: "Follow the Anthropic skill specification for frontmatter fields.",
	},
	"skill/name-invalid-chars": {
		what: "Validates Anthropic skill file metadata (name, description, body).",
		why: "Invalid skill metadata prevents the skill from being discovered and loaded.",
		fix: "Follow the Anthropic skill specification for frontmatter fields.",
	},
	"skill/name-reserved-word": {
		what: "Validates Anthropic skill file metadata (name, description, body).",
		why: "Invalid skill metadata prevents the skill from being discovered and loaded.",
		fix: "Follow the Anthropic skill specification for frontmatter fields.",
	},
	"skill/name-xml-tags": {
		what: "Validates Anthropic skill file metadata (name, description, body).",
		why: "Invalid skill metadata prevents the skill from being discovered and loaded.",
		fix: "Follow the Anthropic skill specification for frontmatter fields.",
	},
	"skill/description-missing": {
		what: "Validates Anthropic skill file metadata (name, description, body).",
		why: "Invalid skill metadata prevents the skill from being discovered and loaded.",
		fix: "Follow the Anthropic skill specification for frontmatter fields.",
	},
	"skill/description-too-long": {
		what: "Validates Anthropic skill file metadata (name, description, body).",
		why: "Invalid skill metadata prevents the skill from being discovered and loaded.",
		fix: "Follow the Anthropic skill specification for frontmatter fields.",
	},
	"skill/description-xml-tags": {
		what: "Validates Anthropic skill file metadata (name, description, body).",
		why: "Invalid skill metadata prevents the skill from being discovered and loaded.",
		fix: "Follow the Anthropic skill specification for frontmatter fields.",
	},
	"skill/description-first-person": {
		what: "Validates Anthropic skill file metadata (name, description, body).",
		why: "Invalid skill metadata prevents the skill from being discovered and loaded.",
		fix: "Follow the Anthropic skill specification for frontmatter fields.",
	},
	"skill/description-second-person": {
		what: "Validates Anthropic skill file metadata (name, description, body).",
		why: "Invalid skill metadata prevents the skill from being discovered and loaded.",
		fix: "Follow the Anthropic skill specification for frontmatter fields.",
	},
	"skill/body-too-long": {
		what: "Validates Anthropic skill file metadata (name, description, body).",
		why: "Invalid skill metadata prevents the skill from being discovered and loaded.",
		fix: "Follow the Anthropic skill specification for frontmatter fields.",
	},
	"skill/description-truncation": {
		what: "Notes skill descriptions over 250 characters.",
		why: "All skill descriptions are always loaded and share one budget (1% of the context window in Claude Code). When the budget runs out, the least-used descriptions are dropped, so long descriptions make other skills disappear. Hard truncation happens at 1536 characters (see skill/listing-truncated).",
		fix: "Keep the trigger conditions and cut identity the body already explains.",
	},
	"skill/unknown-field": {
		what: "Detects frontmatter fields not in the Anthropic skill specification.",
		why: "Unknown fields are likely typos or unsupported options that will be silently ignored.",
		fix: "Remove the unknown field or correct the spelling to match a valid field name.",
	},
	"skill/invalid-effort": {
		what: "Validates the effort field value against the Anthropic skill spec.",
		why: "Invalid effort values are ignored, so the skill won't get the intended compute allocation.",
		fix: "Set effort to one of: low, medium, high, max.",
	},
	"skill/invalid-context": {
		what: "Validates the context field value against the Anthropic skill spec.",
		why: "Invalid context values are ignored, so the skill won't run in the intended execution context.",
		fix: "Set context to 'fork' or remove the field.",
	},
	"skill/invalid-shell": {
		what: "Validates the shell field value against the Anthropic skill spec.",
		why: "Invalid shell values may cause the skill to fail at runtime.",
		fix: "Set shell to 'bash' or 'powershell'.",
	},
	"skill/unreachable": {
		what: "Detects skills that cannot be triggered by any means.",
		why: "A skill with both disable-model-invocation: true and user-invocable: false can never be invoked.",
		fix: "Set at least one of disable-model-invocation to false or user-invocable to true.",
	},
	"skill/description-not-trigger": {
		what: "Checks that the skill description starts with trigger conditions like 'Use when...'.",
		why: "Claude uses the description to decide WHEN to invoke a skill. If it contains workflow details instead of triggers, Claude skips reading the body.",
		fix: "Rewrite the description as 'Use when [specific triggering condition]'.",
	},
	"skill/too-long-no-supporting-files": {
		what: "Flags long SKILL.md files (>300 lines) with no supporting .md files in the same directory.",
		why: "Heavy reference material in a single file makes the skill harder to maintain and parse. Extracting to supporting files keeps the main skill focused.",
		fix: "Move reference content, examples, or templates to separate .md files alongside SKILL.md.",
	},
	"skill/missing-overview-section": {
		what: "Checks that the skill body contains a '## Overview' section.",
		why: "The Overview section is the first thing Claude reads after the frontmatter. Without it, the skill lacks a clear statement of purpose.",
		fix: "Add a '## Overview' section after the frontmatter with 1-2 sentences explaining what this skill does.",
	},
	"drift/stale-reference": {
		what: "Checks if source files referenced in instructions have been modified more recently than the instructions themselves.",
		why: "Stale instructions that describe refactored code mislead the AI agent. It confidently follows outdated guidance.",
		fix: "Review the referenced file's changes and update the instructions to match the current code.",
	},
	"skill/first-person-body": {
		what: "Detects first-person language ('I will', 'I deploy') in the skill body.",
		why: "Skill bodies should use imperative or third-person voice. They describe what the agent should DO, not what 'I' do.",
		fix: "Rewrite 'I deploy...' as 'Deploy...' or 'The skill deploys...'.",
	},
	"skill/frontmatter-invalid": {
		what: "SKILL.md files without parseable YAML frontmatter.",
		why: "Agents load such a skill with empty metadata. With no name or description, nothing can trigger it.",
		fix: "Start the file with a --- block holding at least name and description.",
	},
	"skill/name-invalid-hyphens": {
		what: "Skill names that start or end with a hyphen or contain '--'.",
		why: "The Agent Skills spec forbids these, and clients that validate names reject the skill.",
		fix: "Use single hyphens between lowercase words, e.g. pdf-tools.",
	},
	"skill/name-directory-mismatch": {
		what: "Skill names that differ from the skill's directory name.",
		why: "The Agent Skills spec requires name to equal the parent directory. Clients that enforce it skip or reject the skill.",
		fix: "Rename the directory or the name field so they match.",
	},
	"skill/listing-truncated": {
		what: "Skills whose description plus when_to_use is over 1536 characters.",
		why: "Claude Code cuts the skill listing entry at 1536 characters, so trigger conditions past that point are never seen.",
		fix: "Move detail into the body and keep the trigger conditions first.",
	},
	"skill/compatibility-too-long": {
		what: "compatibility fields over 500 characters.",
		why: "The Agent Skills spec caps compatibility at 500 characters.",
		fix: "State only hard requirements (runtime, CLI, OS).",
	},
	"frontmatter/malformed": {
		what: "Rule, subagent, or command files whose frontmatter is not a YAML mapping.",
		why: "The agent ignores frontmatter it cannot parse, so globs, paths, or tool lists in it have no effect.",
		fix: "Fix the YAML: key: value pairs between --- lines.",
	},
	"frontmatter/missing-required": {
		what: "Subagent files without name or description.",
		why: "Claude Code needs both to list and delegate to a subagent.",
		fix: "Add name and description to the frontmatter.",
	},
	"frontmatter/invalid-value": {
		what: "Frontmatter fields with the wrong type or an unknown enum value.",
		why: "An invalid alwaysApply, trigger, inclusion, or excludeAgent value makes the agent fall back to its default, which is usually not what you meant.",
		fix: "Use one of the values the message lists.",
	},
	"frontmatter/unknown-field": {
		what: "Frontmatter keys the target agent doesn't document.",
		why: "Unknown keys are ignored. They are often typos, like glob instead of globs.",
		fix: "Rename the key to a documented field, or remove it.",
	},
	"frontmatter/never-applied": {
		what: "Rule files that can never activate.",
		why: "A Copilot instruction without applyTo, a Devin glob trigger without globs, or a Kiro fileMatch without fileMatchPattern is loaded nowhere.",
		fix: "Add the missing glob field or change the trigger mode.",
	},
	"import/missing": {
		what: "@path imports that point at a missing file.",
		why: "Claude Code and Gemini CLI silently skip missing imports, so the rules you meant to include never load.",
		fix: "Fix the path (relative to the importing file) or remove the import.",
	},
	"import/cycle": {
		what: "@path imports that lead back to a file already in the chain.",
		why: "Cycles waste the import depth budget and usually mean two files import each other by mistake.",
		fix: "Import shared content from one place only.",
	},
	"import/too-deep": {
		what: "@path imports more than 4 hops deep.",
		why: "Claude Code stops following imports after 4 hops, so deeper files never load.",
		fix: "Flatten the chain: import the deep file from a shallower one.",
	},
	"agent-limits/codex-size": {
		what: "AGENTS.md chains over 32 KiB.",
		why: "Codex concatenates AGENTS.md files from the repo root down and stops at project_doc_max_bytes (32 KiB). The rest is dropped without warning.",
		fix: "Move detail into nested AGENTS.md files or linked docs.",
	},
	"agent-limits/claude-lines": {
		what: "CLAUDE.md files over 200 lines.",
		why: "Claude Code recommends staying under 200 lines and warns above it. Long files cost context on every session.",
		fix: "Split topics into .claude/rules/ files (with paths: to scope them) or @imports.",
	},
	"agent-limits/claude-truncation": {
		what: "Nested CLAUDE.md files over 40,000 characters.",
		why: "Claude Code truncates lazily loaded files at 40k characters on 200K-context models.",
		fix: "Split the file or move reference material behind links.",
	},
	"agent-limits/cursor-md-ignored": {
		what: ".md files in .cursor/rules/.",
		why: "Cursor only reads .mdc files there, so this file has no effect.",
		fix: "Rename it to .mdc and add description/globs/alwaysApply frontmatter.",
	},
	"agent-limits/cursor-lines": {
		what: "Cursor rules over 500 lines.",
		why: "Cursor recommends keeping each rule under 500 lines.",
		fix: "Split the rule by topic or file pattern.",
	},
	"agent-limits/claude-ignores-agents-md": {
		what: "Repos with both CLAUDE.md and AGENTS.md where CLAUDE.md doesn't import AGENTS.md.",
		why: "Claude Code reads AGENTS.md only when there is no CLAUDE.md, so rules kept only in AGENTS.md never reach it.",
		fix: "Add @AGENTS.md to CLAUDE.md, or keep shared rules in one file.",
	},
	"toolchain/missing-script": {
		what: "Commands that run a package.json script that doesn't exist.",
		why: "The agent runs the command, it fails, and the agent improvises.",
		fix: "Use one of the scripts the message lists, or add the script.",
	},
	"toolchain/wrong-package-manager": {
		what: "npm/yarn/pnpm/bun commands that don't match the repo's lockfile.",
		why: "Installing with the wrong package manager creates a second lockfile and can resolve different versions.",
		fix: "Use the package manager the lockfile belongs to.",
	},
	"toolchain/absent-tool": {
		what: "Commands for a linter, formatter, or type checker the repo doesn't use.",
		why: "Instructions that say eslint in an oxlint repo make the agent run a tool that isn't configured, or install it.",
		fix: "Replace the command with the tool the message names.",
	},
	"toolchain/undocumented": {
		what: "Linters, type checkers, or test scripts no instruction file mentions.",
		why: "An agent that doesn't know how to check its work skips the check.",
		fix: "Add the command (usually the package.json script) to the commands section.",
	},
	"context-budget/unknown-model": {
		what: "Configs whose model isn't in agenteval's context-window table.",
		why: "The budget then assumes 200,000 tokens, which may be far off.",
		fix: "Use a known model id, or set lint.maxTotalTokens.",
	},
};
