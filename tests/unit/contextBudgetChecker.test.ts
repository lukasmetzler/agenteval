import { describe, expect, test } from "bun:test";
import type { Config } from "../../src/config/schema.js";
import { ContextBudgetCheckerRule } from "../../src/lint/contextBudgetChecker.js";
import type { LintContext, ParsedFile } from "../../src/lint/types.js";
import { parseMarkdown } from "../../src/markdown/parser.js";
import { extractSections } from "../../src/markdown/sections.js";

function makeFile(tokens: number): ParsedFile {
	return {
		path: "test.md",
		content: "",
		tree: parseMarkdown(""),
		sections: extractSections(parseMarkdown(""), ""),
		suppressions: [],
		tokens,
		frontmatter: null,
	};
}

function makeConfig(overrides?: Partial<Config>): Config {
	return {
		version: 1 as const,
		instructionGlobs: [],
		instructions: [],
		model: "claude-sonnet-4-6",
		contextBudget: 0.3,
		lint: {
			overlapThreshold: 0.3,
			bloatThreshold: 0.5,
			maxTokensPerFile: 8000,
			antiPatterns: [],
			ignore: [],
		},
		...overrides,
	};
}

describe("ContextBudgetCheckerRule", () => {
	const rule = new ContextBudgetCheckerRule();

	test("passes when under budget", async () => {
		const file = makeFile(1000);
		const config = makeConfig();
		const ctx: LintContext = { config, files: [file], cwd: "/tmp" };
		const diags = await rule.run(ctx);
		expect(diags).toHaveLength(0);
	});

	test("flags error when over budget", async () => {
		const file = makeFile(100_000);
		const config = makeConfig({ contextBudget: 0.3 });
		const ctx: LintContext = { config, files: [file], cwd: "/tmp" };
		const diags = await rule.run(ctx);
		expect(diags.some((d) => d.ruleId === "context-budget/exceeded")).toBe(true);
		expect(diags[0].severity).toBe("error");
	});

	test("flags warning when near limit (>80%)", async () => {
		const config = makeConfig({ contextBudget: 0.3 });
		const budget = Math.floor(200_000 * 0.3);
		const nearLimit = Math.floor(budget * 0.85);
		const file = makeFile(nearLimit);
		const ctx: LintContext = { config, files: [file], cwd: "/tmp" };
		const diags = await rule.run(ctx);
		expect(diags.some((d) => d.ruleId === "context-budget/near-limit")).toBe(true);
		expect(diags[0].severity).toBe("warning");
	});

	test("respects maxTotalTokens override", async () => {
		const file = makeFile(500);
		const config = makeConfig({
			lint: {
				overlapThreshold: 0.3,
				bloatThreshold: 0.5,
				maxTokensPerFile: 8000,
				maxTotalTokens: 400,
				antiPatterns: [],
				ignore: [],
			},
		});
		const ctx: LintContext = { config, files: [file], cwd: "/tmp" };
		const diags = await rule.run(ctx);
		expect(diags.some((d) => d.ruleId === "context-budget/exceeded")).toBe(true);
	});

	test("sums tokens across multiple files", async () => {
		const files = [makeFile(30_000), makeFile(30_000), makeFile(30_000)];
		const config = makeConfig({ contextBudget: 0.3 });
		const ctx: LintContext = { config, files, cwd: "/tmp" };
		const diags = await rule.run(ctx);
		expect(diags.some((d) => d.ruleId === "context-budget/exceeded")).toBe(true);
	});
});
