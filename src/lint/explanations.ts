export interface RuleExplanation {
	what: string;
	why: string;
	fix: string;
}

export const RULE_EXPLANATIONS: Record<string, RuleExplanation> = {
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
};
