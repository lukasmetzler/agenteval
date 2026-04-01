import { describe, expect, test } from "bun:test";
import type { Config } from "../../src/config/schema.js";
import { TokenCounterRule, countTokens } from "../../src/lint/tokenCounter.js";
import type { LintContext, ParsedFile } from "../../src/lint/types.js";
import { parseMarkdown } from "../../src/markdown/parser.js";
import { extractSections, extractSuppressions } from "../../src/markdown/sections.js";

function makeParsedFile(content: string, path = "test.md"): ParsedFile {
	const tree = parseMarkdown(content);
	const sections = extractSections(tree, content);
	const tokens = countTokens(content);
	for (const section of sections) {
		section.tokens = countTokens(section.content);
	}
	return {
		path,
		content,
		tree,
		sections,
		suppressions: extractSuppressions(tree),
		tokens,
		frontmatter: null,
	};
}

function makeContext(files: ParsedFile[], overrides?: Partial<Config>): LintContext {
	return {
		config: {
			version: 1 as const,
			instructionGlobs: [],
			instructions: [],
			model: "claude-sonnet-4-20250514",
			contextBudget: 0.3,
			lint: {
				overlapThreshold: 0.3,
				bloatThreshold: 0.5,
				maxTokensPerFile: 100,
				antiPatterns: [],
				ignore: [],
			},
			...overrides,
		},
		files,
		cwd: "/tmp",
	};
}

describe("countTokens", () => {
	test("returns 0 for empty string", () => {
		expect(countTokens("")).toBe(0);
	});

	test("counts tokens for a known string", () => {
		const tokens = countTokens("Hello, world!");
		expect(tokens).toBeGreaterThan(0);
		expect(tokens).toBeLessThan(10);
	});

	test("handles unicode/emoji content", () => {
		const tokens = countTokens("Hello 🌍! こんにちは世界");
		expect(tokens).toBeGreaterThan(0);
	});

	test("is deterministic", () => {
		const text = "The quick brown fox jumps over the lazy dog.";
		const count1 = countTokens(text);
		const count2 = countTokens(text);
		expect(count1).toBe(count2);
	});
});

describe("TokenCounterRule", () => {
	const rule = new TokenCounterRule();

	test("reports no diagnostics for small files", async () => {
		const file = makeParsedFile("# Small\n\nJust a few words.");
		const ctx = makeContext([file]);
		const diagnostics = await rule.run(ctx);
		expect(diagnostics).toHaveLength(0);
	});

	test("reports warning when file exceeds token limit", async () => {
		const longContent = `# Large File\n\n${"This is a long sentence that adds tokens to the file. ".repeat(50)}`;
		const file = makeParsedFile(longContent);
		const ctx = makeContext([file], {
			lint: {
				overlapThreshold: 0.3,
				bloatThreshold: 0.5,
				maxTokensPerFile: 10,
				antiPatterns: [],
				ignore: [],
			},
		});
		const diagnostics = await rule.run(ctx);

		const fileTooLarge = diagnostics.filter((d) => d.ruleId === "token-count/file-too-large");
		expect(fileTooLarge.length).toBeGreaterThan(0);
		expect(fileTooLarge[0].severity).toBe("warning");
	});

	test("reports section-heavy when one section dominates", async () => {
		const content = `# Title\n\nShort intro.\n\n## Heavy\n\n${"Lots and lots of detailed content here. ".repeat(30)}`;
		const file = makeParsedFile(content);
		const ctx = makeContext([file], {
			lint: {
				overlapThreshold: 0.3,
				bloatThreshold: 0.5,
				maxTokensPerFile: 50000,
				antiPatterns: [],
				ignore: [],
			},
		});
		const diagnostics = await rule.run(ctx);

		const sectionHeavy = diagnostics.filter((d) => d.ruleId === "token-count/section-heavy");
		expect(sectionHeavy.length).toBeGreaterThan(0);
	});

	test("respects config threshold changes", async () => {
		const content = "# Title\n\nSome content with about fifty tokens or so in this paragraph.";
		const file = makeParsedFile(content);

		const strictCtx = makeContext([file], {
			lint: {
				overlapThreshold: 0.3,
				bloatThreshold: 0.5,
				maxTokensPerFile: 5,
				antiPatterns: [],
				ignore: [],
			},
		});
		const lenientCtx = makeContext([file], {
			lint: {
				overlapThreshold: 0.3,
				bloatThreshold: 0.5,
				maxTokensPerFile: 50000,
				antiPatterns: [],
				ignore: [],
			},
		});

		const strictDiags = await rule.run(strictCtx);
		const lenientDiags = await rule.run(lenientCtx);

		expect(strictDiags.length).toBeGreaterThan(lenientDiags.length);
	});
});
