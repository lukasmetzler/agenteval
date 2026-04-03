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

	test("flags description exceeding 250 chars with truncation warning", async () => {
		const longDesc = "a".repeat(300);
		const file = makeParsedFile(
			`---\nname: my-skill\ndescription: ${longDesc}\n---\n\n# Content`,
			"SKILL.md",
		);
		const diags = await rule.run(makeContext([file]));
		expect(diags.some((d) => d.ruleId === "skill/description-truncation")).toBe(true);
		const truncDiag = diags.find((d) => d.ruleId === "skill/description-truncation");
		expect(truncDiag?.severity).toBe("info");
	});

	test("does not flag description under 250 chars for truncation", async () => {
		const file = makeParsedFile(
			"---\nname: my-skill\ndescription: A short description.\n---\n\n# Content",
			"SKILL.md",
		);
		const diags = await rule.run(makeContext([file]));
		expect(diags.some((d) => d.ruleId === "skill/description-truncation")).toBe(false);
	});

	test("flags unknown frontmatter field", async () => {
		const file = makeParsedFile(
			"---\nname: my-skill\ndescription: A valid description.\nunknown-field: true\n---\n\n# Content",
			"SKILL.md",
		);
		const diags = await rule.run(makeContext([file]));
		expect(diags.some((d) => d.ruleId === "skill/unknown-field")).toBe(true);
		const unknownDiag = diags.find((d) => d.ruleId === "skill/unknown-field");
		expect(unknownDiag?.severity).toBe("warning");
		expect(unknownDiag?.message).toContain("unknown-field");
	});

	test("accepts valid effort value", async () => {
		const file = makeParsedFile(
			"---\nname: my-skill\ndescription: A valid description.\neffort: high\n---\n\n# Content",
			"SKILL.md",
		);
		const diags = await rule.run(makeContext([file]));
		expect(diags.some((d) => d.ruleId === "skill/invalid-effort")).toBe(false);
	});

	test("flags invalid effort value", async () => {
		const file = makeParsedFile(
			"---\nname: my-skill\ndescription: A valid description.\neffort: extreme\n---\n\n# Content",
			"SKILL.md",
		);
		const diags = await rule.run(makeContext([file]));
		expect(diags.some((d) => d.ruleId === "skill/invalid-effort")).toBe(true);
		const effortDiag = diags.find((d) => d.ruleId === "skill/invalid-effort");
		expect(effortDiag?.severity).toBe("error");
	});

	test("accepts valid context value", async () => {
		const file = makeParsedFile(
			"---\nname: my-skill\ndescription: A valid description.\ncontext: fork\n---\n\n# Content",
			"SKILL.md",
		);
		const diags = await rule.run(makeContext([file]));
		expect(diags.some((d) => d.ruleId === "skill/invalid-context")).toBe(false);
	});

	test("flags invalid context value", async () => {
		const file = makeParsedFile(
			"---\nname: my-skill\ndescription: A valid description.\ncontext: split\n---\n\n# Content",
			"SKILL.md",
		);
		const diags = await rule.run(makeContext([file]));
		expect(diags.some((d) => d.ruleId === "skill/invalid-context")).toBe(true);
		const ctxDiag = diags.find((d) => d.ruleId === "skill/invalid-context");
		expect(ctxDiag?.severity).toBe("error");
	});

	test("accepts valid shell value", async () => {
		const file = makeParsedFile(
			"---\nname: my-skill\ndescription: A valid description.\nshell: bash\n---\n\n# Content",
			"SKILL.md",
		);
		const diags = await rule.run(makeContext([file]));
		expect(diags.some((d) => d.ruleId === "skill/invalid-shell")).toBe(false);
	});

	test("flags invalid shell value", async () => {
		const file = makeParsedFile(
			"---\nname: my-skill\ndescription: A valid description.\nshell: fish\n---\n\n# Content",
			"SKILL.md",
		);
		const diags = await rule.run(makeContext([file]));
		expect(diags.some((d) => d.ruleId === "skill/invalid-shell")).toBe(true);
		const shellDiag = diags.find((d) => d.ruleId === "skill/invalid-shell");
		expect(shellDiag?.severity).toBe("error");
	});

	test("flags unreachable skill with both flags set", async () => {
		const file = makeParsedFile(
			"---\nname: my-skill\ndescription: A valid description.\ndisable-model-invocation: true\nuser-invocable: false\n---\n\n# Content",
			"SKILL.md",
		);
		const diags = await rule.run(makeContext([file]));
		expect(diags.some((d) => d.ruleId === "skill/unreachable")).toBe(true);
		const unreachDiag = diags.find((d) => d.ruleId === "skill/unreachable");
		expect(unreachDiag?.severity).toBe("warning");
	});

	test("does not flag reachable skill with only one flag set", async () => {
		const file = makeParsedFile(
			"---\nname: my-skill\ndescription: A valid description.\ndisable-model-invocation: true\n---\n\n# Content",
			"SKILL.md",
		);
		const diags = await rule.run(makeContext([file]));
		expect(diags.some((d) => d.ruleId === "skill/unreachable")).toBe(false);
	});
});
