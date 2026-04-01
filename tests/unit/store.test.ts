import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import type { StoredResult } from "../../src/run/types.js";
import {
	listResults,
	parseRetention,
	pruneResults,
	readResult,
	writeResult,
} from "../../src/store/index.js";

const tmpDir = join(import.meta.dir, "../.tmp-store-test");
const resultsDir = join(tmpDir, "results");

function makeResult(overrides: Partial<StoredResult> = {}): StoredResult {
	return {
		id: "run-20260402-120000",
		timestamp: "2026-04-02T12:00:00Z",
		task: "test-task",
		harness: "mock",
		instructions: "CLAUDE.md",
		status: "success",
		metrics: { tokensInput: null, tokensOutput: null, tokensTotal: 5000, tokenSource: "estimated" },
		scores: { correctness: 1, precision: 1, efficiency: 0.9, conventions: 1, overall: 0.97 },
		assertions: [],
		diffSummary: "1 file(s) changed",
		model: null,
		...overrides,
	};
}

beforeEach(() => {
	mkdirSync(resultsDir, { recursive: true });
});

afterEach(() => {
	if (existsSync(tmpDir)) {
		rmSync(tmpDir, { recursive: true, force: true });
	}
});

describe("writeResult + readResult", () => {
	test("roundtrips a result to disk and back", () => {
		const result = makeResult();
		writeResult(result, resultsDir);
		const loaded = readResult("run-20260402-120000", resultsDir);
		expect(loaded).not.toBeNull();
		expect(loaded?.id).toBe("run-20260402-120000");
		expect(loaded?.scores.overall).toBe(0.97);
	});

	test("returns null for non-existent run ID", () => {
		const loaded = readResult("run-nonexistent", resultsDir);
		expect(loaded).toBeNull();
	});
});

describe("listResults", () => {
	test("lists results sorted by timestamp descending", () => {
		writeResult(
			makeResult({ id: "run-20260402-100000", timestamp: "2026-04-02T10:00:00Z" }),
			resultsDir,
		);
		writeResult(
			makeResult({ id: "run-20260402-120000", timestamp: "2026-04-02T12:00:00Z" }),
			resultsDir,
		);
		writeResult(
			makeResult({ id: "run-20260402-110000", timestamp: "2026-04-02T11:00:00Z" }),
			resultsDir,
		);

		const results = listResults(resultsDir);
		expect(results).toHaveLength(3);
		expect(results[0].id).toBe("run-20260402-120000");
		expect(results[2].id).toBe("run-20260402-100000");
	});

	test("filters by task name", () => {
		writeResult(makeResult({ id: "run-1", task: "auth" }), resultsDir);
		writeResult(makeResult({ id: "run-2", task: "billing" }), resultsDir);

		const results = listResults(resultsDir, { task: "auth" });
		expect(results).toHaveLength(1);
		expect(results[0].task).toBe("auth");
	});

	test("filters by status", () => {
		writeResult(makeResult({ id: "run-1", status: "success" }), resultsDir);
		writeResult(makeResult({ id: "run-2", status: "error", error: "failed" }), resultsDir);

		const results = listResults(resultsDir, { status: "success" });
		expect(results).toHaveLength(1);
	});

	test("respects limit", () => {
		writeResult(makeResult({ id: "run-1", timestamp: "2026-04-02T10:00:00Z" }), resultsDir);
		writeResult(makeResult({ id: "run-2", timestamp: "2026-04-02T11:00:00Z" }), resultsDir);
		writeResult(makeResult({ id: "run-3", timestamp: "2026-04-02T12:00:00Z" }), resultsDir);

		const results = listResults(resultsDir, { limit: 2 });
		expect(results).toHaveLength(2);
	});

	test("returns empty array for non-existent directory", () => {
		const results = listResults("/tmp/nonexistent-dir-abc");
		expect(results).toHaveLength(0);
	});
});

describe("pruneResults", () => {
	test("removes results older than retention", () => {
		const oldDate = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString();
		writeResult(makeResult({ id: "old-run", timestamp: oldDate }), resultsDir);
		writeResult(makeResult({ id: "new-run", timestamp: new Date().toISOString() }), resultsDir);

		const pruned = pruneResults(resultsDir, 90);
		expect(pruned).toBe(1);

		const remaining = listResults(resultsDir);
		expect(remaining).toHaveLength(1);
		expect(remaining[0].id).toBe("new-run");
	});
});

describe("parseRetention", () => {
	test("parses '90d' to 90", () => {
		expect(parseRetention("90d")).toBe(90);
	});

	test("parses '30d' to 30", () => {
		expect(parseRetention("30d")).toBe(30);
	});

	test("throws on invalid format", () => {
		expect(() => parseRetention("invalid")).toThrow();
	});
});
