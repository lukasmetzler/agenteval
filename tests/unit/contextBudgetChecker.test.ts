import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Config } from "../../src/config/schema.js";
import { ContextBudgetCheckerRule } from "../../src/lint/contextBudgetChecker.js";
import type { LintContext, ParsedFile } from "../../src/lint/types.js";
import { parseMarkdown } from "../../src/markdown/parser.js";
import { extractSections } from "../../src/markdown/sections.js";

function makeFile(
	tokens: number,
	path = "test.md",
	kind: ParsedFile["kind"] = "instruction",
): ParsedFile {
	return {
		path,
		kind,
		content: "",
		body: "",
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
		model: "claude-haiku-4-5", // 200k window keeps the budget arithmetic below simple
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

	test("excludes nested instruction files and path-scoped rules from the startup budget", async () => {
		const config = makeConfig({ lint: { ...makeConfig().lint, maxTotalTokens: 100 } });
		const scoped = makeFile(500, ".claude/rules/api.md", "claude-rule");
		scoped.frontmatter = { paths: ["src/api/**"] };
		const files = [
			makeFile(50, "CLAUDE.md"),
			makeFile(500, "packages/web/CLAUDE.md"),
			scoped,
			makeFile(500, ".claude/skills/x/SKILL.md", "skill"),
		];
		const diags = await rule.run({ config, files, cwd: "/tmp" });
		expect(diags).toHaveLength(0);
	});

	test("counts @imported files toward the budget", async () => {
		const dir = mkdtempSync(join(tmpdir(), "budget-"));
		writeFileSync(join(dir, "big.md"), "word ".repeat(400));
		const root = makeFile(10, join(dir, "CLAUDE.md"));
		root.content = "See @big.md for details.";
		const config = makeConfig({ lint: { ...makeConfig().lint, maxTotalTokens: 100 } });
		const diags = await rule.run({ config, files: [root], cwd: dir });
		rmSync(dir, { recursive: true });
		expect(diags.some((d) => d.ruleId === "context-budget/exceeded")).toBe(true);
	});
});

describe("unknown models", () => {
	test("notes the fallback window unless maxTotalTokens is set", async () => {
		const rule = new ContextBudgetCheckerRule();
		const file = makeFile(10);
		const unknown = await rule.run({
			config: makeConfig({ model: "mystery-1" }),
			files: [file],
			cwd: "/tmp",
		});
		expect(unknown.map((d) => d.ruleId)).toEqual(["context-budget/unknown-model"]);
		const pinned = makeConfig({ model: "mystery-1" });
		pinned.lint = { ...pinned.lint, maxTotalTokens: 1000 };
		expect(await rule.run({ config: pinned, files: [file], cwd: "/tmp" })).toEqual([]);
	});
});
