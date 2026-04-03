import { minimatch } from "minimatch";
import { evaluateAssertion } from "./assertions.js";
import type {
	AssertionResult,
	ResultScores,
	RunMetrics,
	ScoringWeights,
	TaskAssertion,
} from "./types.js";

interface ScoreRunInput {
	assertions: TaskAssertion[];
	weights: ScoringWeights;
	changedFiles: string[];
	diff: string;
	testResults: Map<string, { passed: boolean; output: string }>;
	metrics: RunMetrics;
	tokensBudget: number;
	expectedFilePatterns: string[];
	detectionConfidence?: number;
}

export function scoreRun(input: ScoreRunInput): {
	scores: ResultScores;
	assertionResults: AssertionResult[];
} {
	const assertionResults = input.assertions.map((a) =>
		evaluateAssertion(a, {
			changedFiles: input.changedFiles,
			diff: input.diff,
			testResults: input.testResults,
		}),
	);

	if (input.assertions.length === 0) {
		return {
			scores: {
				correctness: null,
				precision: null,
				efficiency: null,
				conventions: null,
				overall: null,
			},
			assertionResults: [],
		};
	}

	const correctness = computeCorrectness(assertionResults);
	const precision = computePrecision(input.changedFiles, input.expectedFilePatterns);
	const efficiency = computeEfficiency(input.metrics, input.tokensBudget);
	const conventions = computeConventions(assertionResults);
	const overall = computeOverall(
		{ correctness, precision, efficiency, conventions },
		input.weights,
	);

	const confidenceAdjustedOverall =
		input.detectionConfidence !== undefined ? overall * input.detectionConfidence : undefined;

	return {
		scores: { correctness, precision, efficiency, conventions, overall, confidenceAdjustedOverall },
		assertionResults,
	};
}

function computeCorrectness(results: AssertionResult[]): number {
	const scorable = results.filter((r) => r.type !== "convention");
	if (scorable.length === 0) return 1;
	return scorable.filter((r) => r.passed).length / scorable.length;
}

function computePrecision(changedFiles: string[], expectedPatterns: string[]): number {
	if (changedFiles.length === 0) {
		return expectedPatterns.length === 0 ? 1 : 0;
	}

	const unexpected = changedFiles.filter((f) => !expectedPatterns.some((p) => minimatch(f, p)));

	return Math.max(0, Math.min(1, 1 - unexpected.length / changedFiles.length));
}

function computeEfficiency(metrics: RunMetrics, budget: number): number | null {
	if (metrics.tokensTotal === null || metrics.tokenSource === "unavailable") {
		return null;
	}
	return Math.max(0, Math.min(1, 1 - metrics.tokensTotal / budget));
}

function computeConventions(results: AssertionResult[]): number | null {
	const conventionResults = results.filter((r) => r.type === "convention");
	if (conventionResults.length === 0) return null;
	return conventionResults.filter((r) => r.passed).length / conventionResults.length;
}

function computeOverall(
	scores: {
		correctness: number;
		precision: number;
		efficiency: number | null;
		conventions: number | null;
	},
	weights: ScoringWeights,
): number {
	let total = 0;
	let totalWeight = 0;

	total += scores.correctness * weights.correctness;
	totalWeight += weights.correctness;

	total += scores.precision * weights.precision;
	totalWeight += weights.precision;

	if (scores.efficiency !== null) {
		total += scores.efficiency * weights.efficiency;
		totalWeight += weights.efficiency;
	}

	if (scores.conventions !== null) {
		total += scores.conventions * weights.conventions;
		totalWeight += weights.conventions;
	}

	return totalWeight > 0 ? total / totalWeight : 0;
}
