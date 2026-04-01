import { describe, expect, test } from "bun:test";
import type { Config } from "../../src/config/schema.js";
import { AntiPatternCheckerRule, BUILTIN_PATTERNS } from "../../src/lint/antiPatternChecker.js";
import { countTokens } from "../../src/lint/tokenCounter.js";
import type { LintContext, ParsedFile } from "../../src/lint/types.js";
import { parseMarkdown } from "../../src/markdown/parser.js";
import { extractSections, extractSuppressions } from "../../src/markdown/sections.js";

function makeFile(content: string): ParsedFile {
	const tree = parseMarkdown(content);
	return {
		path: "test.md",
		content,
		tree,
		sections: extractSections(tree, content),
		suppressions: extractSuppressions(tree),
		tokens: countTokens(content),
		frontmatter: null,
	};
}

const defaultConfig: Config = {
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
};

describe("BUILTIN_PATTERNS", () => {
	test("has the expected number of patterns", () => {
		expect(BUILTIN_PATTERNS.length).toBeGreaterThanOrEqual(6);
	});

	test("each pattern has required fields", () => {
		for (const p of BUILTIN_PATTERNS) {
			expect(p.id).toBeTruthy();
			expect(p.description).toBeTruthy();
			expect(p.pattern).toBeInstanceOf(RegExp);
			expect(["error", "warning", "info"]).toContain(p.severity);
		}
	});
});

describe("AntiPatternCheckerRule", () => {
	const rule = new AntiPatternCheckerRule();

	test("detects role-play preamble", async () => {
		const file = makeFile("# Instructions\n\nYou are an expert TypeScript developer.");
		const ctx: LintContext = { config: defaultConfig, files: [file], cwd: "/tmp" };
		const diags = await rule.run(ctx);
		expect(diags.some((d) => d.ruleId === "anti-pattern/role-play")).toBe(true);
	});

	test("detects vague instructions", async () => {
		const file = makeFile("# Guidelines\n\nBe careful when writing database queries.");
		const ctx: LintContext = { config: defaultConfig, files: [file], cwd: "/tmp" };
		const diags = await rule.run(ctx);
		expect(diags.some((d) => d.ruleId === "anti-pattern/vague-instruction")).toBe(true);
	});

	test("detects TODO in instructions", async () => {
		const file = makeFile("# Setup\n\nTODO: add the deployment instructions here.");
		const ctx: LintContext = { config: defaultConfig, files: [file], cwd: "/tmp" };
		const diags = await rule.run(ctx);
		expect(diags.some((d) => d.ruleId === "anti-pattern/todo-in-instructions")).toBe(true);
	});

	test("detects meta-instructions", async () => {
		const file = makeFile("# Guide\n\nRead this carefully before making any changes.");
		const ctx: LintContext = { config: defaultConfig, files: [file], cwd: "/tmp" };
		const diags = await rule.run(ctx);
		expect(diags.some((d) => d.ruleId === "anti-pattern/meta-instruction")).toBe(true);
	});

	test("detects contradictory rules", async () => {
		const file = makeFile(
			"# Style\n\nAlways use semicolons at the end of statements.\n\nNever use semicolons in your code.",
		);
		const ctx: LintContext = { config: defaultConfig, files: [file], cwd: "/tmp" };
		const diags = await rule.run(ctx);
		expect(diags.some((d) => d.ruleId === "anti-pattern/contradictory-rules")).toBe(true);
	});

	test("passes for clean instructions", async () => {
		const file = makeFile(
			"# Code Style\n\nUse TypeScript strict mode. Prefer `const` over `let`. Use early returns.",
		);
		const ctx: LintContext = { config: defaultConfig, files: [file], cwd: "/tmp" };
		const diags = await rule.run(ctx);
		const errors = diags.filter((d) => d.severity === "error");
		expect(errors).toHaveLength(0);
	});

	test("supports custom regex patterns", async () => {
		const file = makeFile("# Config\n\nUse the deprecated_function() for backwards compat.");
		const config: Config = {
			...defaultConfig,
			lint: { ...defaultConfig.lint, antiPatterns: ["deprecated_function"] },
		};
		const ctx: LintContext = { config, files: [file], cwd: "/tmp" };
		const diags = await rule.run(ctx);
		expect(diags.some((d) => d.ruleId === "anti-pattern/custom-0")).toBe(true);
	});

	test("detects wall of text", async () => {
		const wall = "word ".repeat(510);
		const file = makeFile(`# Title\n\n${wall}`);
		const ctx: LintContext = { config: defaultConfig, files: [file], cwd: "/tmp" };
		const diags = await rule.run(ctx);
		expect(diags.some((d) => d.ruleId === "anti-pattern/wall-of-text")).toBe(true);
	});
});
