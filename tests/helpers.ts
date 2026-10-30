import type { Config } from "../src/config/schema.js";
import { parseInstructionFile } from "../src/lint/parse.js";
import type { LintContext, ParsedFile } from "../src/lint/types.js";

export const defaultConfig: Config = {
	version: 1 as const,
	instructionGlobs: [],
	instructions: [],
	model: "claude-sonnet-4-20250514",
	contextBudget: 0.3,
	lint: {
		overlapThreshold: 0.3,
		bloatThreshold: 0.5,
		maxTokensPerFile: 8000,
		antiPatterns: [],
		ignore: [],
	},
	run: {
		timeout: 300,
		tokensBudget: 50_000,
		resultsDir: ".agenteval/results",
		worktreesDir: ".agenteval/worktrees",
		staleWorktreeMaxAge: 3_600_000,
		resultRetention: "90d",
	},
	harnesses: {},
};

export function makeParsedFile(content: string, path = "test.md"): ParsedFile {
	return parseInstructionFile(path, content, "/tmp");
}

export function makeContext(files: ParsedFile[], configOverrides?: Partial<Config>): LintContext {
	return {
		config: { ...defaultConfig, ...configOverrides },
		files,
		cwd: "/tmp",
	};
}

export function makeContextWithLint(
	files: ParsedFile[],
	lintOverrides?: Partial<Config["lint"]>,
): LintContext {
	return {
		config: {
			...defaultConfig,
			lint: { ...defaultConfig.lint, ...lintOverrides },
		},
		files,
		cwd: "/tmp",
	};
}
