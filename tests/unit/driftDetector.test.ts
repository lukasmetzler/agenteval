import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { DriftDetectorRule } from "../../src/lint/driftDetector.js";
import type { LintContext } from "../../src/lint/types.js";
import { defaultConfig, makeParsedFile } from "../../tests/helpers.js";

const repoRoot = join(import.meta.dir, "../..");

describe("DriftDetectorRule", () => {
	const rule = new DriftDetectorRule();

	test("has correct id and run method", () => {
		expect(rule.id).toBe("drift");
		expect(typeof rule.run).toBe("function");
	});

	test("runs without crashing on repo CLAUDE.md", async () => {
		const claudeMdPath = join(repoRoot, "CLAUDE.md");
		const content = await Bun.file(claudeMdPath).text();
		const file = makeParsedFile(content, claudeMdPath);
		const ctx: LintContext = { config: defaultConfig, files: [file], cwd: repoRoot };
		const diags = await rule.run(ctx);
		// Should not throw; diagnostics may or may not exist depending on repo state
		expect(Array.isArray(diags)).toBe(true);
	});

	test("skips http URLs", async () => {
		const content =
			"# Guide\n\nSee [docs](https://example.com/api) and [repo](http://github.com/foo).";
		const file = makeParsedFile(content, join(repoRoot, "CLAUDE.md"));
		const ctx: LintContext = { config: defaultConfig, files: [file], cwd: repoRoot };
		const diags = await rule.run(ctx);
		// HTTP URLs should never produce drift diagnostics
		const driftDiags = diags.filter((d) => d.ruleId === "drift/stale-reference");
		for (const d of driftDiags) {
			expect(d.message).not.toContain("https://");
			expect(d.message).not.toContain("http://");
		}
	});

	test("skips non-existent files", async () => {
		const content =
			"# Guide\n\nCheck src/totally/nonexistent/file_that_does_not_exist.ts for details.";
		const file = makeParsedFile(content, join(repoRoot, "CLAUDE.md"));
		const ctx: LintContext = { config: defaultConfig, files: [file], cwd: repoRoot };
		const diags = await rule.run(ctx);
		// Dead refs are handled by deadSectionAnalyzer, drift detector only checks existing files
		const driftDiags = diags.filter((d) => d.ruleId === "drift/stale-reference");
		expect(driftDiags).toHaveLength(0);
	});

	test("does not false-positive when instruction file is untracked", async () => {
		// An untracked instruction file has no git date, so should be skipped entirely
		const content = "# Guide\n\nSee src/lint/index.ts for details.";
		const file = makeParsedFile(content, "/tmp/untracked-instruction.md");
		const ctx: LintContext = { config: defaultConfig, files: [file], cwd: repoRoot };
		const diags = await rule.run(ctx);
		const driftDiags = diags.filter((d) => d.ruleId === "drift/stale-reference");
		expect(driftDiags).toHaveLength(0);
	});

	test("diagnostics have correct structure when present", async () => {
		const content = await Bun.file(join(repoRoot, "CLAUDE.md")).text();
		const file = makeParsedFile(content, join(repoRoot, "CLAUDE.md"));
		const ctx: LintContext = { config: defaultConfig, files: [file], cwd: repoRoot };
		const diags = await rule.run(ctx);
		for (const d of diags) {
			expect(d.ruleId).toBe("drift/stale-reference");
			expect(d.severity).toBe("warning");
			expect(d.suggestion).toBe(
				"Review whether the instructions about this file are still accurate",
			);
			expect(d.meta).toBeDefined();
			expect(typeof d.line).toBe("number");
		}
	});
});
