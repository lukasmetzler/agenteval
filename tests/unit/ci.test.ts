import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { $ } from "bun";
import { findPreviousResult } from "../../src/commands/ci.js";
import { ConfigSchema } from "../../src/config/schema.js";
import type { StoredResult } from "../../src/run/types.js";

describe("CI config schema", () => {
	test("accepts CI options", () => {
		const config = ConfigSchema.parse({
			version: 1,
			ci: { minScore: 0.7, maxRegression: 0.05 },
		});
		expect(config.ci.minScore).toBe(0.7);
		expect(config.ci.maxRegression).toBe(0.05);
		expect(config.ci.tasksDir).toBe("tasks/harvested");
		expect(config.ci.instructions).toBe("CLAUDE.md");
	});

	test("uses defaults when ci section omitted", () => {
		const config = ConfigSchema.parse({ version: 1 });
		expect(config.ci.minScore).toBe(0.5);
		expect(config.ci.maxRegression).toBe(0.1);
		expect(config.ci.tasksDir).toBe("tasks/harvested");
		expect(config.ci.instructions).toBe("CLAUDE.md");
	});
});

function makeStoredResult(overrides: Partial<StoredResult>): StoredResult {
	return {
		id: "run-001",
		timestamp: new Date().toISOString(),
		task: "test-task",
		harness: "mock",
		instructions: "CLAUDE.md",
		status: "success",
		metrics: {
			tokensInput: null,
			tokensOutput: null,
			tokensTotal: null,
			tokenSource: "unavailable",
		},
		scores: {
			correctness: null,
			precision: null,
			efficiency: null,
			conventions: null,
			overall: 0.8,
		},
		assertions: [],
		diffSummary: "",
		model: null,
		...overrides,
	};
}

describe("findPreviousResult", () => {
	test("skips current run and returns previous", () => {
		const tmp = mkdtempSync(join(tmpdir(), "agenteval-ci-test-"));
		try {
			mkdirSync(tmp, { recursive: true });

			const previous = makeStoredResult({
				id: "run-001",
				task: "my-task",
				timestamp: "2026-01-01T00:00:00Z",
				scores: {
					correctness: null,
					precision: null,
					efficiency: null,
					conventions: null,
					overall: 0.75,
				},
			});
			const current = makeStoredResult({
				id: "run-002",
				task: "my-task",
				timestamp: "2026-01-02T00:00:00Z",
				scores: {
					correctness: null,
					precision: null,
					efficiency: null,
					conventions: null,
					overall: 0.85,
				},
			});

			writeFileSync(join(tmp, "run-001.json"), JSON.stringify(previous), "utf-8");
			writeFileSync(join(tmp, "run-002.json"), JSON.stringify(current), "utf-8");

			const result = findPreviousResult(tmp, "my-task", "run-002");
			expect(result).not.toBeNull();
			expect(result?.id).toBe("run-001");
			expect(result?.scores.overall).toBe(0.75);
		} finally {
			rmSync(tmp, { recursive: true, force: true });
		}
	});

	test("returns null when no history exists", () => {
		const tmp = mkdtempSync(join(tmpdir(), "agenteval-ci-test-"));
		try {
			const result = findPreviousResult(tmp, "my-task", "run-001");
			expect(result).toBeNull();
		} finally {
			rmSync(tmp, { recursive: true, force: true });
		}
	});
});

describe("CI CLI", () => {
	test("ci subcommand appears in help", async () => {
		const result = await $`bun run src/cli.ts --help`.text();
		expect(result).toContain("ci");
	});

	test("ci --help shows options", async () => {
		const result = await $`bun run src/cli.ts ci --help`.text();
		expect(result).toContain("--tasks-dir");
		expect(result).toContain("--min-score");
		expect(result).toContain("--max-regression");
		expect(result).toContain("--instructions");
		expect(result).toContain("--harness");
	});

	test("ci without tasks shows helpful error", async () => {
		const tmp = mkdtempSync(join(tmpdir(), "agenteval-ci-empty-"));
		try {
			const proc = await $`bun run src/cli.ts ci --tasks-dir ${tmp}`.nothrow().quiet();
			expect(proc.exitCode).not.toBe(0);
			const stderr = proc.stderr.toString();
			expect(stderr).toContain("harvest");
		} finally {
			rmSync(tmp, { recursive: true, force: true });
		}
	});
});
