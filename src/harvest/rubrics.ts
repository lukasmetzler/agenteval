import type { RubricResult } from "./types.js";

/**
 * Extract the top-level directory from a file path.
 * Files with no directory separator are grouped under "root".
 */
function topLevelDir(filePath: string): string {
	const slashIndex = filePath.indexOf("/");
	if (slashIndex === -1) return "root";
	return filePath.slice(0, slashIndex);
}

/**
 * Map directory count to a scope score.
 */
function dirCountToScore(count: number): number {
	if (count >= 8) return 0;
	if (count >= 5) return 2;
	if (count === 4) return 4;
	if (count === 3) return 6;
	if (count === 2) return 8;
	return 10;
}

/**
 * Score how focused the change is across directories.
 * Fewer top-level directories = more disciplined scope.
 */
export function scoreScopeDiscipline(files: string[]): RubricResult {
	const details: string[] = [];

	if (files.length <= 1) {
		details.push(`${files.length} file${files.length === 1 ? "" : "s"} changed`);
		return { name: "scope-discipline", score: 10, maxScore: 10, details };
	}

	const dirCounts = new Map<string, number>();
	for (const file of files) {
		const dir = topLevelDir(file);
		dirCounts.set(dir, (dirCounts.get(dir) ?? 0) + 1);
	}

	const uniqueDirs = dirCounts.size;

	// Find dominant directory
	let dominantDir = "";
	let dominantCount = 0;
	for (const [dir, count] of dirCounts) {
		if (count > dominantCount) {
			dominantDir = dir;
			dominantCount = count;
		}
	}

	const concentration = Math.round((dominantCount / files.length) * 100);
	details.push(`${files.length} files across ${uniqueDirs} directories`);
	details.push(`Dominant directory: ${dominantDir} (${concentration}%)`);

	const score = dirCountToScore(uniqueDirs);
	const suggestion =
		score <= 4
			? "Consider splitting into focused commits, one per directory."
			: score <= 7
				? "Try to keep changes within 2-3 related directories."
				: undefined;
	return { name: "scope-discipline", score, maxScore: 10, details, suggestion };
}

/**
 * Map a test/impl ratio to a coverage score.
 */
function ratioToScore(ratio: number, implFiles: number): number {
	if (ratio >= 0.5) return 10;
	if (ratio >= 0.3) return 8;
	if (ratio >= 0.1) return 5;
	if (implFiles > 3) return 0;
	return 3;
}

/**
 * Score the ratio of test files to implementation files.
 */
export function scoreTestCoverage(files: string[]): RubricResult {
	const details: string[] = [];

	if (files.length === 0) {
		details.push("No files changed");
		return { name: "test-coverage", score: 10, maxScore: 10, details };
	}

	const testPattern = /(?:test|spec|__tests__)/i;
	const testFiles = files.filter((f) => testPattern.test(f)).length;
	const implFiles = files.length - testFiles;

	details.push(
		`${testFiles} test file${testFiles !== 1 ? "s" : ""}, ${implFiles} implementation file${implFiles !== 1 ? "s" : ""}`,
	);

	if (implFiles === 0) {
		return { name: "test-coverage", score: 10, maxScore: 10, details };
	}

	const ratio = testFiles / implFiles;
	details.push(`Test ratio: ${ratio.toFixed(2)}`);

	const score = ratioToScore(ratio, implFiles);
	const suggestion =
		score === 0
			? "Add tests for the files you changed. Even one test file helps."
			: score <= 5
				? "Add more test coverage. Aim for at least 1 test file per 2 implementation files."
				: undefined;
	return { name: "test-coverage", score, maxScore: 10, details, suggestion };
}

interface DiffCounts {
	consoleCount: number;
	debuggerCount: number;
	todoCount: number;
	formattingHunks: number;
}

/**
 * Check if a hunk contains only whitespace-only added lines.
 */
function isFormattingOnlyHunk(hunkAddedLines: string[]): boolean {
	return hunkAddedLines.length > 0 && hunkAddedLines.every((l) => /^\+\s*$/.test(l));
}

