import { describe, expect, test } from "bun:test";
import { computeTaskSummary, detectTrend, formatTrend } from "../../src/commands/trends.js";
import type { StoredResult } from "../../src/run/types.js";

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

describe("detectTrend", () => {
	test("all increasing scores returns improving", () => {
		expect(detectTrend([0.5, 0.6, 0.7, 0.8])).toBe("improving");
	});

	test("all decreasing scores returns regressing", () => {
		expect(detectTrend([0.9, 0.8, 0.7, 0.6])).toBe("regressing");
	});

	test("mixed scores returns stable", () => {
		expect(detectTrend([0.5, 0.7, 0.6, 0.8])).toBe("stable");
	});

	test("single score returns stable", () => {
		expect(detectTrend([0.5])).toBe("stable");
	});

	test("flat scores (identical) returns stable", () => {
		expect(detectTrend([0.5, 0.5, 0.5])).toBe("stable");
	});

	test("empty array returns stable", () => {
		expect(detectTrend([])).toBe("stable");
	});

	test("two increasing scores returns improving", () => {
		expect(detectTrend([0.5, 0.7])).toBe("improving");
	});

	test("two decreasing scores returns regressing", () => {
		expect(detectTrend([0.7, 0.5])).toBe("regressing");
	});

	test("scores within tolerance (0.01) treated as flat", () => {
		expect(detectTrend([0.5, 0.505, 0.51])).toBe("stable");
	});

	test("only last 3 scores matter for long series", () => {
		// First scores go up, but last 3 go down
		expect(detectTrend([0.3, 0.5, 0.7, 0.9, 0.85, 0.8])).toBe("regressing");
	});
});

describe("computeTaskSummary", () => {
	test("computes correct latest, best, worst, average", () => {
		const results = [
			makeResult({
				id: "run-1",
				timestamp: "2026-04-01T10:00:00Z",
				scores: { correctness: 1, precision: 1, efficiency: 1, conventions: 1, overall: 0.72 },
			}),
			makeResult({
				id: "run-2",
				timestamp: "2026-04-02T10:00:00Z",
				scores: { correctness: 1, precision: 1, efficiency: 1, conventions: 1, overall: 0.85 },
			}),
			makeResult({
				id: "run-3",
				timestamp: "2026-04-03T10:00:00Z",
				scores: { correctness: 1, precision: 1, efficiency: 1, conventions: 1, overall: 0.91 },
			}),
		];

		const summary = computeTaskSummary("test-task", results);

		expect(summary.task).toBe("test-task");
		expect(summary.runs).toBe(3);
		expect(summary.latest).toBe(0.91);
		expect(summary.best).toBe(0.91);
		expect(summary.worst).toBe(0.72);
		expect(summary.average).toBeCloseTo(0.8267, 2);
		expect(summary.trend).toBe("improving");
	});

	test("history deltas are correct (first is null, rest are differences)", () => {
		const results = [
			makeResult({
				id: "run-1",
				timestamp: "2026-04-01T10:00:00Z",
				scores: { correctness: 1, precision: 1, efficiency: 1, conventions: 1, overall: 0.5 },
			}),
			makeResult({
				id: "run-2",
				timestamp: "2026-04-02T10:00:00Z",
				scores: { correctness: 1, precision: 1, efficiency: 1, conventions: 1, overall: 0.7 },
			}),
			makeResult({
				id: "run-3",
				timestamp: "2026-04-03T10:00:00Z",
				scores: { correctness: 1, precision: 1, efficiency: 1, conventions: 1, overall: 0.65 },
			}),
		];

		const summary = computeTaskSummary("test-task", results);

		expect(summary.history[0].delta).toBeNull();
		expect(summary.history[1].delta).toBeCloseTo(0.2, 2);
		expect(summary.history[2].delta).toBeCloseTo(-0.05, 2);
	});

	test("sorts by timestamp ascending regardless of input order", () => {
		const results = [
			makeResult({
				id: "run-3",
				timestamp: "2026-04-03T10:00:00Z",
				scores: { correctness: 1, precision: 1, efficiency: 1, conventions: 1, overall: 0.91 },
			}),
			makeResult({
				id: "run-1",
				timestamp: "2026-04-01T10:00:00Z",
				scores: { correctness: 1, precision: 1, efficiency: 1, conventions: 1, overall: 0.72 },
			}),
			makeResult({
				id: "run-2",
				timestamp: "2026-04-02T10:00:00Z",
				scores: { correctness: 1, precision: 1, efficiency: 1, conventions: 1, overall: 0.85 },
			}),
		];

		const summary = computeTaskSummary("test-task", results);

		expect(summary.history[0].id).toBe("run-1");
		expect(summary.history[1].id).toBe("run-2");
		expect(summary.history[2].id).toBe("run-3");
	});

	test("handles null overall score as 0", () => {
		const results = [
			makeResult({
				id: "run-1",
				timestamp: "2026-04-01T10:00:00Z",
				scores: {
					correctness: null,
					precision: null,
					efficiency: null,
					conventions: null,
					overall: null,
				},
			}),
		];

		const summary = computeTaskSummary("test-task", results);

		expect(summary.latest).toBe(0);
		expect(summary.best).toBe(0);
		expect(summary.worst).toBe(0);
		expect(summary.average).toBe(0);
	});

	test("extracts date from ISO timestamp", () => {
		const results = [
			makeResult({
				id: "run-1",
				timestamp: "2026-04-01T14:30:22Z",
				scores: { correctness: 1, precision: 1, efficiency: 1, conventions: 1, overall: 0.8 },
			}),
		];

		const summary = computeTaskSummary("test-task", results);

		expect(summary.history[0].date).toBe("2026-04-01");
	});
});

describe("formatTrend", () => {
	test("improving includes up arrow", () => {
		const result = formatTrend("improving");
		expect(result).toContain("\u2191");
	});

	test("regressing includes down arrow", () => {
		const result = formatTrend("regressing");
		expect(result).toContain("\u2193");
	});

	test("stable includes right arrow", () => {
		const result = formatTrend("stable");
		expect(result).toContain("\u2192");
	});
});
