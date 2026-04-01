import { resolve } from "node:path";
import type { Command } from "commander";
import { loadConfig } from "../config/loader.js";
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

function printConsoleTable(
	results: {
		id: string;
		task: string;
		harness: string;
		scores: { overall: number | null };
		status: string;
	}[],
): void {
	console.log(`\n${results.length} result(s):\n`);
	console.log(
		`  ${"ID".padEnd(25)} ${"Task".padEnd(20)} ${"Harness".padEnd(14)} ${"Score".padEnd(8)} Status`,
	);
	console.log(`  ${"─".repeat(75)}`);

	for (const r of results) {
		const score = r.scores.overall !== null ? r.scores.overall.toFixed(2) : "N/A";
		console.log(
			`  ${r.id.padEnd(25)} ${r.task.padEnd(20)} ${r.harness.padEnd(14)} ${score.padEnd(8)} ${r.status}`,
		);
	}
	console.log("");
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
