import { resolve } from "node:path";
import chalk from "chalk";
import type { Command } from "commander";
import { loadConfig } from "../config/loader.js";
import { header, kvLine, padEnd, scoreColor } from "../output/terminal.js";
import type { StoredResult } from "../run/types.js";
import { listResults } from "../store/index.js";
import { logger } from "../utils/logger.js";

export type TrendDirection = "improving" | "regressing" | "stable";

export interface TaskSummary {
	task: string;
	runs: number;
	latest: number;
	best: number;
	worst: number;
	average: number;
	trend: TrendDirection;
	history: Array<{ id: string; date: string; score: number; delta: number | null }>;
}

interface TrendsOptions {
	task?: string;
	all?: boolean;
	limit?: string;
	format?: string;
	config?: string;
}

/**
 * Detect trend direction from a sequence of scores.
 * Looks at the last 3 scores (or fewer if less data).
 * A tolerance of 0.01 avoids treating noise as movement.
 */
export function detectTrend(scores: number[]): TrendDirection {
	if (scores.length < 2) return "stable";

	const recent = scores.slice(-3);

	let ups = 0;
	let downs = 0;
	for (let i = 1; i < recent.length; i++) {
		if (recent[i] > recent[i - 1] + 0.01) ups++;
		else if (recent[i] < recent[i - 1] - 0.01) downs++;
	}

	if (ups > 0 && downs === 0) return "improving";
	if (downs > 0 && ups === 0) return "regressing";
	return "stable";
}

/**
 * Compute summary statistics and trend for a single task's results.
 */
export function computeTaskSummary(task: string, results: StoredResult[]): TaskSummary {
	const sorted = [...results].sort((a, b) => a.timestamp.localeCompare(b.timestamp));

	const scores = sorted.map((r) => r.scores.overall ?? 0);
	const history = sorted.map((r, i) => ({
		id: r.id,
		date: r.timestamp.split("T")[0],
		score: r.scores.overall ?? 0,
		delta: i > 0 ? scores[i] - scores[i - 1] : null,
	}));

	return {
		task,
		runs: sorted.length,
		latest: scores[scores.length - 1],
		best: Math.max(...scores),
		worst: Math.min(...scores),
		average: scores.reduce((a, b) => a + b, 0) / scores.length,
		trend: detectTrend(scores),
		history,
	};
}

/** Format trend direction with icon and color */
export function formatTrend(trend: TrendDirection): string {
	switch (trend) {
		case "improving":
			return chalk.green("\u2191 improving");
		case "regressing":
			return chalk.red("\u2193 regressing");
		case "stable":
			return chalk.dim("\u2192 stable");
	}
}

export function registerTrendsCommand(program: Command): void {
	program
		.command("trends")
		.description("Score history and trend analysis")
		.option("--task <name>", "show history for a specific task")
		.option("--all", "show summary across all tasks (default when no --task)")
		.option("--limit <n>", "max runs to show per task (default: 20)")
		.option("--format <type>", "output format: console, json, markdown")
		.option("-c, --config <path>", "path to agenteval.yaml")
		.action((options: TrendsOptions) => {
			try {
				const config = loadConfig(options.config);
				const resultsDir = resolve(process.cwd(), config.run.resultsDir);
				const limit = options.limit ? Number.parseInt(options.limit, 10) : 20;

				if (options.task) {
					handleSingleTask(resultsDir, options.task, limit, options.format);
				} else {
					handleAllTasks(resultsDir, limit, options.format);
				}
			} catch (err) {
				logger.error(err instanceof Error ? err.message : String(err));
				process.exit(2);
			}
		});
}

function handleSingleTask(
	resultsDir: string,
	taskName: string,
	limit: number,
	format?: string,
): void {
	const results = listResults(resultsDir, { task: taskName });

	if (results.length === 0) {
		const allResults = listResults(resultsDir);
		const tasks = [...new Set(allResults.map((r) => r.task))].sort();

		if (tasks.length === 0) {
			console.log(
				"\n  No results found. Run some evals first:\n    agenteval run --task tasks/harvested/some-task.yaml\n",
			);
		} else {
			console.log(`\n  No results found for task "${taskName}".`);
			console.log(`  Available tasks: ${tasks.join(", ")}\n`);
		}
		process.exit(0);
	}

	const limited = results.length > limit ? results.slice(0, limit) : results;
	const summary = computeTaskSummary(taskName, limited);

	if (format === "json") {
		console.log(
			JSON.stringify(
				{
					tasks: [summary],
					summary: {
						totalRuns: summary.runs,
						totalTasks: 1,
						averageLatest: round(summary.latest),
					},
				},
				null,
				2,
			),
		);
	} else if (format === "markdown") {
		console.log(formatSingleTaskMarkdown(summary));
	} else {
		printSingleTaskConsole(summary);
	}
	process.exit(0);
}

