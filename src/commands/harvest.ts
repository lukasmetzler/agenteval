import chalk from "chalk";
import type { Command } from "commander";
import { loadConfig } from "../config/loader.js";
import { harvest } from "../harvest/index.js";
import type { HarvestOptions, HarvestResult, LiveReviewResult } from "../harvest/types.js";
import { header, kvLine, padEnd, scoreColor } from "../output/terminal.js";
import { logger } from "../utils/logger.js";

interface HarvestCliOptions {
	since?: string;
	until?: string;
	commit?: string;
	output?: string;
	dryRun?: boolean;
	force?: boolean;
	format?: string;
	harness?: string;
	timeout?: string;
	minConfidence?: string;
	github?: boolean;
	config?: string;
	live?: boolean;
	analyze?: boolean;
}

const VALID_HARNESSES = ["claude-code", "opencode", "copilot", "generic", "auto"];

export function registerHarvestCommand(program: Command): void {
	program
		.command("harvest")
		.description("Mine git history for AI-involved commits to build eval datasets")
		.option("--since <date>", "only scan commits after this date")
		.option("--until <date>", "only scan commits before this date")
		.option("--commit <hash>", "scan a single commit")
		.option("--output <dir>", "output directory for task YAML files")
		.option("--dry-run", "list detected commits without writing files")
		.option("--force", "overwrite existing task files")
		.option("--format <type>", "output format: yaml or json", "yaml")
		.option("--harness <name>", "harness to set in emitted tasks")
		.option("--timeout <seconds>", "timeout to set in emitted tasks")
		.option("--min-confidence <number>", "minimum confidence threshold (0-1)")
		.option("--github", "enrich tasks with GitHub PR data (requires gh CLI)")
		.option("--live", "review current working tree changes against heuristics")
		.option("--analyze", "include LLM-assisted rubrics in live review (requires --live)")
		.option("-c, --config <path>", "path to agenteval.yaml")
		.action(async (cliOptions: HarvestCliOptions) => {
			try {
				const config = loadConfig(cliOptions.config);
				const options = buildOptions(cliOptions, config);

				validateOptions(options, cliOptions);

				if (cliOptions.format !== "json" && !options.dryRun && !options.live) {
					process.stderr.write(chalk.dim("  Scanning git history...\n"));
				}

				const result = await harvest(options);

				if (cliOptions.format === "json") {
					console.log(JSON.stringify(result, null, 2));
				} else if (result.liveReview) {
					printLiveReview(result.liveReview);
				} else if (options.dryRun) {
					printDryRun(result);
				} else {
					printSummary(result);
				}
			} catch (err) {
				logger.error(err instanceof Error ? err.message : String(err));
				process.exit(2);
			}
		});
}

function buildOptions(
	cli: HarvestCliOptions,
	config: {
		harvest: {
			outputDir: string;
			minConfidence: number;
			defaultHarness: string;
			defaultTimeout: number;
		};
	},
): HarvestOptions {
	return {
		repoPath: process.cwd(),
		since: cli.since,
		until: cli.until,
		commit: cli.commit,
		outputDir: cli.output ?? config.harvest.outputDir,
		dryRun: cli.dryRun ?? false,
		force: cli.force ?? false,
		harness:
			(cli.harness as HarvestOptions["harness"]) ??
			(config.harvest.defaultHarness as HarvestOptions["harness"]),
		timeout: cli.timeout ? Number.parseInt(cli.timeout, 10) : config.harvest.defaultTimeout,
		minConfidence: cli.minConfidence
			? Number.parseFloat(cli.minConfidence)
			: config.harvest.minConfidence,
		github: cli.github ?? false,
		live: cli.live ?? false,
		analyze: cli.analyze ?? false,
	};
}

function validateOptions(options: HarvestOptions, cli: HarvestCliOptions): void {
	if (cli.analyze && !cli.live) {
		throw new Error("--analyze requires --live");
	}

	if (cli.harness && !VALID_HARNESSES.includes(cli.harness)) {
		throw new Error(
			`Invalid harness "${cli.harness}". Valid options: ${VALID_HARNESSES.join(", ")}`,
		);
	}

	if (
		options.minConfidence !== undefined &&
		(Number.isNaN(options.minConfidence) || options.minConfidence < 0 || options.minConfidence > 1)
	) {
		throw new Error("--min-confidence must be a number between 0 and 1");
	}

	if (options.timeout !== undefined && (options.timeout < 1 || !Number.isFinite(options.timeout))) {
		throw new Error("--timeout must be a positive number");
	}
}

