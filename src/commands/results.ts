import { resolve } from "node:path";
import chalk from "chalk";
import type { Command } from "commander";
import { loadConfig } from "../config/loader.js";
import { header, padEnd, scoreColor } from "../output/terminal.js";
import { listResults, parseRetention, pruneResults } from "../store/index.js";
import { logger } from "../utils/logger.js";

interface ResultsOptions {
	prune?: boolean;
	export?: string;
	task?: string;
	harness?: string;
	limit?: string;
	config?: string;
}

export function registerResultsCommand(program: Command): void {
	program
		.command("results")
		.description("View and manage eval run results")
		.option("--prune", "remove results older than retention period")
		.option("--export <format>", "export format: json, markdown")
		.option("--task <name>", "filter by task name")
		.option("--harness <name>", "filter by harness")
		.option("--limit <n>", "max results to show")
		.option("-c, --config <path>", "path to agenteval.yaml")
		.action((options: ResultsOptions) => {
			try {
				const config = loadConfig(options.config);
				const resultsDir = resolve(process.cwd(), config.run.resultsDir);

				if (options.prune) {
					handlePrune(config, resultsDir);
					return;
				}

				const results = listResults(resultsDir, {
					task: options.task,
					harness: options.harness,
					limit: options.limit ? Number.parseInt(options.limit, 10) : undefined,
				});

				if (results.length === 0) {
					console.log("No results found. Run `agenteval run` first.");
					process.exit(0);
				}

				outputResults(results, options.export);
			} catch (err) {
				logger.error(err instanceof Error ? err.message : String(err));
				process.exit(2);
			}
		});
}

function handlePrune(config: { run: { resultRetention: string } }, resultsDir: string): void {
	const days = parseRetention(config.run.resultRetention);
	const pruned = pruneResults(resultsDir, days);
	console.log(`Pruned ${pruned} result(s) older than ${config.run.resultRetention}`);
	process.exit(0);
}

function outputResults(
	results: {
		id: string;
		task: string;
		harness: string;
		scores: { overall: number | null };
		status: string;
		timestamp: string;
	}[],
	format?: string,
): void {
	if (format === "json") {
		console.log(JSON.stringify(results, null, 2));
	} else if (format === "markdown") {
		console.log(formatResultsMarkdown(results));
	} else {
		printConsoleTable(results);
	}
	process.exit(0);
}

function colorizeResultScore(score: number | null): string {
	if (score === null) return "N/A";
	return scoreColor(score, 1);
}

function colorizeStatus(status: string): string {
	if (status === "success") return chalk.green(status);
	if (status === "error") return chalk.red(status);
	if (status === "timeout") return chalk.yellow(status);
	return status;
}

function printConsoleTable(
	results: {
		id: string;
		task: string;
		harness: string;
		scores: { overall: number | null };
		status: string;
	}[],
): void {
	const idW = 26;
	const taskW = 18;
	const harnessW = 13;
	const scoreW = 7;
	const statusW = 9;

	const border = (left: string, mid: string, right: string) =>
		`  ${chalk.dim(`${left}${"─".repeat(idW)}${mid}${"─".repeat(taskW)}${mid}${"─".repeat(harnessW)}${mid}${"─".repeat(scoreW)}${mid}${"─".repeat(statusW)}${right}`)}`;

	console.log(header(`Results (${results.length})`));
	console.log(border("┌", "┬", "┐"));
	console.log(
		`  ${chalk.dim("│")} ${padEnd("ID", idW - 2)} ${chalk.dim("│")} ${padEnd("Task", taskW - 2)} ${chalk.dim("│")} ${padEnd("Harness", harnessW - 2)} ${chalk.dim("│")} ${padEnd("Score", scoreW - 2)} ${chalk.dim("│")} ${padEnd("Status", statusW - 2)} ${chalk.dim("│")}`,
	);
	console.log(border("├", "┼", "┤"));

	for (const r of results) {
		const score = colorizeResultScore(r.scores.overall);
		const status = colorizeStatus(r.status);
		console.log(
			`  ${chalk.dim("│")} ${padEnd(r.id, idW - 2)} ${chalk.dim("│")} ${padEnd(r.task, taskW - 2)} ${chalk.dim("│")} ${padEnd(r.harness, harnessW - 2)} ${chalk.dim("│")} ${padEnd(score, scoreW - 2)} ${chalk.dim("│")} ${padEnd(status, statusW - 2)} ${chalk.dim("│")}`,
		);
	}

	console.log(border("└", "┴", "┘"));
	console.log();
}

function formatResultsMarkdown(
	results: {
		id: string;
		task: string;
		harness: string;
		scores: { overall: number | null };
		status: string;
		timestamp: string;
	}[],
): string {
	const lines = [
		"# Eval Results",
		"",
		"| ID | Task | Harness | Score | Status | Date |",
		"|-----|------|---------|-------|--------|------|",
	];

	for (const r of results) {
		const score = r.scores.overall !== null ? r.scores.overall.toFixed(2) : "N/A";
		const date = r.timestamp.split("T")[0];
		lines.push(`| ${r.id} | ${r.task} | ${r.harness} | ${score} | ${r.status} | ${date} |`);
	}

	return lines.join("\n");
}
