import chalk from "chalk";
import { diffInstructionSnapshots } from "../harvest/snapshot.js";
import { header, padEnd } from "../output/terminal.js";
import type { StoredResult } from "../run/types.js";
import type { ComparisonMetric, ComparisonReport } from "./types.js";

type CoreScoreKey = "correctness" | "precision" | "efficiency" | "conventions" | "overall";

const SCORE_KEYS: CoreScoreKey[] = [
	"correctness",
	"precision",
	"efficiency",
	"conventions",
	"overall",
];

/**
 * Compare two run results side-by-side.
 */
export function compareResults(runA: StoredResult, runB: StoredResult): ComparisonReport {
	const metrics: ComparisonMetric[] = SCORE_KEYS.map((key) => {
		const valueA = runA.scores[key];
		const valueB = runB.scores[key];
		const delta = valueA !== null && valueB !== null ? valueB - valueA : null;

		let better: ComparisonMetric["better"] = "unknown";
		if (valueA !== null && valueB !== null) {
			if (valueB > valueA) better = "b";
			else if (valueA > valueB) better = "a";
			else better = "tie";
		}

		return { name: key, valueA, valueB, delta, better };
	});

	const winner = determineWinner(metrics);

	const aLabel = runA.id;
	const bLabel = runB.id;
	const overallA = runA.scores.overall;
	const overallB = runB.scores.overall;

	let summary: string;
	if (winner === "tie") {
		summary = `${aLabel} and ${bLabel} are tied`;
	} else if (winner === "a") {
		summary = `${aLabel} wins (${formatScore(overallA)} vs ${formatScore(overallB)})`;
	} else if (winner === "b") {
		summary = `${bLabel} wins (${formatScore(overallB)} vs ${formatScore(overallA)})`;
	} else {
		summary = "Cannot determine winner (insufficient data)";
	}

	const instructionDiff =
		runA.instructionSnapshot && runB.instructionSnapshot
			? diffInstructionSnapshots(runA.instructionSnapshot, runB.instructionSnapshot)
			: undefined;

	return { runA, runB, winner, metrics, summary, instructionDiff };
}

function determineWinner(metrics: ComparisonMetric[]): ComparisonReport["winner"] {
	const overallMetric = metrics.find((m) => m.name === "overall");

	if (overallMetric && overallMetric.better !== "unknown") {
		return overallMetric.better;
	}

	if (overallMetric) {
		const oneSided = checkOneSidedNull(overallMetric);
		if (oneSided) return oneSided;
	}

	return countDimensionWins(metrics);
}

function checkOneSidedNull(metric: ComparisonMetric): "a" | "b" | null {
	if (metric.valueA !== null && metric.valueB === null) return "a";
	if (metric.valueB !== null && metric.valueA === null) return "b";
	return null;
}

function countDimensionWins(metrics: ComparisonMetric[]): ComparisonReport["winner"] {
	let winsA = 0;
	let winsB = 0;
	for (const m of metrics) {
		if (m.name !== "overall") {
			if (m.better === "a") winsA++;
			else if (m.better === "b") winsB++;
		}
	}
	if (winsA > winsB) return "a";
	if (winsB > winsA) return "b";
	return "tie";
}

function formatScore(score: number | null): string {
	if (score === null) return "N/A";
	return score.toFixed(2);
}

/**
 * Generate a human-readable summary sentence for a comparison report.
 */
export function generateSummary(report: ComparisonReport): string {
	const overall = report.metrics.find((m) => m.name === "overall");

	if (!overall || overall.valueA === null || overall.valueB === null) {
		return "Scores could not be compared (missing data).";
	}

	if (report.winner === "tie") {
		return appendInstructionChanges("Both runs scored identically.", report);
	}

	const sentence = buildWinnerSentence(report, overall.valueA, overall.valueB);
	return appendInstructionChanges(sentence, report);
}

