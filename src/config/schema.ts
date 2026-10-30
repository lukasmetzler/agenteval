import { z } from "zod";

export const ModelContextWindows: Record<string, number> = {
	// Anthropic — Claude 4.5/4.6 family
	"claude-opus-4-6": 1_000_000,
	"claude-sonnet-4-6": 200_000,
	"claude-haiku-4-5": 200_000,
	// Anthropic — Claude 4.x (legacy)
	"claude-sonnet-4-20250514": 200_000,
	"claude-opus-4-20250514": 200_000,
	"claude-haiku-3-5-20241022": 200_000,
	// OpenAI — GPT-5.x family
	"gpt-5.4": 1_000_000,
	"gpt-5.3": 1_000_000,
	"gpt-5.3-codex": 1_000_000,
	// OpenAI — GPT-4.x (legacy)
	"gpt-4o": 128_000,
	"gpt-4.1": 1_000_000,
	o3: 200_000,
	// Google — Gemini family
	"gemini-3.1": 2_000_000,
	"gemini-2.5-pro": 1_000_000,
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
	tokensBudget: z.number().default(50_000).describe("Token budget passed to the agent"),
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
	resultRetention: z.string().default("90d").describe("How long to keep results (e.g. 90d, 1y)"),
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
		.describe("Explicit instruction file sources with harness mapping"),
	model: z
		.string()
		.default("claude-sonnet-4-6")
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

export function getModelContextWindow(model: string): number {
	return ModelContextWindows[model] ?? 200_000;
}
