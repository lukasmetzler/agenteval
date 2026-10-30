import { resolve } from "node:path";
import chalk from "chalk";
import type { Command } from "commander";
import { loadConfig } from "../config/loader.js";
import type { Config } from "../config/schema.js";
import { isKnownHarness, knownHarnesses } from "../harness/registry.js";
import { header, kvLine, scoreColor } from "../output/terminal.js";
import { buildTrialReport, formatTrialReport } from "../output/trials.js";
import { executeRun } from "../run/index.js";
import { loadTask } from "../run/task-loader.js";
import { runTrials } from "../run/trials.js";
import type { InstructionSet, StoredResult, TaskDefinition } from "../run/types.js";
import { writeResult } from "../store/index.js";
import { logger } from "../utils/logger.js";

interface RunOptions {
	task: string;
	harness?: string;
	model?: string;
	instructions?: string;
	trials?: string;
	baseline?: boolean;
	format?: string;
	config?: string;
}

export function registerRunCommand(program: Command): void {
	program
		.command("run")
		.description("Run a task against current instructions and measure the outcome")
		.requiredOption("--task <task>", "task description, YAML file path, or task name from tasks/")
		.option(
			"--harness <name>",
			"agent to run: claude-code, codex, gemini, antigravity, copilot, cursor, opencode, devin, amp, a harnesses: key, or mock",
		)
		.option("--model <model>", "model passed to the agent CLI (overrides the task's model)")
		.option("--instructions <path>", "alternative instruction file to inject")
		.option("--trials <n>", "independent attempts (default: task trials or 1; 3+ recommended)")
		.option(
			"--baseline",
			"also run each trial with every instruction file removed and report the Δ",
		)
		.option("--format <format>", "output format: console or json", "console")
		.option("-c, --config <path>", "path to agenteval.yaml")
		.action(async (options: RunOptions) => {
			try {
				const cwd = process.cwd();
				const config = loadConfig(options.config);
				const task = loadTask(options.task, cwd);

				validateHarness(options, task, config);
				if (options.model) task.model = options.model;
				const instructions = resolveInstructions(options, cwd);

				const trials = resolveTrials(options, task);
				const resultsDir = resolve(cwd, config.run.resultsDir);
				logger.info(
					`Starting eval run: task="${task.name}" harness="${task.harness}" trials=${trials}${options.baseline ? " +baseline" : ""}`,
				);

				if (trials === 1 && !options.baseline && options.format !== "json") {
					const result = await executeRun(config, task, instructions, cwd);
					writeResult(result, resultsDir);
					printResult(result, resultsDir);
					return;
				}

				await runTrialsAndReport({ config, task, instructions, cwd, trials, resultsDir, options });
			} catch (err) {
				logger.error(err instanceof Error ? err.message : String(err));
				process.exit(2);
			}
		});
}

async function runTrialsAndReport(args: {
	config: Config;
	task: TaskDefinition;
	instructions: InstructionSet;
	cwd: string;
	trials: number;
	resultsDir: string;
	options: RunOptions;
}): Promise<never> {
	const { options, resultsDir } = args;
	const run = await runTrials({
		config: args.config,
		task: args.task,
		instructions: args.instructions,
		cwd: args.cwd,
		trials: args.trials,
		baseline: options.baseline ?? false,
		onResult: (r) => {
			writeResult(r, resultsDir);
			const where = r.trial ? `[${r.trial.arm} ${r.trial.index}/${r.trial.of}] ` : "";
			logger.info(`${where}${r.status} score=${r.scores.overall?.toFixed(2) ?? "n/a"}`);
		},
	});
	const report = buildTrialReport(run);
	console.log(
		options.format === "json"
			? JSON.stringify(report, null, 2)
			: formatTrialReport(report, args.task.name),
	);
	const all = [...run.instructions, ...(run.baseline ?? [])];
	process.exit(all.every((r) => r.status === "success") ? 0 : 1);
}

function resolveTrials(options: RunOptions, task: TaskDefinition): number {
	const raw = options.trials ?? String(task.trials ?? 1);
	const trials = Number.parseInt(raw, 10);
	if (!Number.isInteger(trials) || trials < 1 || trials > 100) {
		logger.error(`--trials must be an integer between 1 and 100, got "${raw}"`);
		process.exit(2);
	}
	return trials;
}

function validateHarness(options: RunOptions, task: TaskDefinition, config: Config): void {
	if (!options.harness) return;
	if (!isKnownHarness(options.harness, config)) {
		logger.error(
			`Unknown harness "${options.harness}". Valid: ${knownHarnesses(config).join(", ")}, auto`,
		);
		process.exit(2);
	}
	task.harness = options.harness;
}

function resolveInstructions(options: RunOptions, cwd: string): InstructionSet {
	const instructionFile = options.instructions ?? "CLAUDE.md";
	const resolvedPath = resolve(cwd, instructionFile);

	if (!resolvedPath.startsWith(resolve(cwd))) {
		logger.error(`Instruction path "${instructionFile}" escapes project directory`);
		process.exit(2);
	}

	return { sourcePath: resolvedPath };
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
		if (result.metrics.costUsd != null) {
			console.log(kvLine("Cost", `$${result.metrics.costUsd.toFixed(4)}`));
		}
		if (result.model) console.log(kvLine("Model", result.model));
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
