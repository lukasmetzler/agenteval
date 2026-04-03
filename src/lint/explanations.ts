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
		what: "Warns when a skill description exceeds 250 characters.",
		why: "Descriptions longer than 250 characters are truncated in skill listings, potentially hiding important information.",
		fix: "Shorten the description to 250 characters or less for full visibility in listings.",
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
};
