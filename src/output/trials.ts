import chalk from "chalk";
import type { ArmDelta, Stat, TrialRun, TrialStats } from "../run/trials.js";
import { compareArms, summarizeTrials } from "../run/trials.js";
import { header, padEnd } from "./terminal.js";

function fmtStat(s: Stat | null, digits: number, prefix = ""): string {
	if (!s) return chalk.dim("n/a");
	const sd = s.n > 1 ? chalk.dim(` ± ${s.stddev.toFixed(digits)}`) : "";
	return `${prefix}${s.mean.toFixed(digits)}${sd}`;
}

function fmtDelta(
	value: number | null,
	digits: number,
	lowerIsBetter: boolean,
	prefix = "",
): string {
	if (value === null) return chalk.dim("n/a");
	const text = `${value >= 0 ? "+" : "-"}${prefix}${Math.abs(value).toFixed(digits)}`;
	if (value === 0) return chalk.dim(text);
	const better = lowerIsBetter ? value < 0 : value > 0;
	return better ? chalk.green(text) : chalk.red(text);
}

const ROWS: {
	label: string;
	value: (s: TrialStats) => string;
	delta: (d: ArmDelta) => string;
}[] = [
	{
		label: "pass rate",
		value: (s) => `${s.passes}/${s.trials} (${Math.round(s.passRate * 100)}%)`,
		delta: (d) => fmtDelta(d.passRate * 100, 0, false).concat("pp"),
	},
	{
		label: "pass@k / pass^k",
		value: (s) => `${s.passAtK ? "yes" : "no"} / ${s.passAllK ? "yes" : "no"}`,
		delta: () => "",
	},
	{ label: "score", value: (s) => fmtStat(s.score, 2), delta: (d) => fmtDelta(d.score, 2, false) },
	{
		label: "tokens",
		value: (s) => fmtStat(s.tokens, 0),
		delta: (d) => fmtDelta(d.tokens, 0, true),
	},
	{
		label: "cost",
		value: (s) => fmtStat(s.costUsd, 4, "$"),
		delta: (d) => fmtDelta(d.costUsd, 4, true, "$"),
	},
	{ label: "turns", value: (s) => fmtStat(s.turns, 1), delta: (d) => fmtDelta(d.turns, 1, true) },
	{
		label: "duration (s)",
		value: (s) =>
			fmtStat(
				s.durationMs && {
					...s.durationMs,
					mean: s.durationMs.mean / 1000,
					stddev: s.durationMs.stddev / 1000,
				},
				1,
			),
		delta: (d) => fmtDelta(d.durationMs === null ? null : d.durationMs / 1000, 1, true),
	},
];

export interface TrialReport {
	group: string;
	instructions: TrialStats;
	baseline: TrialStats | null;
	delta: ArmDelta | null;
}

export function buildTrialReport(run: TrialRun): TrialReport {
	const instructions = summarizeTrials(run.instructions);
	const baseline = run.baseline ? summarizeTrials(run.baseline) : null;
	return {
		group: run.group,
		instructions,
		baseline,
		delta: baseline ? compareArms(instructions, baseline) : null,
	};
}

export function formatTrialReport(report: TrialReport, task: string): string {
	const col = 22;
	const lines = [header(`agenteval run  ·  ${task}  ·  ${report.instructions.trials} trial(s)`)];
	const cols = report.baseline ? ["with instructions", "baseline (none)", "Δ"] : ["result"];
	lines.push(`  ${padEnd("", 18)}${cols.map((c) => padEnd(chalk.bold(c), col)).join("")}`);
	for (const row of ROWS) {
		const cells = [row.value(report.instructions)];
		if (report.baseline && report.delta) {
			cells.push(row.value(report.baseline), row.delta(report.delta));
		}
		lines.push(`  ${padEnd(row.label, 18)}${cells.map((c) => padEnd(c, col)).join("")}`);
	}
	if (report.delta && report.delta.score !== null && report.instructions.trials < 3) {
		lines.push(
			"",
			chalk.dim("  Fewer than 3 trials: differences may be noise. Use --trials 3 or more."),
		);
	}
	lines.push("", chalk.dim(`  Group: ${report.group}`), "");
	return lines.join("\n");
}
