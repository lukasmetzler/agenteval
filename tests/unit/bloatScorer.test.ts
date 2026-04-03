import { describe, expect, test } from "bun:test";
import { BloatScorerRule, scoreDensity } from "../../src/lint/bloatScorer.js";
import type { LintContext } from "../../src/lint/types.js";
import { defaultConfig, makeParsedFile } from "../../tests/helpers.js";

describe("scoreDensity", () => {
	test("dense technical text scores high", () => {
		const metrics = scoreDensity(
			"Use TypeScript strict mode. Prefer const declarations. Enable noImplicitAny. Configure eslint with recommended rules. Set target to ESNext.",
		);
		expect(metrics.overallScore).toBeGreaterThan(0.5);
	});

	test("filler-heavy text scores lower", () => {
		const metrics = scoreDensity(
			"It is important to note that you should please make sure to keep in mind that in order to write good code you need to follow best practices. It should be noted that as a general rule you should always be consistent.",
		);
		expect(metrics.fillerPhraseCount).toBeGreaterThan(0);
		expect(metrics.overallScore).toBeLessThan(0.7);
	});

	test("very short text returns score of 1", () => {
		const metrics = scoreDensity("Hello world.");
		expect(metrics.overallScore).toBe(1);
	});

	test("detects specific filler phrases", () => {
		const metrics = scoreDensity(
			"It is important to note that this feature works. Please make sure to test it. Keep in mind that edge cases exist.",
		);
		expect(metrics.fillerPhraseCount).toBe(3);
	});
});

describe("BloatScorerRule", () => {
	const rule = new BloatScorerRule();

	test("passes for clean, dense content", async () => {
		const file = makeParsedFile(
			"# Code Style\n\nUse TypeScript strict. Prefer const. Enable eslint. Target ESNext. No any types.",
		);
		const ctx: LintContext = { config: defaultConfig, files: [file], cwd: "/tmp" };
		const diags = await rule.run(ctx);
		const lowDensity = diags.filter((d) => d.ruleId === "bloat/low-density");
		expect(lowDensity).toHaveLength(0);
	});

	test("does not flag section that is mostly code", async () => {
		const file = makeParsedFile(
			"## Build\n\n```bash\nnpm install\nnpm test\nnpm run build\nnpm run lint\nnpm run typecheck\n```\n\nRun the build.",
		);
		const ctx: LintContext = { config: defaultConfig, files: [file], cwd: "/tmp" };
		const diags = await rule.run(ctx);
		const lowDensity = diags.filter((d) => d.ruleId === "bloat/low-density");
		expect(lowDensity).toHaveLength(0);
	});

	test("filler phrase inside code block is not counted", async () => {
		const file = makeParsedFile(
			"## Guide\n\n```python\n# it is important to note that this is a comment\nprint('hello')\n```\n\nUse TypeScript strict. Prefer const. Enable eslint.",
		);
		const ctx: LintContext = { config: defaultConfig, files: [file], cwd: "/tmp" };
		const diags = await rule.run(ctx);
		const fillerDiags = diags.filter((d) => d.ruleId === "bloat/filler-phrases");
		expect(fillerDiags).toHaveLength(0);
	});

	test("flags bloated sections", async () => {
		const bloatedContent = `# Instructions

It is important to note that please make sure to keep in mind that in order to write good code you should always follow best practices. It should be noted that as a general rule you need to be careful and it is important to note that the code should be clean and readable. In order to achieve this you should please make sure to follow the guidelines carefully. It is important to note that needless to say the code quality matters and it should be noted that you need to keep in mind that for the purpose of maintaining quality you should always be consistent.`;

		const file = makeParsedFile(bloatedContent);
		const ctx: LintContext = { config: defaultConfig, files: [file], cwd: "/tmp" };
		const diags = await rule.run(ctx);
		expect(diags.some((d) => d.ruleId === "bloat/filler-phrases")).toBe(true);
	});
});
