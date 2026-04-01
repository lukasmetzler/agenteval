import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import type { Config } from "../../src/config/schema.js";
import {
	DeadSectionAnalyzerRule,
	extractFileReferences,
	extractMarkdownLinks,
} from "../../src/lint/deadSectionAnalyzer.js";
import { countTokens } from "../../src/lint/tokenCounter.js";
import type { LintContext, ParsedFile } from "../../src/lint/types.js";
import { parseMarkdown } from "../../src/markdown/parser.js";
import { extractSections, extractSuppressions } from "../../src/markdown/sections.js";

const fixturesDir = join(import.meta.dir, "../fixtures");

function makeFile(content: string, path: string): ParsedFile {
	const tree = parseMarkdown(content);
	return {
		path,
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

describe("extractMarkdownLinks", () => {
	test("extracts relative links", () => {
		const links = extractMarkdownLinks("See [guide](./guide.md) for details.");
		expect(links).toHaveLength(1);
		expect(links[0].href).toBe("./guide.md");
	});

	test("ignores absolute URLs", () => {
		const links = extractMarkdownLinks("See [docs](https://example.com) for details.");
		expect(links).toHaveLength(0);
	});

	test("ignores anchor links", () => {
		const links = extractMarkdownLinks("See [section](#overview) below.");
		expect(links).toHaveLength(0);
	});

	test("reports correct line numbers", () => {
		const links = extractMarkdownLinks("Line 1\n\nSee [link](./target.md) here.\n\nLine 4");
		expect(links).toHaveLength(1);
		expect(links[0].line).toBe(3);
	});
});

describe("extractFileReferences", () => {
	test("finds src/ paths", () => {
		const refs = extractFileReferences("Check the code in src/services/auth.ts for details.");
		expect(refs.length).toBeGreaterThan(0);
		expect(refs[0].path).toContain("src/");
	});

	test("finds ./ relative paths", () => {
		const refs = extractFileReferences("See ./config/settings.yaml for config.");
		expect(refs.length).toBeGreaterThan(0);
	});

	test("skips glob patterns", () => {
		const refs = extractFileReferences("Run against src/**/*.ts files.");
		expect(refs).toHaveLength(0);
	});
});

describe("DeadSectionAnalyzerRule", () => {
	const rule = new DeadSectionAnalyzerRule();

	test("flags broken markdown links", async () => {
		const file = makeFile(
			"# Guide\n\nSee [missing guide](./nonexistent.md) for details.",
			join(fixturesDir, "dead-refs/test.md"),
		);
		const ctx: LintContext = { config: defaultConfig, files: [file], cwd: fixturesDir };
		const diags = await rule.run(ctx);
		expect(diags.some((d) => d.ruleId === "dead-ref/broken-link")).toBe(true);
	});

	test("flags missing file references", async () => {
		const file = makeFile(
			"# Architecture\n\nSee the implementation in src/services/nonexistent.ts for details.",
			join(fixturesDir, "dead-refs/CLAUDE.md"),
		);
		const ctx: LintContext = { config: defaultConfig, files: [file], cwd: fixturesDir };
		const diags = await rule.run(ctx);
		expect(diags.some((d) => d.ruleId === "dead-ref/missing-file")).toBe(true);
	});

	test("passes when referenced files exist", async () => {
		const file = makeFile(
			"# Fixtures\n\nSee [simple config](./simple/agenteval.yaml) for an example.",
			join(fixturesDir, "test.md"),
		);
		const ctx: LintContext = { config: defaultConfig, files: [file], cwd: fixturesDir };
		const diags = await rule.run(ctx);
		const brokenLinks = diags.filter((d) => d.ruleId === "dead-ref/broken-link");
		expect(brokenLinks).toHaveLength(0);
	});
});