/**
 * Count pattern-based issues in a single added line.
 */
function countLineIssues(line: string): { console: number; debugger: number; todo: number } {
	return {
		console: /^\+.*console\.(log|debug|warn|error)\(/.test(line) ? 1 : 0,
		debugger: /^\+.*debugger/.test(line) ? 1 : 0,
		todo: /^\+.*\/\/\s*(TODO|FIXME|HACK|XXX)/i.test(line) ? 1 : 0,
	};
}

/**
 * Extract hunks from diff lines, returning arrays of added lines per hunk.
 */
function extractHunks(lines: string[]): string[][] {
	const hunks: string[][] = [];
	let current: string[] | null = null;

	for (const line of lines) {
		if (line.startsWith("@@")) {
			if (current) hunks.push(current);
			current = [];
			continue;
		}
		if (!current) continue;
		if (line.startsWith("+") && !line.startsWith("+++")) {
			current.push(line);
		}
	}
	if (current) hunks.push(current);
	return hunks;
}

/**
 * Count hygiene issues in added lines of a diff.
 */
function countDiffIssues(diff: string): DiffCounts {
	const hunks = extractHunks(diff.split("\n"));

	let consoleCount = 0;
	let debuggerCount = 0;
	let todoCount = 0;
	let formattingHunks = 0;

	for (const hunk of hunks) {
		if (isFormattingOnlyHunk(hunk)) {
			formattingHunks++;
		}
		for (const line of hunk) {
			const issues = countLineIssues(line);
			consoleCount += issues.console;
			debuggerCount += issues.debugger;
			todoCount += issues.todo;
		}
	}

	return { consoleCount, debuggerCount, todoCount, formattingHunks };
}

/**
 * Build detail strings from issue counts.
 */
function buildHygieneDetails(counts: DiffCounts): string[] {
	const details: string[] = [];
	if (counts.consoleCount > 0) {
		details.push(
			`Found ${counts.consoleCount} console.log statement${counts.consoleCount !== 1 ? "s" : ""}`,
		);
	}
	if (counts.debuggerCount > 0) {
		details.push(
			`Found ${counts.debuggerCount} debugger statement${counts.debuggerCount !== 1 ? "s" : ""}`,
		);
	}
	if (counts.todoCount > 0) {
		details.push(
			`Found ${counts.todoCount} TODO/FIXME comment${counts.todoCount !== 1 ? "s" : ""}`,
		);
	}
	if (counts.formattingHunks > 0) {
		details.push(
			`Found ${counts.formattingHunks} formatting-only hunk${counts.formattingHunks !== 1 ? "s" : ""}`,
		);
	}
	return details.length > 0 ? details : ["Clean diff"];
}

/**
 * Pick the most relevant suggestion based on which hygiene issues were found.
 */
function buildHygieneSuggestion(counts: DiffCounts): string | undefined {
	if (counts.consoleCount > 0 || counts.debuggerCount > 0) {
		return "Remove console.log/debugger statements before committing.";
	}
	if (counts.todoCount > 0) {
		return "Resolve TODO/FIXME comments or move them to an issue tracker.";
	}
	if (counts.formattingHunks > 0) {
		return "Separate formatting changes into their own commit.";
	}
	return undefined;
}

/**
 * Score the diff for hygiene issues: debug statements, TODO comments, etc.
 */
export function scoreDiffHygiene(diff: string): RubricResult {
	if (!diff.trim()) {
		return { name: "diff-hygiene", score: 10, maxScore: 10, details: ["Clean diff"] };
	}

	const counts = countDiffIssues(diff);
	const totalIssues =
		counts.consoleCount + counts.debuggerCount + counts.todoCount + counts.formattingHunks;
	const details = buildHygieneDetails(counts);
	const score = Math.max(0, 10 - totalIssues);

	const suggestion = buildHygieneSuggestion(counts);
	return { name: "diff-hygiene", score, maxScore: 10, details, suggestion };
}
