import { describe, expect, test } from "bun:test";
import { FrontmatterValidatorRule } from "../../src/lint/frontmatterValidator.js";
import { makeContext, makeParsedFile } from "../../tests/helpers.js";

const rule = new FrontmatterValidatorRule();

async function ruleIds(content: string, path: string): Promise<string[]> {
	const diags = await rule.run(makeContext([makeParsedFile(content, path)]));
	return diags.map((d) => d.ruleId);
}

describe("FrontmatterValidatorRule", () => {
	test("accepts a valid Claude rule with paths", async () => {
		expect(
			await ruleIds("---\npaths:\n  - src/api/**\n---\n\n# API", ".claude/rules/api.md"),
		).toEqual([]);
	});

	test("accepts a Claude rule without frontmatter", async () => {
		expect(await ruleIds("# Always-on rule", ".claude/rules/style.md")).toEqual([]);
	});

	test("flags unknown fields on a Cursor rule", async () => {
		const ids = await ruleIds(
			"---\ndescription: TS rules\nglob: '*.ts'\n---\n\nUse strict.",
			".cursor/rules/ts.mdc",
		);
		expect(ids).toEqual(["frontmatter/unknown-field"]);
	});

	test("flags wrong type for alwaysApply", async () => {
		const ids = await ruleIds("---\nalwaysApply: yes please\n---\n\nx", ".cursor/rules/a.mdc");
		expect(ids).toEqual(["frontmatter/invalid-value"]);
	});

	test("warns when a Copilot path instruction has no applyTo", async () => {
		const ids = await ruleIds(
			"---\ndescription: TS\n---\n\nx",
			".github/instructions/ts.instructions.md",
		);
		expect(ids).toEqual(["frontmatter/never-applied"]);
	});

	test("rejects an invalid excludeAgent value", async () => {
		const ids = await ruleIds(
			'---\napplyTo: "**"\nexcludeAgent: coding-agent\n---\n\nx',
			".github/instructions/all.instructions.md",
		);
		expect(ids).toEqual(["frontmatter/invalid-value"]);
	});

	test("requires name and description on subagents", async () => {
		const ids = await ruleIds("---\ntools: Read, Grep\n---\n\nReview.", ".claude/agents/r.md");
		expect(ids.filter((id) => id === "frontmatter/missing-required")).toHaveLength(2);
	});

	test("rejects ':' in subagent name and more than 32 skills", async () => {
		const skills = Array.from({ length: 33 }, (_, i) => `  - s${i}`).join("\n");
		const ids = await ruleIds(
			`---\nname: a:b\ndescription: d\nskills:\n${skills}\n---\n\nx`,
			".claude/agents/a.md",
		);
		expect(ids).toEqual(["frontmatter/invalid-value", "frontmatter/invalid-value"]);
	});

	test("flags Kiro fileMatch without pattern", async () => {
		const ids = await ruleIds("---\ninclusion: fileMatch\n---\n\nx", ".kiro/steering/api.md");
		expect(ids).toEqual(["frontmatter/never-applied"]);
	});

	test("flags Devin glob trigger without globs", async () => {
		const ids = await ruleIds("---\ntrigger: glob\n---\n\nx", ".windsurf/rules/a.md");
		expect(ids).toEqual(["frontmatter/never-applied"]);
	});

	test("flags malformed YAML", async () => {
		const ids = await ruleIds("---\n- just\n- a list\n---\n\nx", ".cursor/rules/a.mdc");
		expect(ids).toEqual(["frontmatter/malformed"]);
	});

	test("ignores plain instruction files", async () => {
		expect(await ruleIds("---\nanything: goes\n---\n\n# Hi", "CLAUDE.md")).toEqual([]);
	});
});
