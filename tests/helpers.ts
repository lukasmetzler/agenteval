import type { Config } from "../src/config/schema.js";
import { countTokens } from "../src/lint/tokenCounter.js";
import type { LintContext, ParsedFile } from "../src/lint/types.js";
import { parseMarkdown } from "../src/markdown/parser.js";
import { extractSections, extractSuppressions } from "../src/markdown/sections.js";

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
	const tree = parseMarkdown(content);
	const sections = extractSections(tree, content);
	const tokens = countTokens(content);
	for (const section of sections) {
		section.tokens = countTokens(section.content);
	}
	return {
		path,
		content,
		tree,
		sections,
		suppressions: extractSuppressions(tree),
		tokens,
		frontmatter: content.startsWith("---") ? {} : null,
	};
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
