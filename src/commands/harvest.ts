import type { Command } from "commander";
import { loadConfig } from "../config/loader.js";
import { harvest } from "../harvest/index.js";
import type { HarvestOptions, HarvestResult } from "../harvest/types.js";
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
	config?: string;
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
		.option("-c, --config <path>", "path to agenteval.yaml")
		.action(async (cliOptions: HarvestCliOptions) => {
			try {
				const config = loadConfig(cliOptions.config);
				const options = buildOptions(cliOptions, config);

				validateOptions(options, cliOptions);

				const result = await harvest(options);

				if (cliOptions.format === "json") {
					console.log(JSON.stringify(result, null, 2));
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
		format: (cli.format as "yaml" | "json") ?? "yaml",
		harness:
			(cli.harness as HarvestOptions["harness"]) ??
			(config.harvest.defaultHarness as HarvestOptions["harness"]),
		timeout: cli.timeout ? Number.parseInt(cli.timeout, 10) : config.harvest.defaultTimeout,
		minConfidence: cli.minConfidence
			? Number.parseFloat(cli.minConfidence)
			: config.harvest.minConfidence,
	};
}

function validateOptions(options: HarvestOptions, cli: HarvestCliOptions): void {
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
	console.log("\n  Harvest Dry Run");
	console.log("  ═══════════════\n");
	console.log(`  Commits scanned:   ${result.commitsScanned}`);
	console.log(`  AI commits found:  ${result.aiCommitsDetected}`);

	if (result.tasks.length > 0) {
		console.log("\n  Detected tasks:");
		for (const name of result.tasks) {
			console.log(`    • ${name}`);
		}
	}

	if (result.skipped.length > 0) {
		console.log(`\n  Skipped: ${result.skipped.length}`);
		for (const { hash, reason } of result.skipped) {
			console.log(`    • ${hash}: ${reason}`);
		}
	}

	if (result.aiCommitsDetected === 0) {
		console.log("\n  No AI-involved commits detected.");
		console.log("  Try --min-confidence 0.3 to lower the threshold,");
		console.log("  or check that your AI tool adds Co-authored-by trailers.");
	}

	console.log();
}

function printSummary(result: HarvestResult): void {
	console.log("\n  Harvest Complete");
	console.log("  ════════════════\n");
	console.log(`  Commits scanned:   ${result.commitsScanned}`);
	console.log(`  AI commits found:  ${result.aiCommitsDetected}`);
	console.log(`  Tasks emitted:     ${result.tasksEmitted}`);

	if (result.skipped.length > 0) {
		console.log(`  Skipped:           ${result.skipped.length}`);
	}

	if (result.tasks.length > 0) {
		console.log("\n  Written files:");
		for (const path of result.tasks) {
			console.log(`    • ${path}`);
		}
	}

	if (result.aiCommitsDetected === 0) {
		console.log("\n  No AI-involved commits detected.");
		console.log("  Try --min-confidence 0.3 to lower the threshold,");
		console.log("  or check that your AI tool adds Co-authored-by trailers.");
	}

	console.log();
}
