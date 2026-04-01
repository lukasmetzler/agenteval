import { describe, expect, test } from "bun:test";
import type { Config } from "../../src/config/schema.js";
import {
	OverlapDetectorRule,
	computeNgrams,
	jaccardSimilarity,
} from "../../src/lint/overlapDetector.js";
import { countTokens } from "../../src/lint/tokenCounter.js";
import type { LintContext, ParsedFile } from "../../src/lint/types.js";
import { parseMarkdown } from "../../src/markdown/parser.js";
import { extractSections, extractSuppressions } from "../../src/markdown/sections.js";

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

describe("computeNgrams", () => {
	test("generates word-level n-grams", () => {
		const ngrams = computeNgrams("the quick brown fox jumps over the lazy dog");
		expect(ngrams.size).toBeGreaterThan(0);
		expect(ngrams.has("the quick brown fox jumps")).toBe(true);
	});

	test("returns empty set for short text", () => {
		const ngrams = computeNgrams("too short");
		expect(ngrams.size).toBe(0);
	});

	test("lowercases and strips punctuation", () => {
		const ngrams = computeNgrams("The Quick, Brown Fox! Jumps Over.");
		expect(ngrams.has("the quick brown fox jumps")).toBe(true);
	});
});

describe("jaccardSimilarity", () => {
	test("identical sets return 1.0", () => {
		const a = new Set(["a", "b", "c"]);
		expect(jaccardSimilarity(a, a)).toBe(1);
	});

	test("disjoint sets return 0.0", () => {
		const a = new Set(["a", "b"]);
		const b = new Set(["c", "d"]);
		expect(jaccardSimilarity(a, b)).toBe(0);
	});

	test("partial overlap returns expected value", () => {
		const a = new Set(["a", "b", "c", "d"]);
		const b = new Set(["c", "d", "e", "f"]);
		expect(jaccardSimilarity(a, b)).toBe(2 / 6);
	});

	test("two empty sets return 0", () => {
		expect(jaccardSimilarity(new Set(), new Set())).toBe(0);
	});
});

describe("OverlapDetectorRule", () => {
	const rule = new OverlapDetectorRule();

	test("returns empty for single file", async () => {
		const file = makeFile(
			"# Title\n\nSome content here with enough words to generate ngrams.",
			"a.md",
		);
		const ctx: LintContext = { config: defaultConfig, files: [file], cwd: "/tmp" };
		const diags = await rule.run(ctx);
		expect(diags).toHaveLength(0);
	});

	test("detects overlap between similar files", async () => {
		const sharedContent =
			"Use TypeScript strict mode for all code. Prefer const over let. Use early returns for cleaner control flow. Always write unit tests for new functions.";
		const a = makeFile(`# Backend\n\n${sharedContent}\n\nBackend specific stuff.`, "backend.md");
		const b = makeFile(`# API\n\n${sharedContent}\n\nAPI specific stuff.`, "api.md");

		const ctx: LintContext = { config: defaultConfig, files: [a, b], cwd: "/tmp" };
		const diags = await rule.run(ctx);
		expect(diags.some((d) => d.ruleId === "overlap/high-similarity")).toBe(true);
	});

	test("passes for completely different files", async () => {
		const a = makeFile(
			"# Authentication\n\nUse JWT tokens for session management. Validate on every request. Rotate keys monthly.",
			"auth.md",
		);
		const b = makeFile(
			"# Database\n\nUse PostgreSQL with connection pooling. Run migrations before deploy. Index foreign keys.",
			"db.md",
		);
		const ctx: LintContext = { config: defaultConfig, files: [a, b], cwd: "/tmp" };
		const diags = await rule.run(ctx);
		const overlapDiags = diags.filter((d) => d.ruleId === "overlap/high-similarity");
		expect(overlapDiags).toHaveLength(0);
	});
});
