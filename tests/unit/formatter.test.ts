import { describe, expect, test } from "bun:test";
import type { LintResult } from "../../src/lint/types.js";
import { ConsoleFormatter } from "../../src/output/formatter.js";
import { JsonFormatter } from "../../src/output/json.js";
import { MarkdownFormatter } from "../../src/output/markdown.js";

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
		expect(output).toContain("error");
		expect(output).toContain("warn");
		expect(output).toContain("info");
		expect(output).toContain("3 files analyzed");
	});

	test("shows success message for clean results", () => {
		const output = fmt.format(emptyResult);
		expect(output).toContain("No issues found");
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
