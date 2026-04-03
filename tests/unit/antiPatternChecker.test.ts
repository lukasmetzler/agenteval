import { describe, expect, test } from "bun:test";
import { AntiPatternCheckerRule, BUILTIN_PATTERNS } from "../../src/lint/antiPatternChecker.js";
import type { LintContext } from "../../src/lint/types.js";
import { defaultConfig, makeParsedFile } from "../../tests/helpers.js";

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
		const file = makeParsedFile("# Instructions\n\nYou are an expert TypeScript developer.");
		const ctx: LintContext = { config: defaultConfig, files: [file], cwd: "/tmp" };
		const diags = await rule.run(ctx);
		expect(diags.some((d) => d.ruleId === "anti-pattern/role-play")).toBe(true);
	});

	test("detects vague instructions", async () => {
		const file = makeParsedFile("# Guidelines\n\nBe careful when writing database queries.");
		const ctx: LintContext = { config: defaultConfig, files: [file], cwd: "/tmp" };
		const diags = await rule.run(ctx);
		expect(diags.some((d) => d.ruleId === "anti-pattern/vague-instruction")).toBe(true);
	});

	test("detects TODO in instructions", async () => {
		const file = makeParsedFile("# Setup\n\nTODO: add the deployment instructions here.");
		const ctx: LintContext = { config: defaultConfig, files: [file], cwd: "/tmp" };
		const diags = await rule.run(ctx);
		expect(diags.some((d) => d.ruleId === "anti-pattern/todo-in-instructions")).toBe(true);
	});

	test("detects meta-instructions", async () => {
		const file = makeParsedFile("# Guide\n\nRead this carefully before making any changes.");
		const ctx: LintContext = { config: defaultConfig, files: [file], cwd: "/tmp" };
		const diags = await rule.run(ctx);
		expect(diags.some((d) => d.ruleId === "anti-pattern/meta-instruction")).toBe(true);
	});

	test("detects contradictory rules", async () => {
		const file = makeParsedFile(
			"# Style\n\nAlways use semicolons at the end of statements.\n\nNever use semicolons in your code.",
		);
		const ctx: LintContext = { config: defaultConfig, files: [file], cwd: "/tmp" };
		const diags = await rule.run(ctx);
		expect(diags.some((d) => d.ruleId === "anti-pattern/contradictory-rules")).toBe(true);
	});

	test("passes for clean instructions", async () => {
		const file = makeParsedFile(
			"# Code Style\n\nUse TypeScript strict mode. Prefer `const` over `let`. Use early returns.",
		);
		const ctx: LintContext = { config: defaultConfig, files: [file], cwd: "/tmp" };
		const diags = await rule.run(ctx);
		const errors = diags.filter((d) => d.severity === "error");
		expect(errors).toHaveLength(0);
	});

	test("supports custom regex patterns", async () => {
		const file = makeParsedFile("# Config\n\nUse the deprecated_function() for backwards compat.");
		const config: Config = {
			...defaultConfig,
			lint: { ...defaultConfig.lint, antiPatterns: ["deprecated_function"] },
		};
		const ctx: LintContext = { config, files: [file], cwd: "/tmp" };
		const diags = await rule.run(ctx);
		expect(diags.some((d) => d.ruleId === "anti-pattern/custom-0")).toBe(true);
	});

	test("does not flag anti-pattern inside code block", async () => {
		const file = makeParsedFile(
			"# Guide\n\n```python\n# make sure to initialize the config\nconfig.init()\n```\n\nInitialize config before use.",
		);
		const ctx: LintContext = { config: defaultConfig, files: [file], cwd: "/tmp" };
		const diags = await rule.run(ctx);
		expect(diags.some((d) => d.ruleId === "anti-pattern/vague-instruction")).toBe(false);
	});

	test("flags anti-pattern in prose (regression guard)", async () => {
		const file = makeParsedFile("# Guide\n\nMake sure to initialize the config before use.");
		const ctx: LintContext = { config: defaultConfig, files: [file], cwd: "/tmp" };
		const diags = await rule.run(ctx);
		expect(diags.some((d) => d.ruleId === "anti-pattern/vague-instruction")).toBe(true);
	});

	test("wall-of-text check excludes code block word count", async () => {
		const codeWords = "word ".repeat(510);
		const file = makeParsedFile(
			`# Title\n\n\`\`\`\n${codeWords}\n\`\`\`\n\nShort prose paragraph.`,
		);
		const ctx: LintContext = { config: defaultConfig, files: [file], cwd: "/tmp" };
		const diags = await rule.run(ctx);
		expect(diags.some((d) => d.ruleId === "anti-pattern/wall-of-text")).toBe(false);
	});

	test("detects wall of text", async () => {
		const wall = "word ".repeat(510);
		const file = makeParsedFile(`# Title\n\n${wall}`);
		const ctx: LintContext = { config: defaultConfig, files: [file], cwd: "/tmp" };
		const diags = await rule.run(ctx);
		expect(diags.some((d) => d.ruleId === "anti-pattern/wall-of-text")).toBe(true);
	});
});