function printDryRun(result: HarvestResult): void {
	const rate =
		result.commitsScanned > 0
			? Math.round((result.aiCommitsDetected / result.commitsScanned) * 100)
			: 0;

	console.log(header("agenteval harvest · dry run"));
	console.log(kvLine("Commits scanned", chalk.cyan(String(result.commitsScanned))));
	console.log(
		kvLine(
			"AI-assisted",
			`${chalk.green.bold(String(result.aiCommitsDetected))} ${chalk.dim(`(${rate}%)`)}`,
		),
	);
	console.log(kvLine("Tasks to emit", chalk.cyan(String(result.tasks.length))));

	if (result.skipped.length > 0) {
		console.log(kvLine("Skipped", chalk.dim(String(result.skipped.length))));
	}

	if (result.tasks.length > 0) {
		const MAX_SHOWN = 10;
		const shown = result.tasks.slice(0, MAX_SHOWN);
		const remaining = result.tasks.length - MAX_SHOWN;
		console.log("");
		for (const name of shown) {
			console.log(`    ${chalk.dim("·")} ${chalk.green(name)}`);
		}
		if (remaining > 0) {
			console.log(`    ${chalk.dim(`... and ${remaining} more`)}`);
		}
	}

	if (result.aiCommitsDetected === 0) {
		console.log(`\n  ${chalk.yellow("No AI-involved commits detected.")}`);
		console.log(
			chalk.dim("  Try --min-confidence 0.3 or check your AI tool adds Co-authored-by trailers."),
		);
	}

	console.log();
}

function printSummary(result: HarvestResult): void {
	console.log(header("agenteval harvest"));
	console.log(kvLine("Commits scanned", chalk.cyan(String(result.commitsScanned))));
	console.log(kvLine("AI-assisted", chalk.green.bold(String(result.aiCommitsDetected))));
	console.log(kvLine("Tasks written", chalk.green.bold(String(result.tasksEmitted))));

	if (result.skipped.length > 0) {
		console.log(kvLine("Skipped", chalk.dim(String(result.skipped.length))));
	}

	if (result.tasks.length > 0) {
		const MAX_SHOWN = 10;
		const shown = result.tasks.slice(0, MAX_SHOWN);
		const remaining = result.tasks.length - MAX_SHOWN;
		console.log("");
		for (const path of shown) {
			console.log(`    ${chalk.dim("→")} ${chalk.cyan(path)}`);
		}
		if (remaining > 0) {
			console.log(`    ${chalk.dim(`... and ${remaining} more`)}`);
		}
	}

	if (result.aiCommitsDetected === 0) {
		console.log(`\n  ${chalk.yellow("No AI-involved commits detected.")}`);
		console.log(
			chalk.dim("  Try --min-confidence 0.3 or check your AI tool adds Co-authored-by trailers."),
		);
	}

	console.log();
}

function printLiveReview(result: LiveReviewResult): void {
	console.log(header("agenteval review"));

	if (result.rubrics.length === 0) {
		console.log(`  ${chalk.green("✓")} ${chalk.dim("No uncommitted changes to review")}`);
		console.log();
		return;
	}

	console.log(kvLine("Files analyzed", chalk.cyan(String(result.filesAnalyzed))));
	console.log(kvLine("Overall score", `${scoreColor(result.overallScore)}${chalk.dim("/10")}`));

	const nameWidth = 22;
	const scoreWidth = 7;
	const detailWidth = 34;

	const border = (left: string, mid: string, right: string) =>
		`  ${chalk.dim(`${left}${"─".repeat(nameWidth)}${mid}${"─".repeat(scoreWidth)}${mid}${"─".repeat(detailWidth)}${right}`)}`;

	console.log();
	console.log(border("┌", "┬", "┐"));
	console.log(
		`  ${chalk.dim("│")} ${padEnd("Rubric", nameWidth - 2)} ${chalk.dim("│")} ${padEnd("Score", scoreWidth - 2)} ${chalk.dim("│")} ${padEnd("Details", detailWidth - 2)} ${chalk.dim("│")}`,
	);
	console.log(border("├", "┼", "┤"));

	for (const rubric of result.rubrics) {
		const displayName = rubric.name
			.split("-")
			.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
			.join(" ");
		const colorFn = rubric.score >= 8 ? chalk.green : rubric.score >= 5 ? chalk.yellow : chalk.red;
		const scoreStr = colorFn(`${rubric.score}/${rubric.maxScore}`);
		const detailStr = rubric.details.join("; ");

		console.log(
			`  ${chalk.dim("│")} ${padEnd(chalk.bold(displayName), nameWidth - 2)} ${chalk.dim("│")} ${padEnd(scoreStr, scoreWidth - 2)} ${chalk.dim("│")} ${padEnd(detailStr, detailWidth - 2)} ${chalk.dim("│")}`,
		);
	}

	console.log(border("└", "┴", "┘"));
	console.log();
}
