import { describe, expect, test } from "bun:test";
import { SkillValidatorRule } from "../../src/lint/skillValidator.js";
import { makeContext, makeParsedFile } from "../../tests/helpers.js";

describe("SkillValidatorRule", () => {
	const rule = new SkillValidatorRule();

	test("passes for valid skill frontmatter", async () => {
		const file = makeParsedFile(
			"---\nname: my-skill\ndescription: Processes PDF files and extracts text.\n---\n\n# Content",
			"SKILL.md",
		);
		const diags = await rule.run(makeContext([file]));
		expect(diags).toHaveLength(0);
	});

	test("flags name exceeding 64 characters", async () => {
		const longName = "a".repeat(65);
		const file = makeParsedFile(
			`---\nname: ${longName}\ndescription: A valid description.\n---\n\n# Content`,
			"SKILL.md",
		);
		const diags = await rule.run(makeContext([file]));
		expect(diags.some((d) => d.ruleId === "skill/name-too-long")).toBe(true);
	});

	test("flags name with uppercase characters", async () => {
		const file = makeParsedFile(
			"---\nname: MySkill\ndescription: A valid description.\n---\n\n# Content",
			"SKILL.md",
		);
		const diags = await rule.run(makeContext([file]));
		expect(diags.some((d) => d.ruleId === "skill/name-invalid-chars")).toBe(true);
	});

	test("flags name containing reserved word 'claude'", async () => {
		const file = makeParsedFile(
			"---\nname: claude-helper\ndescription: A valid description.\n---\n\n# Content",
			"SKILL.md",
		);
		const diags = await rule.run(makeContext([file]));
		expect(diags.some((d) => d.ruleId === "skill/name-reserved-word")).toBe(true);
	});

	test("flags name containing reserved word 'anthropic'", async () => {
		const file = makeParsedFile(
			"---\nname: anthropic-tool\ndescription: A valid description.\n---\n\n# Content",
			"SKILL.md",
		);
		const diags = await rule.run(makeContext([file]));
		expect(diags.some((d) => d.ruleId === "skill/name-reserved-word")).toBe(true);
	});

	test("flags missing description", async () => {
		const file = makeParsedFile("---\nname: my-skill\n---\n\n# Content", "SKILL.md");
		const diags = await rule.run(makeContext([file]));
		expect(diags.some((d) => d.ruleId === "skill/description-missing")).toBe(true);
	});

	test("flags first-person description", async () => {
		const file = makeParsedFile(
			"---\nname: my-skill\ndescription: I can help you process files.\n---\n\n# Content",
			"SKILL.md",
		);
		const diags = await rule.run(makeContext([file]));
		expect(diags.some((d) => d.ruleId === "skill/description-first-person")).toBe(true);
	});

	test("flags second-person description", async () => {
		const file = makeParsedFile(
			"---\nname: my-skill\ndescription: You can use this to process files.\n---\n\n# Content",
			"SKILL.md",
		);
		const diags = await rule.run(makeContext([file]));
		expect(diags.some((d) => d.ruleId === "skill/description-second-person")).toBe(true);
	});

	test("skips files without frontmatter", async () => {
		const file = makeParsedFile(
			"# Just a regular markdown file\n\nNo frontmatter here.",
			"SKILL.md",
		);
		const diags = await rule.run(makeContext([file]));
		expect(diags).toHaveLength(0);
	});

	test("flags body exceeding 500 lines", async () => {
		const body = Array.from({ length: 550 }, (_, i) => `Line ${i + 1}`).join("\n");
		const file = makeParsedFile(
			`---\nname: my-skill\ndescription: A test skill.\n---\n\n${body}`,
			"SKILL.md",
		);
		const diags = await rule.run(makeContext([file]));
		expect(diags.some((d) => d.ruleId === "skill/body-too-long")).toBe(true);
	});
});
