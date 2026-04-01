import { minimatch } from "minimatch";
import type { AssertionResult, TaskAssertion } from "./types.js";

/**
 * Evaluate a single assertion against the actual run results.
 */
export function evaluateAssertion(
	assertion: TaskAssertion,
	context: {
		changedFiles: string[];
		diff: string;
		testResults: Map<string, { passed: boolean; output: string }>;
	},
): AssertionResult {
	switch (assertion.type) {
		case "files-changed":
			return evaluateFilesChanged(assertion, context.changedFiles);
		case "files-unchanged":
			return evaluateFilesUnchanged(assertion, context.changedFiles);
		case "test-pass":
			return evaluateTestPass(assertion, context.testResults);
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
