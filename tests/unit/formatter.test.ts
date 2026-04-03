import { describe, expect, test } from "bun:test";
import type { LintResult } from "../../src/lint/types.js";
import { ConsoleFormatter } from "../../src/output/formatter.js";
import { JsonFormatter } from "../../src/output/json.js";
import { MarkdownFormatter } from "../../src/output/markdown.js";
import { stripAnsi } from "../../src/output/terminal.js";

const sampleResult: LintResult = {
	diagnostics: [
		{
			ruleId: "token-count/file-too-large",
			severity: "error",
			message: "~9500 tokens exceeds 8000",
			filePath: "/tmp/CLAUDE.md",
		},
		{
			ruleId: "overlap/high-similarity",
			severity: "warning",
			message: "45% overlap",
			filePath: "/tmp/api.md",
		},
		{
			ruleId: "bloat/filler-phrases",
			severity: "info",
			message: "3 filler phrases",
			filePath: "/tmp/CLAUDE.md",
			line: 10,
		},
	],
	stats: { filesAnalyzed: 3, totalTokens: 15230, duration: 42 },
};

const emptyResult: LintResult = {
	diagnostics: [],
	stats: { filesAnalyzed: 1, totalTokens: 500, duration: 5 },
};

describe("ConsoleFormatter", () => {
	const fmt = new ConsoleFormatter();

	test("formats diagnostics with severity icons", () => {
		const output = fmt.format(sampleResult);
		const plain = stripAnsi(output);
		expect(plain).toContain("error");
		expect(plain).toContain("warn");
		expect(plain).toContain("info");
		expect(plain).toContain("3 files");
	});

	test("groups diagnostics by file", () => {
		const output = fmt.format(sampleResult);
		const plain = stripAnsi(output);
		// File names appear as group headers
		expect(plain).toContain("CLAUDE.md");
		expect(plain).toContain("api.md");
		// CLAUDE.md appears before its diagnostics
		const claudePos = plain.indexOf("CLAUDE.md");
		const errorPos = plain.indexOf("token-count/file-too-large");
		expect(claudePos).toBeLessThan(errorPos);
	});

	test("shows success message for clean results", () => {
		const output = fmt.format(emptyResult);
		const plain = stripAnsi(output);
		expect(plain).toContain("No issues found");
	});

	test("renders suggestion line when diagnostic has suggestion", () => {
		const resultWithSuggestion: LintResult = {
			diagnostics: [
				{
					ruleId: "dead-ref/missing-file",
					severity: "error",
					message: 'Referenced file "src/old.ts" does not exist',
					filePath: "/tmp/CLAUDE.md",
					line: 15,
					suggestion: "Remove the reference or create the missing file",
				},
			],
			stats: { filesAnalyzed: 1, totalTokens: 500, duration: 5 },
		};
		const output = fmt.format(resultWithSuggestion);
		const plain = stripAnsi(output);
		expect(plain).toContain("Remove the reference or create the missing file");
	});

	test("does not render suggestion line when diagnostic has no suggestion", () => {
		const resultWithoutSuggestion: LintResult = {
			diagnostics: [
				{
					ruleId: "token-count/file-too-large",
					severity: "error",
					message: "~9500 tokens exceeds 8000",
					filePath: "/tmp/CLAUDE.md",
				},
			],
			stats: { filesAnalyzed: 1, totalTokens: 9500, duration: 5 },
		};
		const output = fmt.format(resultWithoutSuggestion);
		const plain = stripAnsi(output);
		expect(plain).not.toContain("→");
	});

	test("shows error guidance when errors exist", () => {
		const output = fmt.format(sampleResult);
		const plain = stripAnsi(output);
		expect(plain).toContain("Fix the errors above");
	});

	test("shows warning guidance when only warnings exist", () => {
		const warningOnly: LintResult = {
			diagnostics: [
				{
					ruleId: "overlap/high-similarity",
					severity: "warning",
					message: "45% overlap",
					filePath: "/tmp/api.md",
				},
			],
			stats: { filesAnalyzed: 1, totalTokens: 500, duration: 5 },
		};
		const output = fmt.format(warningOnly);
		const plain = stripAnsi(output);
		expect(plain).toContain("Warnings suggest improvements");
	});

	test("shows all-clear guidance when no issues", () => {
		const output = fmt.format(emptyResult);
		const plain = stripAnsi(output);
		expect(plain).toContain("All clear");
	});

	test("groups diagnostics by file", () => {
		const output = fmt.format(sampleResult);
		const plain = stripAnsi(output);
		// File names appear as group headers
		expect(plain).toContain("CLAUDE.md");
		expect(plain).toContain("api.md");
		// File header appears before its diagnostic
		const claudeIdx = plain.indexOf("CLAUDE.md");
		const tokenIdx = plain.indexOf("token-count/file-too-large");
		expect(claudeIdx).toBeLessThan(tokenIdx);
	});
});

describe("JsonFormatter", () => {
	const fmt = new JsonFormatter();

	test("produces valid JSON", () => {
		const output = fmt.format(sampleResult);
		const parsed = JSON.parse(output);
		expect(parsed.diagnostics).toHaveLength(3);
		expect(parsed.stats.filesAnalyzed).toBe(3);
	});

	test("produces valid JSON for empty results", () => {
		const output = fmt.format(emptyResult);
		const parsed = JSON.parse(output);
		expect(parsed.diagnostics).toHaveLength(0);
	});
});

describe("MarkdownFormatter", () => {
	const fmt = new MarkdownFormatter();

	test("produces markdown with headers", () => {
		const output = fmt.format(sampleResult);
		expect(output).toContain("# agenteval Lint Report");
		expect(output).toContain("## Errors");
		expect(output).toContain("## Warnings");
		expect(output).toContain("## Info");
	});

	test("handles empty results", () => {
		const output = fmt.format(emptyResult);
		expect(output).toContain("No issues found");
	});
});
