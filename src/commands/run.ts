import { resolve } from "node:path";
import type { Command } from "commander";
import { loadConfig } from "../config/loader.js";
import { executeRun } from "../run/index.js";
import { loadTask } from "../run/task-loader.js";
import { writeResult } from "../store/index.js";
import { logger } from "../utils/logger.js";

interface RunOptions {
	task: string;
	harness?: string;
	instructions?: string;
	config?: string;
}

export function registerRunCommand(program: Command): void {
	program
		.command("run")
		.description("Run a task against current instructions and measure the outcome")
		.requiredOption("--task <task>", "task description, YAML file path, or task name from tasks/")
		.option("--harness <name>", "harness to use: claude-code, opencode, generic, mock")
		.option("--instructions <path>", "alternative instruction file to inject")
		.option("-c, --config <path>", "path to agenteval.yaml")
		.action(async (options: RunOptions) => {
			try {
				const cwd = process.cwd();
				const config = loadConfig(options.config);
				const task = loadTask(options.task, cwd);

				if (options.harness) {
					task.harness = options.harness as typeof task.harness;
				}

				const instructionFile = options.instructions ?? "CLAUDE.md";
				const instructions = {
					sourcePath: resolve(cwd, instructionFile),
					targetFilename: instructionFile.split("/").pop() ?? "CLAUDE.md",
				};

				logger.info(`Starting eval run: task="${task.name}" harness="${task.harness}"`);

				const result = await executeRun(config, task, instructions, cwd);

				const resultsDir = resolve(cwd, config.run.resultsDir);
				writeResult(result, resultsDir);

				if (result.status === "success") {
					console.log(`\n✓ Run complete: ${result.id}`);
					console.log(`  Score: ${result.scores.overall?.toFixed(2) ?? "N/A"}`);
					console.log(`  Files changed: ${result.diffSummary}`);
					if (result.metrics.tokensTotal !== null) {
						console.log(`  Tokens: ~${result.metrics.tokensTotal}`);
					}
					console.log(`  Saved to: ${resultsDir}/${result.id}.json`);
					process.exit(0);
				}

				console.error(`\n✗ Run ${result.status}: ${result.id}`);
				console.error(`  ${result.error}`);
				process.exit(1);
			} catch (err) {
				logger.error(err instanceof Error ? err.message : String(err));
				process.exit(2);
			}
		});
}
