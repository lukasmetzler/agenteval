import { describe, expect, test } from "bun:test";
import type { Config } from "../../src/config/schema.js";
import { SkillValidatorRule } from "../../src/lint/skillValidator.js";
import { countTokens } from "../../src/lint/tokenCounter.js";
import type { LintContext, ParsedFile } from "../../src/lint/types.js";
import { parseMarkdown } from "../../src/markdown/parser.js";
import { extractSections, extractSuppressions } from "../../src/markdown/sections.js";

function makeFile(content: string, path = "SKILL.md"): ParsedFile {
	const tree = parseMarkdown(content);
	const sections = extractSections(tree, content);
	const hasFrontmatter = content.startsWith("---");
	return {
		path,
		content,
		tree,
		sections,
		suppressions: extractSuppressions(tree),
		tokens: countTokens(content),
		frontmatter: hasFrontmatter ? {} : null,
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

function makeCtx(files: ParsedFile[]): LintContext {
	return { config: defaultConfig, files, cwd: "/tmp" };
}

describe("SkillValidatorRule", () => {
	const rule = new SkillValidatorRule();

	test("passes for valid skill frontmatter", async () => {
		const file = makeFile(
			"---\nname: my-skill\ndescription: Processes PDF files and extracts text.\n---\n\n# Content",
		);
		const diags = await rule.run(makeCtx([file]));
		expect(diags).toHaveLength(0);
	});

	test("flags name exceeding 64 characters", async () => {
		const longName = "a".repeat(65);
		const file = makeFile(
			`---\nname: ${longName}\ndescription: A valid description.\n---\n\n# Content`,
		);
		const diags = await rule.run(makeCtx([file]));
		expect(diags.some((d) => d.ruleId === "skill/name-too-long")).toBe(true);
	});

	test("flags name with uppercase characters", async () => {
		const file = makeFile(
			"---\nname: MySkill\ndescription: A valid description.\n---\n\n# Content",
		);
		const diags = await rule.run(makeCtx([file]));
		expect(diags.some((d) => d.ruleId === "skill/name-invalid-chars")).toBe(true);
	});

	test("flags name containing reserved word 'claude'", async () => {
		const file = makeFile(
			"---\nname: claude-helper\ndescription: A valid description.\n---\n\n# Content",
		);
		const diags = await rule.run(makeCtx([file]));
		expect(diags.some((d) => d.ruleId === "skill/name-reserved-word")).toBe(true);
	});

	test("flags name containing reserved word 'anthropic'", async () => {
		const file = makeFile(
			"---\nname: anthropic-tool\ndescription: A valid description.\n---\n\n# Content",
		);
		const diags = await rule.run(makeCtx([file]));
		expect(diags.some((d) => d.ruleId === "skill/name-reserved-word")).toBe(true);
	});

	test("flags missing description", async () => {
		const file = makeFile("---\nname: my-skill\n---\n\n# Content");
		const diags = await rule.run(makeCtx([file]));
		expect(diags.some((d) => d.ruleId === "skill/description-missing")).toBe(true);
	});

	test("flags first-person description", async () => {
		const file = makeFile(
			"---\nname: my-skill\ndescription: I can help you process files.\n---\n\n# Content",
		);
		const diags = await rule.run(makeCtx([file]));
		expect(diags.some((d) => d.ruleId === "skill/description-first-person")).toBe(true);
	});

	test("flags second-person description", async () => {
		const file = makeFile(
			"---\nname: my-skill\ndescription: You can use this to process files.\n---\n\n# Content",
		);
		const diags = await rule.run(makeCtx([file]));
		expect(diags.some((d) => d.ruleId === "skill/description-second-person")).toBe(true);
	});

	test("skips files without frontmatter", async () => {
		const file = makeFile("# Just a regular markdown file\n\nNo frontmatter here.");
		const diags = await rule.run(makeCtx([file]));
		expect(diags).toHaveLength(0);
	});

	test("flags body exceeding 500 lines", async () => {
		const body = Array.from({ length: 550 }, (_, i) => `Line ${i + 1}`).join("\n");
		const file = makeFile(`---\nname: my-skill\ndescription: A test skill.\n---\n\n${body}`);
		const diags = await rule.run(makeCtx([file]));
		expect(diags.some((d) => d.ruleId === "skill/body-too-long")).toBe(true);
	});
});