function buildWinnerSentence(report: ComparisonReport, scoreA: number, scoreB: number): string {
	const isB = report.winner === "b";
	const winnerScore = isB ? scoreB : scoreA;
	const loserScore = isB ? scoreA : scoreB;

	const pct =
		loserScore !== 0 ? ((Math.abs(winnerScore - loserScore) / loserScore) * 100).toFixed(0) : "Inf";

	const winnerLabel = isB ? "Run B" : "Run A";
	let sentence = `${winnerLabel} scored ${pct}% higher.`;

	const bestDim = findBestDimension(report.metrics, isB);
	if (bestDim) {
		sentence += ` ${formatDimensionImprovement(bestDim, isB)}`;
	}

	return sentence;
}

function findBestDimension(metrics: ComparisonMetric[], isB: boolean): ComparisonMetric | null {
	let best: ComparisonMetric | null = null;
	let bestDelta = 0;

	for (const m of metrics) {
		if (m.name === "overall" || m.delta === null) continue;
		const effectiveDelta = isB ? m.delta : -m.delta;
		if (effectiveDelta > bestDelta) {
			bestDelta = effectiveDelta;
			best = m;
		}
	}

	return best;
}

function formatDimensionImprovement(dim: ComparisonMetric, isB: boolean): string {
	if (dim.valueA === null || dim.valueB === null) return "";
	const label = dim.name.charAt(0).toUpperCase() + dim.name.slice(1);
	const [from, to] = isB ? [dim.valueA, dim.valueB] : [dim.valueB, dim.valueA];
	return `${label} improved from ${from.toFixed(2)} to ${to.toFixed(2)}.`;
}

function appendInstructionChanges(sentence: string, report: ComparisonReport): string {
	if (!report.instructionDiff) return sentence;

	const changedFiles = Object.entries(report.instructionDiff)
		.filter(([, status]) => status !== "unchanged")
		.map(([file]) => file);

	if (changedFiles.length === 0) return sentence;

	return `${sentence} Instruction changes: ${changedFiles.join(", ")}.`;
}

/**
 * Format a comparison report as a console-friendly table string.
 */
export function formatComparisonConsole(report: ComparisonReport): string {
	const lines: string[] = [];

	lines.push(header("agenteval compare"));
	lines.push(`  ${chalk.cyan(report.runA.id)}  ${chalk.dim("vs")}  ${chalk.cyan(report.runB.id)}`);
	lines.push("");

	const metricW = 14;
	const runW = 8;
	const deltaW = 9;

	const border = (left: string, mid: string, right: string) =>
		`  ${chalk.dim(`${left}${"─".repeat(metricW)}${mid}${"─".repeat(runW)}${mid}${"─".repeat(runW)}${mid}${"─".repeat(deltaW)}${right}`)}`;

	lines.push(border("┌", "┬", "┐"));
	lines.push(
		`  ${chalk.dim("│")} ${padEnd("Metric", metricW - 2)} ${chalk.dim("│")} ${padEnd("Run A", runW - 2)} ${chalk.dim("│")} ${padEnd("Run B", runW - 2)} ${chalk.dim("│")} ${padEnd("Delta", deltaW - 2)} ${chalk.dim("│")}`,
	);
	lines.push(border("├", "┼", "┤"));

	const nonOverall = report.metrics.filter((m) => m.name !== "overall");
	const overallMetric = report.metrics.find((m) => m.name === "overall");

	for (const m of nonOverall) {
		lines.push(formatTableRow(m, metricW, runW, deltaW));
	}

	if (overallMetric) {
		lines.push(border("├", "┼", "┤"));
		lines.push(formatTableRow(overallMetric, metricW, runW, deltaW));
	}

	lines.push(border("└", "┴", "┘"));

	const instrLines = formatConsoleInstructionDiff(report);
	if (instrLines.length > 0) {
		lines.push("");
		lines.push(...instrLines);
	}

	const summaryText = generateSummary(report);
	const summaryLine =
		report.winner === "tie" ? chalk.dim(summaryText) : chalk.green.bold(summaryText);

	lines.push("");
	lines.push(`  ${chalk.dim("\u2500".repeat(54))}`);
	lines.push(`  ${summaryLine}`);

	return lines.join("\n");
}

