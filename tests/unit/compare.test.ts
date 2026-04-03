import { describe, expect, test } from "bun:test";
import type { StoredResult } from "../../src/run/types.js";
import {
	compareResults,
	formatComparisonConsole,
	formatComparisonMarkdown,
} from "../../src/store/compare.js";

function makeResult(overrides: Partial<StoredResult> = {}): StoredResult {
	return {
		id: "run-A",
		timestamp: "2026-04-02T12:00:00Z",
		task: "test-task",
		harness: "mock",
		instructions: "CLAUDE.md",
		status: "success",
		metrics: {
			tokensInput: null,
			tokensOutput: null,
			tokensTotal: 10000,
			tokenSource: "estimated",
		},
		scores: { correctness: 0.8, precision: 0.7, efficiency: 0.85, conventions: 0.9, overall: 0.78 },
		assertions: [],
		diffSummary: "3 files changed",
		model: null,
		...overrides,
	};
}

describe("compareResults", () => {
	test("identifies winner when B has higher overall", () => {
		const runA = makeResult({
			id: "run-A",
			scores: {
				correctness: 0.8,
				precision: 0.7,
				efficiency: 0.85,
				conventions: 0.9,
				overall: 0.78,
			},
		});
		const runB = makeResult({
			id: "run-B",
			scores: {
				correctness: 1.0,
				precision: 0.9,
				efficiency: 0.9,
				conventions: 1.0,
				overall: 0.93,
			},
		});

		const report = compareResults(runA, runB);
		expect(report.winner).toBe("b");
		expect(report.summary).toContain("run-B wins");
	});

	test("identifies winner when A has higher overall", () => {
		const runA = makeResult({
			id: "run-A",
			scores: {
				correctness: 1.0,
				precision: 1.0,
				efficiency: 0.95,
				conventions: 1.0,
				overall: 0.99,
			},
		});
		const runB = makeResult({
			id: "run-B",
			scores: { correctness: 0.5, precision: 0.5, efficiency: 0.5, conventions: 0.5, overall: 0.5 },
		});

		const report = compareResults(runA, runB);
		expect(report.winner).toBe("a");
		expect(report.summary).toContain("run-A wins");
	});

	test("reports tie when scores are equal", () => {
		const runA = makeResult({ id: "run-A" });
		const runB = makeResult({ id: "run-B" });

		const report = compareResults(runA, runB);
		expect(report.winner).toBe("tie");
		expect(report.summary).toContain("tied");
	});

	test("handles one run with null scores (failed run)", () => {
		const runA = makeResult({ id: "run-A" });
		const runB = makeResult({
			id: "run-B",
			status: "error",
			scores: {
				correctness: null,
				precision: null,
				efficiency: null,
				conventions: null,
				overall: null,
			},
		});

		const report = compareResults(runA, runB);
		expect(report.winner).toBe("a");
	});

	test("computes deltas for each metric", () => {
		const runA = makeResult({
			id: "run-A",
			scores: { correctness: 0.6, precision: 0.7, efficiency: 0.8, conventions: 0.9, overall: 0.7 },
		});
		const runB = makeResult({
			id: "run-B",
			scores: {
				correctness: 0.9,
				precision: 0.8,
				efficiency: 0.7,
				conventions: 1.0,
				overall: 0.85,
			},
		});

		const report = compareResults(runA, runB);
		const correctnessMetric = report.metrics.find((m) => m.name === "correctness");
		expect(correctnessMetric?.delta).toBeCloseTo(0.3);
		expect(correctnessMetric?.better).toBe("b");
	});
});

describe("formatComparisonConsole", () => {
	test("produces readable table output", () => {
		const runA = makeResult({ id: "run-A" });
		const runB = makeResult({
			id: "run-B",
			scores: {
				correctness: 1.0,
				precision: 0.9,
				efficiency: 0.9,
				conventions: 1.0,
				overall: 0.93,
			},
		});

		const output = formatComparisonConsole(compareResults(runA, runB));
		expect(output).toContain("run-A");
		expect(output).toContain("run-B");
		expect(output).toContain("Winner");
		expect(output).toContain("correctness");
	});
});

