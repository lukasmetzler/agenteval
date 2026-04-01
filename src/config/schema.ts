import { z } from "zod";

export const ModelContextWindows: Record<string, number> = {
	"claude-sonnet-4-20250514": 200_000,
	"claude-opus-4-20250514": 200_000,
	"claude-haiku-3-5-20241022": 200_000,
	"gpt-4o": 128_000,
	"gpt-4.1": 1_000_000,
	o3: 200_000,
	"gemini-2.5-pro": 1_000_000,
};

const InstructionSourceSchema = z.object({
	path: z.string(),
	harness: z.enum(["claude-code", "opencode", "copilot", "generic"]).optional(),
});

export type InstructionSource = z.infer<typeof InstructionSourceSchema>;

const LintConfigSchema = z.object({
	overlapThreshold: z.number().min(0).max(1).default(0.3),
	bloatThreshold: z.number().min(0).max(1).default(0.5),
	maxTokensPerFile: z.number().default(8000),
	maxTotalTokens: z.number().optional(),
	antiPatterns: z.array(z.string()).default([]),
	ignore: z.array(z.string()).default([]),
});

export const ConfigSchema = z.object({
	version: z.literal(1),
	instructionGlobs: z
		.array(z.string())
		.default([
			"CLAUDE.md",
			"AGENTS.md",
			".github/copilot-instructions.md",
			".claude/**/*.md",
			".github/instructions/*.md",
		]),
	instructions: z.array(InstructionSourceSchema).default([]),
	model: z.string().default("claude-sonnet-4-20250514"),
	contextBudget: z.number().min(0).max(1).default(0.3),
	lint: LintConfigSchema.default({}),
});

export type Config = z.infer<typeof ConfigSchema>;

export function getModelContextWindow(model: string): number {
	return ModelContextWindows[model] ?? 200_000;
}

/**
 * Known YAML frontmatter fields in AI coding instruction/skill files.
 * Used by the linter to parse and validate skill metadata.
 */
export const SkillFrontmatterFields = [
	"name",
	"version",
	"description",
	"preamble-tier",
	"allowed-tools",
	"hooks",
	"metadata",
] as const;