/**
 * Format a comparison report as markdown.
 */
export function formatComparisonMarkdown(report: ComparisonReport): string {
	const lines: string[] = [];

	lines.push("# Comparison Report");
	lines.push("");
	lines.push(`**${report.runA.id}** vs **${report.runB.id}**`);
	lines.push("");
	lines.push(`| Metric | ${report.runA.id} | ${report.runB.id} | Delta |`);
	lines.push("|--------|------|------|-------|");

	for (const m of report.metrics) {
		const a = formatScore(m.valueA);
		const b = formatScore(m.valueB);
		const delta = m.delta !== null ? `${m.delta > 0 ? "+" : ""}${m.delta.toFixed(2)}` : "—";
		lines.push(`| ${m.name} | ${a} | ${b} | ${delta} |`);
	}

	if (report.instructionDiff && hasNonUnchanged(report.instructionDiff)) {
		lines.push("");
		lines.push("## Instruction Changes");
		lines.push("");
		lines.push("| File | Status |");
		lines.push("|------|--------|");
		for (const [file, status] of Object.entries(report.instructionDiff)) {
			lines.push(`| ${file} | ${status} |`);
		}
	}

	lines.push("");
	lines.push(`**${generateSummary(report)}**`);

	return lines.join("\n");
}

function formatDelta(m: ComparisonMetric): string {
	if (m.delta === null) return chalk.dim("\u2014");

	const raw = `${m.delta > 0 ? "+" : ""}${m.delta.toFixed(2)}`;
	const colored = m.delta > 0 ? chalk.green(raw) : m.delta < 0 ? chalk.red(raw) : raw;

	const indicators: Record<string, string> = { b: " \u25B6", a: " \u25C0", tie: " \u2014" };
	const indicator = indicators[m.better] ?? "";
	return `${colored}${indicator ? chalk.dim(indicator) : ""}`;
}

function formatTableRow(
	m: ComparisonMetric,
	metricW: number,
	runW: number,
	deltaW: number,
): string {
	const label = m.name.charAt(0).toUpperCase() + m.name.slice(1);
	const a = formatScore(m.valueA);
	const b = formatScore(m.valueB);
	const deltaStr = formatDelta(m);

	return `  ${chalk.dim("\u2502")} ${padEnd(label, metricW - 2)} ${chalk.dim("\u2502")} ${padEnd(a, runW - 2)} ${chalk.dim("\u2502")} ${padEnd(b, runW - 2)} ${chalk.dim("\u2502")} ${padEnd(deltaStr, deltaW - 2)} ${chalk.dim("\u2502")}`;
}

function hasNonUnchanged(
	diff: Record<string, "added" | "removed" | "changed" | "unchanged">,
): boolean {
	return Object.values(diff).some((status) => status !== "unchanged");
}

function colorizeInstructionStatus(status: "added" | "removed" | "changed" | "unchanged"): string {
	switch (status) {
		case "added":
			return chalk.green(status);
		case "removed":
			return chalk.red(status);
		case "changed":
			return chalk.yellow(status);
		case "unchanged":
			return chalk.dim(status);
	}
}

function formatConsoleInstructionDiff(report: ComparisonReport): string[] {
	if (!report.instructionDiff || !hasNonUnchanged(report.instructionDiff)) {
		return [];
	}

	const lines: string[] = [];
	lines.push(`  ${chalk.bold("Instruction Changes")}`);
	lines.push(`  ${chalk.dim("\u2500".repeat(19))}`);
	for (const [file, status] of Object.entries(report.instructionDiff)) {
		lines.push(`  ${padEnd(file, 24)} ${colorizeInstructionStatus(status)}`);
	}
	return lines;
}
