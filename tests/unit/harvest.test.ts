import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import {
	detectAICommits,
	detectSignals,
	parseGitLog,
	parseNumstat,
} from "../../src/harvest/detect.js";
import { detectTestCommand, emitTaskYaml, writeTaskFile } from "../../src/harvest/emit.js";
import { harvest } from "../../src/harvest/index.js";
import type { AICommit } from "../../src/harvest/types.js";

const repoRoot = join(import.meta.dir, "../..");

// ──────────────────────────────────────────────
// parseGitLog() — pure function, string fixtures
// ──────────────────────────────────────────────

describe("parseGitLog", () => {
	test("parses NUL-delimited git log output correctly", () => {
		const input =
			"abc123full\x00abc123\x00feat: add feature\x00user@example.com\x002026-01-01T00:00:00+00:00\x00Claude <noreply@anthropic.com>";
		const commits = parseGitLog(input);
		expect(commits).toHaveLength(1);
		expect(commits[0].hash).toBe("abc123full");
		expect(commits[0].shortHash).toBe("abc123");
		expect(commits[0].subject).toBe("feat: add feature");
		expect(commits[0].authorEmail).toBe("user@example.com");
		expect(commits[0].coAuthorRaw).toBe("Claude <noreply@anthropic.com>");
	});

	test("handles commits with no co-author trailers", () => {
		const input =
			"abc123full\x00abc123\x00chore: cleanup\x00user@example.com\x002026-01-01T00:00:00+00:00\x00";
		const commits = parseGitLog(input);
		expect(commits).toHaveLength(1);
		expect(commits[0].coAuthorRaw).toBe("");
	});

	test("handles commits with multiple co-authors", () => {
		const input =
			"abc123full\x00abc123\x00feat: collab\x00user@example.com\x002026-01-01T00:00:00+00:00\x00Alice <alice@example.com>\x1EClaude <noreply@anthropic.com>";
		const commits = parseGitLog(input);
		expect(commits).toHaveLength(1);
		expect(commits[0].coAuthorRaw).toContain("Alice");
		expect(commits[0].coAuthorRaw).toContain("noreply@anthropic.com");
	});

	test("returns empty array for empty input", () => {
		expect(parseGitLog("")).toHaveLength(0);
		expect(parseGitLog("  \n  ")).toHaveLength(0);
	});

	test("skips malformed lines with fewer than 5 fields", () => {
		const input = "bad\x00data\x00only";
		expect(parseGitLog(input)).toHaveLength(0);
	});

	test("parses multiple commits", () => {
		const lines = [
			"hash1\x00h1\x00msg1\x00a@b.com\x002026-01-01T00:00:00+00:00\x00",
			"hash2\x00h2\x00msg2\x00c@d.com\x002026-01-02T00:00:00+00:00\x00",
		].join("\n");
		expect(parseGitLog(lines)).toHaveLength(2);
	});
});

// ──────────────────────────────────────────────
// parseNumstat() — rename handling
// ──────────────────────────────────────────────

describe("parseNumstat", () => {
	test("parses normal numstat output", () => {
		const lines = ["10\t5\tsrc/auth.ts", "3\t1\ttests/auth.test.ts"];
		const result = parseNumstat(lines);
		expect(result.files).toEqual(["src/auth.ts", "tests/auth.test.ts"]);
		expect(result.totalAdd).toBe(13);
		expect(result.totalDel).toBe(6);
	});

	test("handles full-path renames (old => new)", () => {
		const lines = ["0\t0\tsrc/old.ts => src/new.ts"];
		const result = parseNumstat(lines);
		expect(result.files).toEqual(["src/new.ts"]);
	});

	test("handles brace renames ({old => new}/file.ts)", () => {
		const lines = ["5\t2\tsrc/{utils => helpers}/format.ts"];
		const result = parseNumstat(lines);
		expect(result.files).toEqual(["src/helpers/format.ts"]);
	});

	test("handles rename with empty destination (deletion side)", () => {
		const lines = ["0\t0\tsrc/{ => new}/file.ts"];
		const result = parseNumstat(lines);
		expect(result.files).toEqual(["src/new/file.ts"]);
	});

	test("returns empty for no input", () => {
		expect(parseNumstat([])).toEqual({ files: [], totalAdd: 0, totalDel: 0 });
	});
});

