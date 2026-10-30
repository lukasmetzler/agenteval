import { z } from "zod";

/**
 * Context windows (input tokens) for budget checks, from each vendor's model
 * pages: Claude API model table (2026-10-06), OpenAI models (2026-10-30, max
 * input tokens), Gemini API models (2026-10-28). Unknown models fall back to
 * 200k with a lint note.
 */
export const ModelContextWindows: Record<string, number> = {
	// Anthropic — current
	"claude-fable-5-1": 1_000_000,
	"claude-fable-5": 1_000_000,
	"claude-opus-5-5": 1_000_000,
	"claude-opus-5": 1_000_000,
	"claude-sonnet-5-5": 1_000_000,
	"claude-sonnet-5": 1_000_000,
	"claude-haiku-5-5": 1_000_000,
	// Anthropic — previous generation, still served
	"claude-opus-4-8": 1_000_000,
	"claude-opus-4-7": 1_000_000,
	"claude-opus-4-6": 1_000_000,
	"claude-sonnet-4-6": 1_000_000,
	"claude-haiku-4-5": 200_000,
	// Claude Code model aliases (track the current model of each tier)
	fable: 1_000_000,
	opus: 1_000_000,
	sonnet: 1_000_000,
	haiku: 1_000_000,
	// OpenAI — GPT-6 flagships
	"gpt-6-astra": 922_000,
	"gpt-6.1-sol": 922_000,
	"gpt-6.1-terra": 922_000,
	"gpt-6-luna": 922_000,
	// Google — Gemini
	"gemini-4-argon": 1_048_576,
	"gemini-3.8-flash": 1_048_576,
	"gemini-3.1-pro-preview": 1_048_576,
	"gemini-2.5-pro": 1_048_576,
};

/**
 * Every instruction, rule, skill, and agent file format agenteval understands.
 * See docs/research/2026-10-30-agent-ecosystem.md for the per-agent sources.
 */
export const DEFAULT_INSTRUCTION_GLOBS = [
	"**/CLAUDE.md",
	"CLAUDE.local.md",
	"**/AGENTS.md",
	"**/GEMINI.md",
	".claude/**/*.md",
	".agents/skills/**/*.md",
	".github/copilot-instructions.md",
	".github/instructions/**/*.instructions.md",
	".cursor/rules/**/*.{md,mdc}",
	".devin/rules/*.md",
	".windsurf/rules/*.md",
	".kiro/steering/*.md",
	".junie/**/*.md",
] as const;

/** Built-in agent harnesses (src/harness/builtin.ts) plus the windsurf alias for devin. */
export const BUILTIN_HARNESSES = [
	"claude-code",
	"codex",
	"gemini",
	"antigravity",
	"copilot",
	"cursor",
	"opencode",
	"devin",
	"amp",
	"windsurf",
] as const;

const HarnessNameSchema = z
	.string()
	.describe(`One of ${BUILTIN_HARNESSES.join(", ")}, or a key of harnesses`);

const InstructionSourceSchema = z.object({
	path: z.string().describe("Path to instruction file"),
	harness: HarnessNameSchema.optional().describe("Harness to use for this instruction file"),
});

export type InstructionSource = z.infer<typeof InstructionSourceSchema>;

const RunConfigSchema = z.object({
	timeout: z.number().min(1).default(300).describe("Seconds before killing the agent"),
	tokensBudget: z
		.number()
		.default(50_000)
		.describe("Token count that scores 0 on efficiency (prompt-cache reads are not counted)"),
	resultsDir: z
		.string()
		.default(".agenteval/results")
		.describe("Directory for storing eval results"),
	worktreesDir: z
		.string()
		.default(".agenteval/worktrees")
		.describe("Directory for temporary git worktrees"),
	staleWorktreeMaxAge: z
		.number()
		.default(3_600_000)
		.describe("Milliseconds after which leftover worktrees are cleaned up"),
	resultRetention: z
		.string()
		.regex(/^\d+d$/, 'Use a number of days like "90d"')
		.default("90d")
		.describe("How long to keep results, in days (e.g. 90d)"),
});

const HarnessConfigSchema = z.object({
	command: z.string().describe("CLI command to run"),
	args: z.array(z.string()).default([]).describe("Arguments passed to the command"),
	instructionPath: z
		.string()
		.optional()
		.describe("Where to place instruction files in the worktree"),
});

const HarvestConfigSchema = z.object({
	outputDir: z
		.string()
		.default("tasks/harvested")
		.describe("Directory for generated task YAML files"),
	minConfidence: z
		.number()
		.min(0)
		.max(1)
		.default(0.5)
		.describe("Minimum confidence to include an AI commit (0.0-1.0)"),
	defaultHarness: HarnessNameSchema.default("auto").describe("Default harness for harvested tasks"),
	defaultTimeout: z
		.number()
		.min(1)
		.default(300)
		.describe("Default timeout for harvested tasks (seconds)"),
});

