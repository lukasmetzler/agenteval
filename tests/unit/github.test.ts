import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { emitTaskYaml } from "../../src/harvest/emit.js";
import type { PRInfo } from "../../src/harvest/github.js";
import { findPRForCommit, isGhAvailable } from "../../src/harvest/github.js";
import type { AICommit } from "../../src/harvest/types.js";

const repoRoot = join(import.meta.dir, "../..");

// ──────────────────────────────────────────────
// isGhAvailable() — runs on any machine
// ──────────────────────────────────────────────

describe("isGhAvailable", () => {
	test("returns a boolean", async () => {
		const result = await isGhAvailable();
		expect(typeof result).toBe("boolean");
	});
});

// ──────────────────────────────────────────────
// findPRForCommit() — conditional on gh being installed
// ──────────────────────────────────────────────

const ghAvailable = await isGhAvailable();

describe("findPRForCommit", () => {
	test.skipIf(!ghAvailable)("finds PR for known merged commit", async () => {
		// Use the commit from merged PR #14 (fix: harvest cleanup)
		const result = await findPRForCommit(repoRoot, "85ad0ea");
		expect(result).not.toBeNull();
		if (result) {
			expect(result.number).toBe(14);
			expect(result.url).toContain("pull/14");
			expect(typeof result.body).toBe("string");
			expect(Array.isArray(result.labels)).toBe(true);
		}
	});

	test.skipIf(!ghAvailable)("returns null for non-existent commit hash", async () => {
		const result = await findPRForCommit(repoRoot, "0000000000000000000000000000000000000000");
		expect(result).toBeNull();
	});
});

// ──────────────────────────────────────────────
// emitTaskYaml() with PRInfo — pure function tests
// ──────────────────────────────────────────────

const makeSampleCommit = (overrides: Partial<AICommit> = {}): AICommit => ({
	hash: "abc123def456",
	shortHash: "abc123d",
	message: "fix: typo",
	author: "dev@example.com",
	coAuthors: ["Claude <noreply@anthropic.com>"],
	detectionMethod: "co-author-tag",
	confidence: 0.9,
	timestamp: new Date("2026-01-15T10:00:00Z"),
	filesChanged: ["src/main.ts"],
	diffStat: { additions: 3, deletions: 1, filesChanged: 1 },
	...overrides,
});

const samplePRInfo: PRInfo = {
	number: 42,
	url: "https://github.com/example/repo/pull/42",
	body: "This PR fixes a critical typo in the authentication module that caused login failures.",
	labels: ["bug", "high-priority"],
};

describe("emitTaskYaml with PRInfo", () => {
	test("enriches terse prompt with PR context", () => {
		const commit = makeSampleCommit({ message: "fix: typo" });
		const task = emitTaskYaml(commit, {}, { prInfo: samplePRInfo });
		expect(task.prompt).toContain("PR context:");
		expect(task.prompt).toContain("critical typo");
	});

	test("does NOT enrich descriptive messages with PR context", () => {
		const commit = makeSampleCommit({
			message: "feat: add user authentication module with session management",
		});
		const task = emitTaskYaml(commit, {}, { prInfo: samplePRInfo });
		expect(task.prompt).not.toContain("PR context:");
	});

	test("populates prUrl field from PRInfo", () => {
		const commit = makeSampleCommit();
		const task = emitTaskYaml(commit, {}, { prInfo: samplePRInfo });
		expect(task.prUrl).toBe("https://github.com/example/repo/pull/42");
	});

	test("populates prBody field from PRInfo", () => {
		const commit = makeSampleCommit();
		const task = emitTaskYaml(commit, {}, { prInfo: samplePRInfo });
		expect(task.prBody).toBe(samplePRInfo.body);
	});

	test("does not set prUrl/prBody when no PRInfo provided", () => {
		const commit = makeSampleCommit();
		const task = emitTaskYaml(commit, {});
		expect(task.prUrl).toBeUndefined();
		expect(task.prBody).toBeUndefined();
	});

	test("does not enrich with empty PR body", () => {
		const commit = makeSampleCommit({ message: "fix: typo" });
		const emptyPR: PRInfo = { ...samplePRInfo, body: "" };
		const task = emitTaskYaml(commit, {}, { prInfo: emptyPR });
		expect(task.prompt).not.toContain("PR context:");
	});

	test("passes through snapshot metadata", () => {
		const commit = makeSampleCommit();
		const snapshot = { "CLAUDE.md": "abc123" };
		const task = emitTaskYaml(commit, {}, { snapshot });
		expect(task.instructionSnapshot).toEqual(snapshot);
	});
});