// ──────────────────────────────────────────────
// detectSignals() — synthetic fixtures
// ──────────────────────────────────────────────

describe("detectSignals", () => {
	const makeCommit = (overrides: Record<string, string> = {}) => ({
		hash: "abc123full",
		shortHash: "abc123",
		subject: overrides.subject ?? "feat: add feature",
		authorEmail: overrides.authorEmail ?? "user@example.com",
		date: "2026-01-01T00:00:00+00:00",
		coAuthorRaw: overrides.coAuthorRaw ?? "",
	});

	test("detects Claude co-author (noreply@anthropic.com)", () => {
		const commit = makeCommit({
			coAuthorRaw: "Claude Opus 4.6 <noreply@anthropic.com>",
		});
		const signal = detectSignals(commit);
		expect(signal).not.toBeNull();
		expect(signal?.method).toBe("co-author-tag");
		expect(signal?.confidence).toBe(0.9);
	});

	test("detects Copilot co-author (noreply@github.com)", () => {
		const commit = makeCommit({
			coAuthorRaw: "GitHub Copilot <noreply@github.com>",
		});
		const signal = detectSignals(commit);
		expect(signal).not.toBeNull();
		expect(signal?.method).toBe("co-author-tag");
		expect(signal?.confidence).toBe(0.9);
	});

	test("detects Cursor co-author", () => {
		const commit = makeCommit({
			coAuthorRaw: "Cursor AI <assistant@cursor.sh>",
		});
		const signal = detectSignals(commit);
		expect(signal).not.toBeNull();
		expect(signal?.method).toBe("co-author-tag");
	});

	test("detects Devin co-author", () => {
		const commit = makeCommit({
			coAuthorRaw: "Devin <devin@cognition.ai>",
		});
		const signal = detectSignals(commit);
		expect(signal).not.toBeNull();
		expect(signal?.method).toBe("co-author-tag");
	});

	test("detects Aider co-author", () => {
		const commit = makeCommit({
			coAuthorRaw: "aider <aider@aider.chat>",
		});
		const signal = detectSignals(commit);
		expect(signal).not.toBeNull();
		expect(signal?.method).toBe("co-author-tag");
	});

	test("detects Amazon Q co-author", () => {
		const commit = makeCommit({
			coAuthorRaw: "Amazon Q <amazon-q@amazon.com>",
		});
		const signal = detectSignals(commit);
		expect(signal).not.toBeNull();
		expect(signal?.method).toBe("co-author-tag");
	});

	test("detects Gemini co-author", () => {
		const commit = makeCommit({
			coAuthorRaw: "Gemini <gemini@google.com>",
		});
		const signal = detectSignals(commit);
		expect(signal).not.toBeNull();
		expect(signal?.method).toBe("co-author-tag");
	});

	test("detects Codeium/Windsurf co-author", () => {
		const commit = makeCommit({
			coAuthorRaw: "Windsurf <assistant@codeium.com>",
		});
		const signal = detectSignals(commit);
		expect(signal).not.toBeNull();
		expect(signal?.method).toBe("co-author-tag");
	});

	test("detects Tabnine co-author", () => {
		const commit = makeCommit({
			coAuthorRaw: "Tabnine <tabnine@tabnine.com>",
		});
		const signal = detectSignals(commit);
		expect(signal).not.toBeNull();
		expect(signal?.method).toBe("co-author-tag");
	});

	test("detects Cody co-author", () => {
		const commit = makeCommit({
			coAuthorRaw: "Cody <cody@sourcegraph.com>",
		});
		const signal = detectSignals(commit);
		expect(signal).not.toBeNull();
		expect(signal?.method).toBe("co-author-tag");
	});

	test("detects Codex CLI co-author", () => {
		const commit = makeCommit({
			coAuthorRaw: "Codex <codex@openai.com>",
		});
		const signal = detectSignals(commit);
		expect(signal).not.toBeNull();
		expect(signal?.method).toBe("co-author-tag");
	});

	test("detects message pattern: Generated by", () => {
		const commit = makeCommit({
			subject: "Generated by Claude Code",
		});
		const signal = detectSignals(commit);
		expect(signal).not.toBeNull();
		expect(signal?.method).toBe("message-pattern");
		expect(signal?.confidence).toBe(0.6);
	});

	test("detects message pattern: bot emoji", () => {
		const commit = makeCommit({
			subject: "🤖 auto-fix lint errors",
		});
		const signal = detectSignals(commit);
		expect(signal).not.toBeNull();
		expect(signal?.method).toBe("message-pattern");
	});

	test("detects message pattern: ai-generated", () => {
		const commit = makeCommit({
			subject: "ai-generated: refactor auth module",
		});
		const signal = detectSignals(commit);
		expect(signal).not.toBeNull();
		expect(signal?.method).toBe("message-pattern");
	});

	test("detects message pattern: auto-generated", () => {
		const commit = makeCommit({
			subject: "auto-generated migration file",
		});
		const signal = detectSignals(commit);
		expect(signal).not.toBeNull();
		expect(signal?.method).toBe("message-pattern");
	});

	test("co-author-tag takes priority over message pattern", () => {
		const commit = makeCommit({
			subject: "Generated by Claude",
			coAuthorRaw: "Claude <noreply@anthropic.com>",
		});
		const signal = detectSignals(commit);
		expect(signal?.method).toBe("co-author-tag");
		expect(signal?.confidence).toBe(0.9);
	});

	test("noreply@github.com without copilot name is not detected", () => {
		const commit = makeCommit({
			coAuthorRaw: "John Doe <noreply@github.com>",
		});
		expect(detectSignals(commit)).toBeNull();
	});

	test("no AI signals returns null", () => {
		const commit = makeCommit({
			subject: "feat: add login page",
			authorEmail: "developer@company.com",
			coAuthorRaw: "Colleague <colleague@company.com>",
		});
		expect(detectSignals(commit)).toBeNull();
	});

	test("returns tool name for Claude co-author", () => {
		const commit = makeCommit({
			coAuthorRaw: "Claude <noreply@anthropic.com>",
		});
		const signal = detectSignals(commit);
		expect(signal?.tool).toBe("claude");
	});

	test("returns tool name for Copilot co-author", () => {
		const commit = makeCommit({
			coAuthorRaw: "GitHub Copilot <noreply@github.com>",
		});
		const signal = detectSignals(commit);
		expect(signal?.tool).toBe("copilot");
	});

	test("returns 'unknown' tool for message-pattern detection", () => {
		const commit = makeCommit({
			subject: "🤖 auto-fix lint errors",
		});
		const signal = detectSignals(commit);
		expect(signal?.tool).toBe("unknown");
	});

	test("malformed co-author trailer does not crash", () => {
		// Trailers without angle brackets should be skipped (with a warning)
		const commit = makeCommit({
			coAuthorRaw: "Claude noreply@anthropic.com",
		});
		// No angle brackets = no email parsed = no detection
		expect(detectSignals(commit)).toBeNull();
	});
});

