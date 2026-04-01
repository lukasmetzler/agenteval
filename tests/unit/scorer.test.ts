import { describe, expect, test } from "bun:test";
import { scoreRun } from "../../src/run/scorer.js";
import type { RunMetrics, ScoringWeights } from "../../src/run/types.js";

const defaultWeights: ScoringWeights = {
	correctness: 0.4,
	precision: 0.3,
	efficiency: 0.2,
	conventions: 0.1,
};

const availableMetrics: RunMetrics = {
	tokensInput: 5000,
	tokensOutput: 3000,
	tokensTotal: 8000,
	tokenSource: "api",
};

const unavailableMetrics: RunMetrics = {
	tokensInput: null,
	tokensOutput: null,
	tokensTotal: null,
	tokenSource: "unavailable",
};

describe("scoreRun", () => {
	test("all assertions pass -> high scores", () => {
		const { scores } = scoreRun({
			assertions: [
				{ type: "files-changed", pattern: "src/**", expect: "modified" },
				{ type: "test-pass", command: "bun test" },
			],
			weights: defaultWeights,
			changedFiles: ["src/auth.ts"],
			diff: "+logger.info('test')",
			testResults: new Map([["bun test", { passed: true, output: "ok" }]]),
			metrics: availableMetrics,
			tokensBudget: 50_000,
			expectedFilePatterns: ["src/**"],
		});

		expect(scores.correctness).toBe(1);
		expect(scores.precision).toBe(1);
		expect(scores.overall).toBeGreaterThan(0.8);
	});

	test("some assertions fail -> partial correctness", () => {
		const { scores } = scoreRun({
			assertions: [
				{ type: "files-changed", pattern: "src/auth/**", expect: "modified" },
				{ type: "test-pass", command: "bun test" },
			],
			weights: defaultWeights,
			changedFiles: ["src/billing/invoice.ts"],
			diff: "",
			testResults: new Map([["bun test", { passed: false, output: "fail" }]]),
			metrics: availableMetrics,
			tokensBudget: 50_000,
			expectedFilePatterns: ["src/auth/**"],
		});

		expect(scores.correctness).toBe(0);
	});

	test("zero files changed with expected patterns -> precision 0", () => {
		const { scores } = scoreRun({
			assertions: [{ type: "files-changed", pattern: "src/**", expect: "modified" }],
			weights: defaultWeights,
			changedFiles: [],
			diff: "",
			testResults: new Map(),
			metrics: availableMetrics,
			tokensBudget: 50_000,
			expectedFilePatterns: ["src/**"],
		});

		expect(scores.precision).toBe(0);
	});

	test("zero files changed with no expected patterns -> precision 1", () => {
		const { scores } = scoreRun({
			assertions: [{ type: "test-pass", command: "bun test" }],
			weights: defaultWeights,
			changedFiles: [],
			diff: "",
			testResults: new Map([["bun test", { passed: true, output: "ok" }]]),
			metrics: availableMetrics,
			tokensBudget: 50_000,
			expectedFilePatterns: [],
		});

		expect(scores.precision).toBe(1);
	});

	test("tokens unavailable -> efficiency null, weights renormalized", () => {
		const { scores } = scoreRun({
			assertions: [{ type: "test-pass", command: "bun test" }],
			weights: defaultWeights,
			changedFiles: [],
			diff: "",
			testResults: new Map([["bun test", { passed: true, output: "ok" }]]),
			metrics: unavailableMetrics,
			tokensBudget: 50_000,
			expectedFilePatterns: [],
		});

		expect(scores.efficiency).toBeNull();
		expect(scores.overall).toBeGreaterThan(0);
	});

	test("empty assertions -> all scores null", () => {
		const { scores, assertionResults } = scoreRun({
			assertions: [],
			weights: defaultWeights,
			changedFiles: [],
			diff: "",
			testResults: new Map(),
			metrics: availableMetrics,
			tokensBudget: 50_000,
			expectedFilePatterns: [],
		});

		expect(scores.correctness).toBeNull();
		expect(scores.overall).toBeNull();
		expect(assertionResults).toHaveLength(0);
	});

	test("convention assertions scored separately", () => {
		const diff = "+logger.info('hello')";
		const { scores } = scoreRun({
			assertions: [
				{ type: "convention", pattern: "logger\\.info", expect: "present-in-changes" },
				{ type: "convention", pattern: "console\\.log", expect: "present-in-changes" },
			],
			weights: defaultWeights,
			changedFiles: [],
			diff,
			testResults: new Map(),
			metrics: unavailableMetrics,
			tokensBudget: 50_000,
			expectedFilePatterns: [],
		});

		expect(scores.conventions).toBe(0.5);
	});
});
