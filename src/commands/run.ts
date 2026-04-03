import { resolve } from "node:path";
import chalk from "chalk";
import type { Command } from "commander";
import { loadConfig } from "../config/loader.js";
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

const VALID_HARNESSES = ["claude-code", "opencode", "copilot", "generic", "auto", "mock"];

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

function colorizeRunScore(score: number | null | undefined): string {
	if (score === null || score === undefined) return "N/A";
	const str = score.toFixed(2);
	if (score >= 0.7) return chalk.green(str);
	if (score >= 0.4) return chalk.yellow(str);
	return chalk.red(str);
}

function printResult(result: StoredResult, resultsDir: string): void {
	if (result.status === "success") {
		console.log(`\n${chalk.green(`✓ Run complete: ${result.id}`)}`);
		console.log(`  Score: ${colorizeRunScore(result.scores.overall)}`);
		console.log(`  Files changed: ${result.diffSummary}`);
		if (result.metrics.tokensTotal !== null) {
			console.log(`  Tokens: ~${result.metrics.tokensTotal}`);
		}
		console.log(`  Saved to: ${resultsDir}/${result.id}.json`);
		process.exit(0);
	}

	console.error(`\n${chalk.red(`✗ Run ${result.status}: ${result.id}`)}`);
	console.error(`  ${chalk.dim(result.error)}`);
	process.exit(1);
}