// ──────────────────────────────────────────────
// detectAICommits() — real repo tests
// ──────────────────────────────────────────────

describe("detectAICommits", () => {
	test("detects Co-authored-by: Claude commits in this repo", async () => {
		const { commits, scanned } = await detectAICommits(repoRoot);
		expect(scanned).toBeGreaterThan(0);
		expect(commits.length).toBeGreaterThan(0);
		// Every non-initial commit in this repo has Claude co-author
		for (const c of commits) {
			expect(c.confidence).toBe(0.9);
			expect(c.detectionMethod).toBe("co-author-tag");
		}
	});

	test("returns correct confidence for co-author-tag detection", async () => {
		const { commits } = await detectAICommits(repoRoot);
		expect(commits.length).toBeGreaterThan(0);
		expect(commits[0].confidence).toBe(0.9);
	});

	test("skips initial commit (no parent)", async () => {
		const { skipped } = await detectAICommits(repoRoot);
		const noParent = skipped.filter((s) => s.reason === "no parent commit");
		expect(noParent.length).toBeGreaterThanOrEqual(1);
	});

	test("respects --since date filter", async () => {
		// Use a future date so nothing matches
		const { commits } = await detectAICommits(repoRoot, {
			since: "2099-01-01",
		});
		expect(commits).toHaveLength(0);
	});

	test("respects --commit single-commit mode", async () => {
		// Get the latest commit hash
		const proc = Bun.spawn(["git", "log", "--format=%H", "-1"], {
			cwd: repoRoot,
			stdout: "pipe",
		});
		await proc.exited;
		const hash = (await new Response(proc.stdout).text()).trim();

		const { commits, scanned } = await detectAICommits(repoRoot, {
			commit: hash,
		});
		expect(scanned).toBe(1);
		// This commit has Claude co-author, so it should be detected
		expect(commits.length).toBeLessThanOrEqual(1);
	});

	test("returns diffStat with correct counts", async () => {
		const { commits } = await detectAICommits(repoRoot);
		expect(commits.length).toBeGreaterThan(0);
		for (const c of commits) {
			expect(c.diffStat.filesChanged).toBeGreaterThan(0);
			expect(c.diffStat.additions).toBeGreaterThanOrEqual(0);
			expect(c.diffStat.deletions).toBeGreaterThanOrEqual(0);
			expect(c.filesChanged.length).toBe(c.diffStat.filesChanged);
		}
	});
});