function handleAllTasks(resultsDir: string, limit: number, format?: string): void {
	const allResults = listResults(resultsDir);

	if (allResults.length === 0) {
		console.log(
			"\n  No results found. Run some evals first:\n    agenteval run --task tasks/harvested/some-task.yaml\n",
		);
		process.exit(0);
	}

	const grouped = new Map<string, StoredResult[]>();
	for (const r of allResults) {
		const existing = grouped.get(r.task) ?? [];
		existing.push(r);
		grouped.set(r.task, existing);
	}

	const summaries: TaskSummary[] = [];
	for (const [task, results] of grouped) {
		const limited = results.length > limit ? results.slice(0, limit) : results;
		summaries.push(computeTaskSummary(task, limited));
	}
	summaries.sort((a, b) => a.task.localeCompare(b.task));

	const totalRuns = summaries.reduce((sum, s) => sum + s.runs, 0);
	const averageLatest = round(summaries.reduce((sum, s) => sum + s.latest, 0) / summaries.length);

	if (format === "json") {
		console.log(
			JSON.stringify(
				{
					tasks: summaries,
					summary: {
						totalRuns,
						totalTasks: summaries.length,
						averageLatest,
					},
				},
				null,
				2,
			),
		);
	} else if (format === "markdown") {
		console.log(formatAllTasksMarkdown(summaries, totalRuns, averageLatest));
	} else {
		printAllTasksConsole(summaries, totalRuns, averageLatest);
	}
	process.exit(0);
}

function printSingleTaskConsole(summary: TaskSummary): void {
	const runW = 28;
	const dateW = 14;
	const scoreW = 9;
	const deltaW = 10;

	const border = (left: string, mid: string, right: string) =>
		`  ${chalk.dim(`${left}${"─".repeat(runW)}${mid}${"─".repeat(dateW)}${mid}${"─".repeat(scoreW)}${mid}${"─".repeat(deltaW)}${right}`)}`;

	console.log(header(`agenteval trends \u00b7 ${summary.task}`));
	console.log(border("┌", "┬", "┐"));
	console.log(
		`  ${chalk.dim("│")} ${padEnd("Run", runW - 2)} ${chalk.dim("│")} ${padEnd("Date", dateW - 2)} ${chalk.dim("│")} ${padEnd("Score", scoreW - 2)} ${chalk.dim("│")} ${padEnd("Delta", deltaW - 2)} ${chalk.dim("│")}`,
	);
	console.log(border("├", "┼", "┤"));

	for (const h of summary.history) {
		const score = scoreColor(h.score, 1);
		const delta = formatDelta(h.delta);
		console.log(
			`  ${chalk.dim("│")} ${padEnd(h.id, runW - 2)} ${chalk.dim("│")} ${padEnd(h.date, dateW - 2)} ${chalk.dim("│")} ${padEnd(score, scoreW - 2)} ${chalk.dim("│")} ${padEnd(delta, deltaW - 2)} ${chalk.dim("│")}`,
		);
	}

	console.log(border("└", "┴", "┘"));
	console.log();

	const totalDelta = summary.latest - summary.history[0].score;
	const deltaStr = totalDelta >= 0 ? `+${totalDelta.toFixed(2)}` : totalDelta.toFixed(2);

	console.log(
		kvLine("Trend", `${formatTrend(summary.trend)} (${deltaStr} over ${summary.runs} runs)`),
	);

	const bestEntry = summary.history.find((h) => h.score === summary.best);
	const worstEntry = summary.history.find((h) => h.score === summary.worst);
	console.log(kvLine("Best", `${scoreColor(summary.best, 1)} (${bestEntry?.id ?? "?"})`));
	console.log(kvLine("Worst", `${scoreColor(summary.worst, 1)} (${worstEntry?.id ?? "?"})`));
	console.log(kvLine("Average", scoreColor(round(summary.average), 1)));
	console.log();
}

