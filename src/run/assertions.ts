import { minimatch } from "minimatch";
import type { LintDeltaResult } from "../toolchain/lintDelta.js";
import type { AssertionResult, TaskAssertion } from "./types.js";

/** Whether an assertion is evaluated by running linters on the diff. */
export function isLintDeltaAssertion(assertion: TaskAssertion): boolean {
	return (
		assertion.type === "lint-delta" ||
		(assertion.type === "no-new-warnings" && assertion.command === undefined)
	);
}

/** Cache key for a lint-delta assertion's tool selection. */
export function lintDeltaKey(assertion: TaskAssertion): string {
	const tools = assertion.tools ?? "auto";
	return tools === "auto" ? "auto" : [...tools].sort().join(",");
}

/**
 * Evaluate a single assertion against the actual run results.
 */
export function evaluateAssertion(
	assertion: TaskAssertion,
	context: {
		changedFiles: string[];
		diff: string;
		testResults: Map<string, { passed: boolean; output: string }>;
		lintDeltas?: Map<string, LintDeltaResult>;
	},
): AssertionResult {
	if (isLintDeltaAssertion(assertion)) {
		return evaluateLintDelta(assertion, context.lintDeltas?.get(lintDeltaKey(assertion)));
	}
	switch (assertion.type) {
		case "files-changed":
			return evaluateFilesChanged(assertion, context.changedFiles);
		case "files-unchanged":
			return evaluateFilesUnchanged(assertion, context.changedFiles);
		case "test-pass":
			return evaluateTestPass(assertion, context.testResults);
		// no-new-warnings with a command keeps its v0.8 meaning: the command exits 0.
		case "no-new-warnings":
			return evaluateTestPass(assertion, context.testResults);
		case "convention":
			return evaluateConvention(assertion, context.diff);
		default:
			return {
				type: assertion.type,
				expected: "known assertion type",
				actual: `unknown type: ${assertion.type}`,
				passed: false,
			};
	}
}

function evaluateFilesChanged(assertion: TaskAssertion, changedFiles: string[]): AssertionResult {
	const pattern = assertion.pattern ?? "**";
	const matching = changedFiles.filter((f) => minimatch(f, pattern));
	const passed = matching.length > 0;

	return {
		type: "files-changed",
		expected: `${pattern} modified`,
		actual: passed
			? `${matching.length} file(s) matched: ${matching.join(", ")}`
			: "no matching files changed",
		passed,
	};
}

function evaluateFilesUnchanged(assertion: TaskAssertion, changedFiles: string[]): AssertionResult {
	const pattern = assertion.pattern ?? "**";
	const matching = changedFiles.filter((f) => minimatch(f, pattern));
	const passed = matching.length === 0;

	return {
		type: "files-unchanged",
		expected: `${pattern} untouched`,
		actual: passed
			? "no matching files changed"
			: `${matching.length} file(s) changed: ${matching.join(", ")}`,
		passed,
	};
}

function evaluateTestPass(
	assertion: TaskAssertion,
	testResults: Map<string, { passed: boolean; output: string }>,
): AssertionResult {
	const command = assertion.command ?? "";
	const result = testResults.get(command);

	if (!result) {
		return {
			type: assertion.type,
			expected: `${command} exits 0`,
			actual: "command not executed",
			passed: false,
		};
	}

	return {
		type: assertion.type,
		expected: `${command} exits 0`,
		actual: result.passed ? "exit 0" : `exit non-zero: ${result.output.slice(0, 200)}`,
		passed: result.passed,
	};
}

function evaluateConvention(assertion: TaskAssertion, diff: string): AssertionResult {
	const pattern = assertion.pattern ?? "";
	let regex: RegExp;
	try {
		regex = new RegExp(pattern);
	} catch {
		return {
			type: "convention",
			expected: `valid regex: ${pattern}`,
			actual: `invalid regex pattern: ${pattern}`,
			passed: false,
		};
	}

	// Check only added lines from the diff (lines starting with +, excluding +++ header)
	const addedLines = diff
		.split("\n")
		.filter((line) => line.startsWith("+") && !line.startsWith("+++"))
		.join("\n");

	const found = regex.test(addedLines);
	const expectPresent = assertion.expect === "present-in-changes";
	const passed = expectPresent ? found : !found;

	return {
		type: "convention",
		expected: `${pattern} ${expectPresent ? "present" : "absent"} in changes`,
		actual: found ? "pattern found in added lines" : "pattern not found in added lines",
		passed,
	};
}

function evaluateLintDelta(
	assertion: TaskAssertion,
	delta: LintDeltaResult | undefined,
): AssertionResult {
	const maxNew = assertion.maxNew ?? 0;
	const expected = `at most ${maxNew} new lint/type finding(s)`;
	if (!delta) {
		return { type: assertion.type, expected, actual: "linters not run", passed: false };
	}
	const ran = delta.runs.filter((r) => r.status === "ok");
	if (ran.length === 0) {
		const why = delta.runs.map((r) => (r.status === "ok" ? r.tool : `${r.tool}: ${r.reason}`));
		return {
			type: assertion.type,
			expected,
			actual: why.length > 0 ? `no linter could run (${why.join("; ")})` : "no linters detected",
			passed: false,
		};
	}
	const count = delta.newDiagnostics.length;
	const sample = delta.newDiagnostics
		.slice(0, 3)
		.map((d) => `${d.file}:${d.line} ${d.rule}`)
		.join(", ");
	return {
		type: assertion.type,
		expected,
		actual:
			count === 0
				? `0 new findings (${ran.map((r) => r.tool).join(", ")})`
				: `${count} new finding(s): ${sample}${count > 3 ? ", ..." : ""}`,
		passed: count <= maxNew,
	};
}