// ──────────────────────────────────────────────
// emitTaskYaml() — pure function tests
// ──────────────────────────────────────────────

describe("emitTaskYaml", () => {
	const sampleCommit: AICommit = {
		hash: "abc123def456",
		shortHash: "abc123d",
		message: "feat: add user authentication module",
		author: "dev@example.com",
		coAuthors: ["Claude <noreply@anthropic.com>"],
		detectionMethod: "co-author-tag",
		confidence: 0.9,
		timestamp: new Date("2026-01-15T10:00:00Z"),
		filesChanged: ["src/auth.ts", "tests/auth.test.ts"],
		diffStat: { additions: 120, deletions: 5, filesChanged: 2 },
	};

	test("produces valid TaskDefinition", () => {
		const task = emitTaskYaml(sampleCommit, {});
		expect(task.name).toBe("harvest-abc123d");
		expect(task.description).toBe("feat: add user authentication module");
		expect(task.harness).toBe("auto");
		expect(task.timeout).toBe(300);
		expect(task.scoring.correctness).toBe(0.5);
	});

	test("generates files-changed assertions for each file in diff", () => {
		const task = emitTaskYaml(sampleCommit, {});
		// 2 files-changed + 1 test-pass (sampleCommit includes tests/auth.test.ts)
		expect(task.assertions).toHaveLength(3);
		expect(task.assertions[0].type).toBe("files-changed");
		expect(task.assertions[0].pattern).toBe("src/auth.ts");
		expect(task.assertions[1].pattern).toBe("tests/auth.test.ts");
		expect(task.assertions[2].type).toBe("test-pass");
	});

	test("strips conventional-commit prefix from prompt", () => {
		const task = emitTaskYaml(sampleCommit, {});
		expect(task.prompt).not.toMatch(/^feat:/);
		expect(task.prompt).toContain("user authentication module");
	});

	test("converts past-tense to imperative in prompt", () => {
		const commit = {
			...sampleCommit,
			message: "fix: fixed null pointer in parser",
		};
		const task = emitTaskYaml(commit, {});
		expect(task.prompt).toMatch(/^Fix/);
	});

	test("appends diff summary when commit message is terse", () => {
		const commit = {
			...sampleCommit,
			message: "fix: typo",
		};
		const task = emitTaskYaml(commit, {});
		expect(task.prompt).toContain("Files changed:");
		expect(task.prompt).toContain("+120/-5");
	});

	test("uses descriptive message as-is for long prompts", () => {
		const task = emitTaskYaml(sampleCommit, {});
		// "add user authentication module" is > 20 chars, no diff summary appended
		expect(task.prompt).not.toContain("Files changed:");
	});

	test("respects harness override", () => {
		const task = emitTaskYaml(sampleCommit, { harness: "claude-code" });
		expect(task.harness).toBe("claude-code");
	});

	test("respects timeout override", () => {
		const task = emitTaskYaml(sampleCommit, { timeout: 600 });
		expect(task.timeout).toBe(600);
	});

	test("includes snapshot metadata when provided", () => {
		const snapshot = { "CLAUDE.md": "# Instructions\nDo the thing." };
		const task = emitTaskYaml(sampleCommit, {}, { snapshot });
		expect(task.instructionSnapshot).toEqual(snapshot);
		expect(task.sourceCommit).toBe(sampleCommit.hash);
		expect(task.detectionConfidence).toBe(0.9);
		expect(task.harvestDate).toBeDefined();
		// harvestDate should be a valid ISO string
		expect(Number.isNaN(Date.parse(task.harvestDate as string))).toBe(false);
	});

	test("omits snapshot fields when no metadata provided", () => {
		const task = emitTaskYaml(sampleCommit, {});
		expect(task.instructionSnapshot).toBeUndefined();
		expect(task.sourceCommit).toBeUndefined();
		expect(task.detectionConfidence).toBeUndefined();
		expect(task.harvestDate).toBeUndefined();
	});

	test("commit with test files gets test-pass assertion", () => {
		const commit: AICommit = {
			...sampleCommit,
			filesChanged: ["src/auth.ts", "tests/auth.test.ts"],
		};
		const task = emitTaskYaml(commit, {});
		const testPass = task.assertions.find((a) => a.type === "test-pass");
		expect(testPass).toBeDefined();
		expect(testPass?.command).toBeDefined();
	});

	test("commit without test files has no test-pass assertion", () => {
		const commit: AICommit = {
			...sampleCommit,
			filesChanged: ["src/auth.ts", "src/utils.ts"],
		};
		const task = emitTaskYaml(commit, {});
		const testPass = task.assertions.find((a) => a.type === "test-pass");
		expect(testPass).toBeUndefined();
	});

	test("detects various test file patterns", () => {
		const patterns = [
			"tests/auth.test.ts",
			"src/auth.spec.ts",
			"__tests__/foo.ts",
			"test/helpers.ts",
		];
		for (const file of patterns) {
			const commit: AICommit = {
				...sampleCommit,
				filesChanged: [file],
				diffStat: { additions: 10, deletions: 0, filesChanged: 1 },
			};
			const task = emitTaskYaml(commit, {});
			const testPass = task.assertions.find((a) => a.type === "test-pass");
			expect(testPass).toBeDefined();
		}
	});

	test("detectTestCommand returns bun test for this repo", () => {
		const cmd = detectTestCommand(repoRoot);
		expect(cmd).toBe("bun test");
	});

	test("detectTestCommand returns fallback for non-existent path", () => {
		const cmd = detectTestCommand("/non/existent/path");
		expect(cmd).toBe("bun test");
	});

	test("detectTestCommand returns fallback when no repoPath given", () => {
		const cmd = detectTestCommand();
		expect(cmd).toBe("bun test");
	});
});

