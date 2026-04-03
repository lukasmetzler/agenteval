import { diffInstructionSnapshots } from "../harvest/snapshot.js";
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
 * Format a comparison report as a console-friendly table string.
 */
export function formatComparisonConsole(report: ComparisonReport): string {
	const lines: string[] = [];

	lines.push(`Comparing: ${report.runA.id} vs ${report.runB.id}`);
	lines.push("");
	lines.push(formatConsoleHeader(report));
	lines.push(`  ${"─".repeat(60)}`);
	lines.push(...formatConsoleMetrics(report));
	lines.push("");
	lines.push(formatConsoleTokens(report));
	lines.push(formatConsoleStatus(report));

	const instrLines = formatConsoleInstructionDiff(report);
	if (instrLines.length > 0) {
		lines.push("");
		lines.push(...instrLines);
	}

	lines.push("");
	lines.push(`  Winner: ${report.summary}`);

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
	lines.push(`**Winner:** ${report.summary}`);

	return lines.join("\n");
}

function formatConsoleHeader(report: ComparisonReport): string {
	return `  ${"Metric".padEnd(20)} ${report.runA.id.padStart(12)} ${report.runB.id.padStart(12)}   Delta`;
}

function formatConsoleMetrics(report: ComparisonReport): string[] {
	return report.metrics.map((m) => {
		const a = formatScore(m.valueA).padStart(12);
		const b = formatScore(m.valueB).padStart(12);
		const delta = m.delta !== null ? formatDelta(m.delta) : "";
		const indicator = m.better === "a" ? " ◀" : m.better === "b" ? " ▶" : "";
		return `  ${m.name.padEnd(20)} ${a} ${b}${delta}${indicator}`;
	});
}

function formatDelta(delta: number): string {
	return `  ${delta > 0 ? "+" : ""}${delta.toFixed(2)}`;
}

function formatConsoleTokens(report: ComparisonReport): string {
	const tokensA = report.runA.metrics.tokensTotal;
	const tokensB = report.runB.metrics.tokensTotal;
	const tA = tokensA !== null ? `~${tokensA}` : "N/A";
	const tB = tokensB !== null ? `~${tokensB}` : "N/A";
	return `  ${"Tokens".padEnd(20)} ${tA.padStart(12)} ${tB.padStart(12)}`;
}

function formatConsoleStatus(report: ComparisonReport): string {
	return `  ${"Status".padEnd(20)} ${report.runA.status.padStart(12)} ${report.runB.status.padStart(12)}`;
}

function hasNonUnchanged(
	diff: Record<string, "added" | "removed" | "changed" | "unchanged">,
): boolean {
	return Object.values(diff).some((status) => status !== "unchanged");
}

function formatConsoleInstructionDiff(report: ComparisonReport): string[] {
	if (!report.instructionDiff || !hasNonUnchanged(report.instructionDiff)) {
		return [];
	}

	const lines: string[] = [];
	lines.push("  Instruction Changes");
	lines.push(`  ${"─".repeat(40)}`);
	for (const [file, status] of Object.entries(report.instructionDiff)) {
		lines.push(`  ${file.padEnd(24)} ${status}`);
	}
	return lines;
}
