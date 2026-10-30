import { describe, expect, test } from "bun:test";
import { compareArms, isPass, stat, summarizeTrials } from "../../src/run/trials.js";
import type { StoredResult } from "../../src/run/types.js";

function result(overrides: {
	status?: StoredResult["status"];
	passed?: boolean[];
	overall?: number | null;
	tokens?: number | null;
	cost?: number | null;
}): StoredResult {
	return {
		id: "r",
		timestamp: "2026-10-30T00:00:00Z",
		task: "t",
		harness: "mock",
		instructions: "CLAUDE.md",
		status: overrides.status ?? "success",
		metrics: {
			tokensInput: null,
			tokensOutput: null,
			tokensTotal: overrides.tokens ?? null,
			tokenSource: overrides.tokens == null ? "unavailable" : "api",
			costUsd: overrides.cost ?? null,
		},
		scores: {
			correctness: null,
			precision: null,
			efficiency: null,
			conventions: null,
			overall: overrides.overall ?? null,
		},
		assertions: (overrides.passed ?? []).map((passed) => ({
			type: "test-pass",
			expected: "",
			actual: "",
			passed,
		})),
		diffSummary: "",
		model: null,
	};
}

describe("stat", () => {
	test("sample mean and standard deviation, ignoring nulls", () => {
		const s = stat([2, 4, 4, 4, 5, 5, 7, 9, null]);
		expect(s?.mean).toBe(5);
		expect(s?.stddev).toBeCloseTo(2.138, 3);
		expect(s?.n).toBe(8);
	});

	test("null when there is no data, zero spread for one value", () => {
		expect(stat([null, undefined])).toBeNull();
		expect(stat([3])).toEqual({ mean: 3, stddev: 0, n: 1 });
	});
});

describe("isPass", () => {
	test("requires success and every assertion passing", () => {
		expect(isPass(result({ passed: [true, true] }))).toBe(true);
		expect(isPass(result({ passed: [true, false] }))).toBe(false);
		expect(isPass(result({ status: "timeout" }))).toBe(false);
		expect(isPass(result({}))).toBe(true);
	});
});

describe("summarizeTrials", () => {
	test("pass@k is any pass, pass^k is all pass", () => {
		const mixed = summarizeTrials([result({ passed: [true] }), result({ passed: [false] })]);
		expect([mixed.passes, mixed.passRate, mixed.passAtK, mixed.passAllK]).toEqual([
			1,
			0.5,
			true,
			false,
		]);
		const none = summarizeTrials([]);
		expect([none.passAtK, none.passAllK, none.passRate]).toEqual([false, false, 0]);
	});
});

describe("compareArms", () => {
	test("reports treatment minus baseline, null when a side lacks data", () => {
		const withInstructions = summarizeTrials([
			result({ passed: [true], overall: 0.9, tokens: 1000 }),
			result({ passed: [true], overall: 0.7, tokens: 1200 }),
		]);
		const baseline = summarizeTrials([
			result({ passed: [false], overall: 0.5, tokens: 2000 }),
			result({ passed: [true], overall: 0.7, tokens: 1800 }),
		]);
		const d = compareArms(withInstructions, baseline);
		expect(d.passRate).toBe(0.5);
		expect(d.score).toBeCloseTo(0.2, 10);
		expect(d.tokens).toBe(-800);
		expect(d.costUsd).toBeNull();
	});
});