describe("formatComparisonMarkdown", () => {
	test("produces valid markdown table", () => {
		const runA = makeResult({ id: "run-A" });
		const runB = makeResult({ id: "run-B" });

		const output = formatComparisonMarkdown(compareResults(runA, runB));
		expect(output).toContain("# Comparison Report");
		expect(output).toContain("| Metric |");
		expect(output).toContain("**Winner:**");
	});
});

describe("snapshot-aware comparison", () => {
	test("detects changed CLAUDE.md when both results have snapshots", () => {
		const runA = makeResult({
			id: "run-A",
			instructionSnapshot: { "CLAUDE.md": "# Old content" },
		});
		const runB = makeResult({
			id: "run-B",
			instructionSnapshot: { "CLAUDE.md": "# New content" },
		});

		const report = compareResults(runA, runB);
		expect(report.instructionDiff).toBeDefined();
		expect(report.instructionDiff?.["CLAUDE.md"]).toBe("changed");
	});

	test("reports unchanged when both snapshots are identical", () => {
		const snapshot = { "CLAUDE.md": "# Same content", "AGENTS.md": "# Agents" };
		const runA = makeResult({
			id: "run-A",
			instructionSnapshot: snapshot,
		});
		const runB = makeResult({
			id: "run-B",
			instructionSnapshot: snapshot,
		});

		const report = compareResults(runA, runB);
		expect(report.instructionDiff).toBeDefined();
		expect(report.instructionDiff?.["CLAUDE.md"]).toBe("unchanged");
		expect(report.instructionDiff?.["AGENTS.md"]).toBe("unchanged");
	});

	test("detects added file when result B has new instruction file", () => {
		const runA = makeResult({
			id: "run-A",
			instructionSnapshot: { "CLAUDE.md": "# Content" },
		});
		const runB = makeResult({
			id: "run-B",
			instructionSnapshot: {
				"CLAUDE.md": "# Content",
				"AGENTS.md": "# New agents file",
			},
		});

		const report = compareResults(runA, runB);
		expect(report.instructionDiff).toBeDefined();
		expect(report.instructionDiff?.["AGENTS.md"]).toBe("added");
		expect(report.instructionDiff?.["CLAUDE.md"]).toBe("unchanged");
	});

	test("returns undefined instructionDiff when neither result has snapshots", () => {
		const runA = makeResult({ id: "run-A" });
		const runB = makeResult({ id: "run-B" });

		const report = compareResults(runA, runB);
		expect(report.instructionDiff).toBeUndefined();
	});

	test("returns undefined instructionDiff when only one result has snapshot", () => {
		const runA = makeResult({
			id: "run-A",
			instructionSnapshot: { "CLAUDE.md": "# Content" },
		});
		const runB = makeResult({ id: "run-B" });

		const report = compareResults(runA, runB);
		expect(report.instructionDiff).toBeUndefined();
	});

	test("console format shows instruction changes when diff has changes", () => {
		const runA = makeResult({
			id: "run-A",
			instructionSnapshot: { "CLAUDE.md": "# Old" },
		});
		const runB = makeResult({
			id: "run-B",
			instructionSnapshot: { "CLAUDE.md": "# New" },
		});

		const output = formatComparisonConsole(compareResults(runA, runB));
		expect(output).toContain("Instruction Changes");
		expect(output).toContain("CLAUDE.md");
		expect(output).toContain("changed");
	});

	test("console format omits instruction section when all unchanged", () => {
		const snapshot = { "CLAUDE.md": "# Same" };
		const runA = makeResult({
			id: "run-A",
			instructionSnapshot: snapshot,
		});
		const runB = makeResult({
			id: "run-B",
			instructionSnapshot: snapshot,
		});

		const output = formatComparisonConsole(compareResults(runA, runB));
		expect(output).not.toContain("Instruction Changes");
	});

	test("markdown format includes instruction changes table", () => {
		const runA = makeResult({
			id: "run-A",
			instructionSnapshot: { "CLAUDE.md": "# Old" },
		});
		const runB = makeResult({
			id: "run-B",
			instructionSnapshot: {
				"CLAUDE.md": "# New",
				"AGENTS.md": "# Added",
			},
		});

		const output = formatComparisonMarkdown(compareResults(runA, runB));
		expect(output).toContain("## Instruction Changes");
		expect(output).toContain("| CLAUDE.md | changed |");
		expect(output).toContain("| AGENTS.md | added |");
	});
});