// ──────────────────────────────────────────────
// writeTaskFile() — real filesystem tests
// ──────────────────────────────────────────────

describe("writeTaskFile", () => {
	const tmpDir = join(import.meta.dir, "../.tmp-harvest-test");

	const sampleTask = {
		name: "harvest-abc123d",
		description: "feat: add auth",
		prompt: "Add auth",
		harness: "auto" as const,
		timeout: 300,
		assertions: [{ type: "files-changed" as const, pattern: "src/auth.ts" }],
		scoring: { correctness: 0.5, precision: 0.3, efficiency: 0.1, conventions: 0.1 },
	};

	// Clean up before and after
	const cleanup = () => {
		if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
	};

	test("writes YAML file to output directory", () => {
		cleanup();
		const path = writeTaskFile(sampleTask, tmpDir, false);
		expect(path).not.toBeNull();
		expect(existsSync(path as string)).toBe(true);
		cleanup();
	});

	test("creates output directory if missing", () => {
		cleanup();
		const nestedDir = join(tmpDir, "nested", "deep");
		const path = writeTaskFile(sampleTask, nestedDir, false);
		expect(path).not.toBeNull();
		expect(existsSync(nestedDir)).toBe(true);
		cleanup();
	});

	test("skips existing file when force=false", () => {
		cleanup();
		writeTaskFile(sampleTask, tmpDir, false);
		const second = writeTaskFile(sampleTask, tmpDir, false);
		expect(second).toBeNull();
		cleanup();
	});

	test("overwrites existing file when force=true", () => {
		cleanup();
		writeTaskFile(sampleTask, tmpDir, false);
		const second = writeTaskFile(sampleTask, tmpDir, true);
		expect(second).not.toBeNull();
		cleanup();
	});

	test("produced YAML is parseable and matches schema", () => {
		cleanup();
		const path = writeTaskFile(sampleTask, tmpDir, false);
		expect(path).not.toBeNull();
		const raw = readFileSync(path as string, "utf-8");
		const parsed = parseYaml(raw);
		expect(parsed.name).toBe("harvest-abc123d");
		expect(parsed.harness).toBe("auto");
		expect(parsed.timeout).toBe(300);
		expect(parsed.assertions).toHaveLength(1);
		expect(parsed.scoring.correctness).toBe(0.5);
		cleanup();
	});
});

