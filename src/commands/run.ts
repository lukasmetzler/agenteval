import { resolve } from "node:path";
import chalk from "chalk";
import type { Command } from "commander";
import { loadConfig } from "../config/loader.js";
import { header, kvLine, scoreColor } from "../output/terminal.js";
import { executeRun } from "../run/index.js";
import { loadTask } from "../run/task-loader.js";
import type { InstructionSet, StoredResult, TaskDefinition } from "../run/types.js";
import { writeResult } from "../store/index.js";
import { logger } from "../utils/logger.js";

interface RunOptions {
	task: string;
	harness?: string;
	instructions?: string;
	config?: string;
}

const VALID_HARNESSES = [
	"claude-code",
	"cursor",
	"opencode",
	"windsurf",
	"copilot",
	"generic",
	"auto",
	"mock",
];

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

				validateHarness(options, task);
				const instructions = resolveInstructions(options, cwd);

				logger.info(`Starting eval run: task="${task.name}" harness="${task.harness}"`);
				const result = await executeRun(config, task, instructions, cwd);

				const resultsDir = resolve(cwd, config.run.resultsDir);
				writeResult(result, resultsDir);
				printResult(result, resultsDir);
			} catch (err) {
				logger.error(err instanceof Error ? err.message : String(err));
				process.exit(2);
			}
		});
}

function validateHarness(options: RunOptions, task: TaskDefinition): void {
	if (!options.harness) return;
	if (!VALID_HARNESSES.includes(options.harness)) {
		logger.error(`Unknown harness "${options.harness}". Valid: ${VALID_HARNESSES.join(", ")}`);
		process.exit(2);
	}
	task.harness = options.harness as typeof task.harness;
}

function resolveInstructions(options: RunOptions, cwd: string): InstructionSet {
	const instructionFile = options.instructions ?? "CLAUDE.md";
	const resolvedPath = resolve(cwd, instructionFile);

	if (!resolvedPath.startsWith(resolve(cwd))) {
		logger.error(`Instruction path "${instructionFile}" escapes project directory`);
		process.exit(2);
	}

	return {
		sourcePath: resolvedPath,
		targetFilename: instructionFile.split("/").pop() ?? "CLAUDE.md",
	};
}

function printResult(result: StoredResult, resultsDir: string): void {
	if (result.status === "success") {
		console.log(header("agenteval run"));
		const overall = result.scores.overall;
		const scoreStr = overall !== null && overall !== undefined ? scoreColor(overall, 1) : "N/A";
		console.log(kvLine("Task", chalk.cyan(result.task)));
		console.log(kvLine("Score", `${scoreStr}${chalk.dim("/1.0")}`));
		console.log(kvLine("Files changed", result.diffSummary));
		if (result.metrics.tokensTotal !== null) {
			console.log(kvLine("Tokens", `~${result.metrics.tokensTotal}`));
		}
		console.log(kvLine("Result", chalk.green.bold("success")));
		console.log(kvLine("Saved to", chalk.dim(`${resultsDir}/${result.id}.json`)));
		console.log();
		process.exit(0);
	}

	console.error(header("agenteval run"));
	console.error(kvLine("Task", chalk.cyan(result.task)));
	console.error(kvLine("Result", chalk.red.bold(result.status)));
	if (result.error) {
		console.error(kvLine("Error", chalk.dim(result.error)));
	}
	process.exit(1);
}