const RubricConfigSchema = z.object({
	enabled: z.boolean().default(true).describe("Enable or disable this rubric"),
	weight: z.number().min(0).default(1.0).describe("Weight multiplier for this rubric's score"),
});

const defaultRubric = RubricConfigSchema.parse({});

const RubricsSchema = z.object({
	scopeDiscipline: RubricConfigSchema.default(defaultRubric),
	testCoverage: RubricConfigSchema.default(defaultRubric),
	diffHygiene: RubricConfigSchema.default(defaultRubric),
	lintDelta: RubricConfigSchema.default(defaultRubric).describe(
		"Run the repo's detected linters and type checker on changed lines",
	),
	conventionCompliance: RubricConfigSchema.default(defaultRubric),
	progressiveDisclosure: RubricConfigSchema.default(defaultRubric),
});

const LiveReviewConfigSchema = z.object({
	judgeModel: z
		.string()
		.default("sonnet")
		.describe("Model for the LLM-judged rubrics (--analyze); a Claude Code alias or full model id"),
	rubrics: RubricsSchema.default(RubricsSchema.parse({})).describe(
		"Configure which rubrics are enabled and their weights",
	),
});

export type LiveReviewConfig = z.infer<typeof LiveReviewConfigSchema>;

const CIConfigSchema = z.object({
	tasksDir: z.string().default("tasks/harvested").describe("Directory with task YAML files"),
	minScore: z
		.number()
		.min(0)
		.max(1)
		.default(0.5)
		.describe("Minimum acceptable overall score (0.0-1.0)"),
	maxRegression: z
		.number()
		.min(0)
		.max(1)
		.default(0.1)
		.describe("Max allowed score drop vs previous run (0.0-1.0)"),
	instructions: z.string().default("CLAUDE.md").describe("Instruction file to evaluate"),
});

export type CIConfig = z.infer<typeof CIConfigSchema>;

const LintConfigSchema = z.object({
	overlapThreshold: z
		.number()
		.min(0)
		.max(1)
		.default(0.3)
		.describe("Flag file pairs with similarity above this (0.0-1.0)"),
	bloatThreshold: z
		.number()
		.min(0)
		.max(1)
		.default(0.5)
		.describe("Flag files with density score below this (0.0-1.0)"),
	maxTokensPerFile: z
		.number()
		.default(8000)
		.describe("Warn if a single file exceeds this token count"),
	maxTotalTokens: z
		.number()
		.optional()
		.describe("Budget for tokens loaded at session start; overrides contextBudget"),
	antiPatterns: z
		.array(z.string())
		.default([])
		.describe("Custom regex patterns to flag in instruction files"),
	ignore: z
		.array(z.string())
		.default([])
		.describe(
			"Glob patterns of files to exclude from linting (node_modules, .git, dist, .agenteval are always excluded)",
		),
});

export const ConfigSchema = z.object({
	version: z.literal(1).describe("Config schema version. Must be 1."),
	instructionGlobs: z
		.array(z.string())
		.default([...DEFAULT_INSTRUCTION_GLOBS])
		.describe("Glob patterns for instruction, rule, skill, and agent files to analyze"),
	instructions: z
		.array(InstructionSourceSchema)
		.default([])
		.describe("Unused. Kept so older config files still parse."),
	model: z
		.string()
		.default("claude-opus-5-5")
		.describe("Target model for context budget calculations"),
	contextBudget: z
		.number()
		.min(0)
		.max(1)
		.default(0.3)
		.describe("Max fraction of context window your instructions should consume (0.0-1.0)"),
	lint: LintConfigSchema.default(LintConfigSchema.parse({})),
	run: RunConfigSchema.default(RunConfigSchema.parse({})),
	harvest: HarvestConfigSchema.default(HarvestConfigSchema.parse({})),
	harnesses: z
		.record(z.string(), HarnessConfigSchema)
		.default({})
		.describe("Custom harness definitions"),
	liveReview: LiveReviewConfigSchema.default(LiveReviewConfigSchema.parse({})),
	ci: CIConfigSchema.default(CIConfigSchema.parse({})),
});

/** JSON Schema for agenteval.yaml, generated from ConfigSchema (see scripts/gen-schema.ts). */
export function configJsonSchema(): Record<string, unknown> {
	const generated = z.toJSONSchema(ConfigSchema, { target: "draft-7", io: "input" });
	return {
		...generated,
		$id: "https://raw.githubusercontent.com/lukasmetzler/agenteval/main/schema.json",
		title: "agenteval configuration",
		description:
			"Configuration file for agenteval — lint, benchmark, and CI gate for AI coding instructions",
	};
}

export type Config = z.infer<typeof ConfigSchema>;

export const FALLBACK_CONTEXT_WINDOW = 200_000;

export function isKnownModel(model: string): boolean {
	return ModelContextWindows[model] !== undefined;
}

export function getModelContextWindow(model: string): number {
	return ModelContextWindows[model] ?? FALLBACK_CONTEXT_WINDOW;
}
