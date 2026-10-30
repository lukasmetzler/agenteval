import { describe, expect, test } from "bun:test";
import { AgentLimitsRule } from "../../src/lint/agentLimits.js";
import { makeContext, makeParsedFile } from "../../tests/helpers.js";

const rule = new AgentLimitsRule();

async function ids(files: [string, string][]): Promise<string[]> {
	const parsed = files.map(([path, content]) => makeParsedFile(content, path));
	return (await rule.run(makeContext(parsed))).map((d) => d.ruleId);
}

describe("AgentLimitsRule", () => {
	test("flags an AGENTS.md chain over 32 KiB on the nested file", async () => {
		const result = await ids([
			["AGENTS.md", "word ".repeat(4_000)],
			["packages/web/AGENTS.md", "text ".repeat(4_000)],
		]);
		expect(result).toEqual(["agent-limits/codex-size"]);
	});

	test("flags long CLAUDE.md and truncation of nested CLAUDE.md", async () => {
		const long = Array.from({ length: 250 }, () => "line").join("\n");
		expect(await ids([["CLAUDE.md", long]])).toEqual(["agent-limits/claude-lines"]);
		expect(await ids([["src/CLAUDE.md", "word ".repeat(8_001)]])).toEqual([
			"agent-limits/claude-truncation",
		]);
	});

	test("flags .md files in .cursor/rules and long .mdc rules", async () => {
		expect(await ids([[".cursor/rules/style.md", "# Style"]])).toEqual([
			"agent-limits/cursor-md-ignored",
		]);
		const long = Array.from({ length: 501 }, () => "x").join("\n");
		expect(await ids([[".cursor/rules/style.mdc", long]])).toEqual(["agent-limits/cursor-lines"]);
	});

	test("notes that Claude Code ignores AGENTS.md next to CLAUDE.md unless imported", async () => {
		expect(
			await ids([
				["CLAUDE.md", "# Claude"],
				["AGENTS.md", "# Agents"],
			]),
		).toEqual(["agent-limits/claude-ignores-agents-md"]);
		expect(
			await ids([
				["CLAUDE.md", "@AGENTS.md"],
				["AGENTS.md", "# Agents"],
			]),
		).toEqual([]);
	});
});