// ──────────────────────────────────────────────
// harvest() — orchestrator integration tests
// ──────────────────────────────────────────────

describe("harvest", () => {
	const tmpDir = join(import.meta.dir, "../.tmp-harvest-integration");

	const cleanup = () => {
		if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
	};

	test("runs end-to-end on the agenteval repo", async () => {
		cleanup();
		const result = await harvest({
			repoPath: repoRoot,
			outputDir: tmpDir,
		});
		expect(result.commitsScanned).toBeGreaterThan(0);
		expect(result.aiCommitsDetected).toBeGreaterThan(0);
		expect(result.tasksEmitted).toBeGreaterThan(0);
		expect(result.tasks.length).toBe(result.tasksEmitted);
		// Verify files actually exist
		for (const path of result.tasks) {
			expect(existsSync(path)).toBe(true);
		}
		cleanup();
	});

	test("dry-run returns results without writing files", async () => {
		cleanup();
		const result = await harvest({
			repoPath: repoRoot,
			dryRun: true,
		});
		expect(result.aiCommitsDetected).toBeGreaterThan(0);
		expect(result.tasksEmitted).toBe(0);
		expect(result.tasks.length).toBeGreaterThan(0); // task names, not file paths
		expect(existsSync(tmpDir)).toBe(false); // dir not created
		cleanup();
	});

	test("dry-run populates commitSummaries with required fields", async () => {
		const result = await harvest({
			repoPath: repoRoot,
			dryRun: true,
		});
		const summaries = result.commitSummaries;
		expect(summaries).toBeDefined();
		expect(summaries?.length).toBeGreaterThan(0);
		for (const summary of summaries ?? []) {
			expect(typeof summary.shortHash).toBe("string");
			expect(summary.shortHash.length).toBeGreaterThan(0);
			expect(typeof summary.tool).toBe("string");
			expect(summary.tool.length).toBeGreaterThan(0);
			expect(typeof summary.confidence).toBe("number");
			expect(summary.confidence).toBeGreaterThan(0);
			expect(typeof summary.message).toBe("string");
			expect(summary.message.length).toBeGreaterThan(0);
			expect(summary.message.length).toBeLessThanOrEqual(50);
		}
	});

	test("filters by minConfidence threshold", async () => {
		// Confidence 1.0 should filter out everything (max is 0.9)
		const result = await harvest({
			repoPath: repoRoot,
			minConfidence: 1.0,
			dryRun: true,
		});
		expect(result.aiCommitsDetected).toBe(0);
	});

	test("returns error for non-repo path", async () => {
		await expect(harvest({ repoPath: "/tmp" })).rejects.toThrow("Not a git repository");
	});
});