function printAllTasksConsole(
	summaries: TaskSummary[],
	totalRuns: number,
	averageLatest: number,
): void {
	const taskW = 20;
	const runsW = 8;
	const latestW = 10;
	const bestW = 10;
	const worstW = 10;
	const trendW = 15;

	const border = (left: string, mid: string, right: string) =>
		`  ${chalk.dim(`${left}${"─".repeat(taskW)}${mid}${"─".repeat(runsW)}${mid}${"─".repeat(latestW)}${mid}${"─".repeat(bestW)}${mid}${"─".repeat(worstW)}${mid}${"─".repeat(trendW)}${right}`)}`;

	console.log(header("agenteval trends"));
	console.log(border("┌", "┬", "┐"));
	console.log(
		`  ${chalk.dim("│")} ${padEnd("Task", taskW - 2)} ${chalk.dim("│")} ${padEnd("Runs", runsW - 2)} ${chalk.dim("│")} ${padEnd("Latest", latestW - 2)} ${chalk.dim("│")} ${padEnd("Best", bestW - 2)} ${chalk.dim("│")} ${padEnd("Worst", worstW - 2)} ${chalk.dim("│")} ${padEnd("Trend", trendW - 2)} ${chalk.dim("│")}`,
	);
	console.log(border("├", "┼", "┤"));

	for (const s of summaries) {
		console.log(
			`  ${chalk.dim("│")} ${padEnd(s.task, taskW - 2)} ${chalk.dim("│")} ${padEnd(String(s.runs), runsW - 2)} ${chalk.dim("│")} ${padEnd(scoreColor(s.latest, 1), latestW - 2)} ${chalk.dim("│")} ${padEnd(scoreColor(s.best, 1), bestW - 2)} ${chalk.dim("│")} ${padEnd(scoreColor(s.worst, 1), worstW - 2)} ${chalk.dim("│")} ${padEnd(formatTrend(s.trend), trendW - 2)} ${chalk.dim("│")}`,
		);
	}

	console.log(border("└", "┴", "┘"));
	console.log();
	console.log(`  ${totalRuns} runs across ${summaries.length} tasks`);
	console.log(`  Average latest score: ${scoreColor(averageLatest, 1)}`);
	console.log();
}

function formatSingleTaskMarkdown(summary: TaskSummary): string {
	const lines = [
		`# Trends: ${summary.task}`,
		"",
		"| Run | Date | Score | Delta |",
		"|-----|------|-------|-------|",
	];

	for (const h of summary.history) {
		const delta =
			h.delta !== null ? (h.delta >= 0 ? `+${h.delta.toFixed(2)}` : h.delta.toFixed(2)) : "---";
		lines.push(`| ${h.id} | ${h.date} | ${h.score.toFixed(2)} | ${delta} |`);
	}

	lines.push("");
	lines.push(`**Trend:** ${summary.trend}`);
	lines.push(
		`**Best:** ${summary.best.toFixed(2)} | **Worst:** ${summary.worst.toFixed(2)} | **Average:** ${round(summary.average).toFixed(2)}`,
	);

	return lines.join("\n");
}

function formatAllTasksMarkdown(
	summaries: TaskSummary[],
	totalRuns: number,
	averageLatest: number,
): string {
	const lines = [
		"# Trends",
		"",
		"| Task | Runs | Latest | Best | Worst | Trend |",
		"|------|------|--------|------|-------|-------|",
	];

	for (const s of summaries) {
		lines.push(
			`| ${s.task} | ${s.runs} | ${s.latest.toFixed(2)} | ${s.best.toFixed(2)} | ${s.worst.toFixed(2)} | ${s.trend} |`,
		);
	}

	lines.push("");
	lines.push(
		`${totalRuns} runs across ${summaries.length} tasks. Average latest score: ${averageLatest.toFixed(2)}`,
	);

	return lines.join("\n");
}

function formatDelta(delta: number | null): string {
	if (delta === null) return chalk.dim("---");
	const sign = delta >= 0 ? "+" : "";
	const str = `${sign}${delta.toFixed(2)}`;
	if (delta > 0.01) return chalk.green(str);
	if (delta < -0.01) return chalk.red(str);
	return chalk.dim(str);
}

function round(n: number): number {
	return Math.round(n * 100) / 100;
}
