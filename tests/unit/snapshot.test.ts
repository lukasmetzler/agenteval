import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { diffInstructionSnapshots, getInstructionSnapshot } from "../../src/harvest/snapshot.js";

const repoRoot = join(import.meta.dir, "../..");

// ──────────────────────────────────────────────
// getInstructionSnapshot() — real repo tests
// ──────────────────────────────────────────────

describe("getInstructionSnapshot", () => {
	test("returns content for CLAUDE.md at a known commit", async () => {
		// Get a commit that has CLAUDE.md in its parent
		const proc = Bun.spawn(["git", "log", "--format=%H", "-1", "--", "CLAUDE.md"], {
			cwd: repoRoot,
			stdout: "pipe",
		});
		await proc.exited;
		const hash = (await new Response(proc.stdout).text()).trim();

		const snapshot = await getInstructionSnapshot(repoRoot, hash, ["CLAUDE.md"]);
		expect(Object.keys(snapshot)).toContain("CLAUDE.md");
		expect(snapshot["CLAUDE.md"].length).toBeGreaterThan(0);
	});

	test("returns empty map for non-existent file globs", async () => {
		const proc = Bun.spawn(["git", "log", "--format=%H", "-1"], {
			cwd: repoRoot,
			stdout: "pipe",
		});
		await proc.exited;
		const hash = (await new Response(proc.stdout).text()).trim();

		const snapshot = await getInstructionSnapshot(repoRoot, hash, ["NONEXISTENT.md"]);
		expect(Object.keys(snapshot)).toHaveLength(0);
	});

	test("matches multiple files with broad globs", async () => {
		const proc = Bun.spawn(["git", "log", "--format=%H", "-1"], {
			cwd: repoRoot,
			stdout: "pipe",
		});
		await proc.exited;
		const hash = (await new Response(proc.stdout).text()).trim();

		const snapshot = await getInstructionSnapshot(repoRoot, hash, ["CLAUDE.md", "*.md"]);
		// Should find at least CLAUDE.md and README.md
		expect(Object.keys(snapshot).length).toBeGreaterThanOrEqual(2);
		expect(Object.keys(snapshot)).toContain("CLAUDE.md");
	});

	test("returns empty map for initial commit (no parent)", async () => {
		// Get the very first commit
		const proc = Bun.spawn(["git", "rev-list", "--max-parents=0", "HEAD"], {
			cwd: repoRoot,
			stdout: "pipe",
		});
		await proc.exited;
		const hash = (await new Response(proc.stdout).text()).trim().split("\n")[0];

		const snapshot = await getInstructionSnapshot(repoRoot, hash, ["CLAUDE.md"]);
		expect(Object.keys(snapshot)).toHaveLength(0);
	});
});

// ──────────────────────────────────────────────
// diffInstructionSnapshots() — pure function tests
// ──────────────────────────────────────────────

describe("diffInstructionSnapshots", () => {
	test("classifies all four states correctly", () => {
		const a: Record<string, string> = {
			"CLAUDE.md": "v1 content",
			"AGENTS.md": "agents content",
			"OLD.md": "removed content",
		};
		const b: Record<string, string> = {
			"CLAUDE.md": "v2 content",
			"AGENTS.md": "agents content",
			"NEW.md": "added content",
		};

		const diff = diffInstructionSnapshots(a, b);

		expect(diff["CLAUDE.md"]).toBe("changed");
		expect(diff["AGENTS.md"]).toBe("unchanged");
		expect(diff["OLD.md"]).toBe("removed");
		expect(diff["NEW.md"]).toBe("added");
	});

	test("returns empty result for two empty maps", () => {
		const diff = diffInstructionSnapshots({}, {});
		expect(Object.keys(diff)).toHaveLength(0);
	});

	test("all added when a is empty", () => {
		const diff = diffInstructionSnapshots({}, { "CLAUDE.md": "content" });
		expect(diff["CLAUDE.md"]).toBe("added");
	});

	test("all removed when b is empty", () => {
		const diff = diffInstructionSnapshots({ "CLAUDE.md": "content" }, {});
		expect(diff["CLAUDE.md"]).toBe("removed");
	});
});
