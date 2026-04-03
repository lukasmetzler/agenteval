import { join, resolve } from "node:path";
import chalk from "chalk";
import type { Command } from "commander";
import { glob } from "glob";
import { loadConfig } from "../config/loader.js";
import type { Config } from "../config/schema.js";
import { header, kvLine, rule, scoreColor } from "../output/terminal.js";
import { executeRun } from "../run/index.js";
import { loadTask } from "../run/task-loader.js";
import type { InstructionSet, StoredResult, TaskDefinition } from "../run/types.js";
import { listResults, writeResult } from "../store/index.js";
import { logger } from "../utils/logger.js";

interface CIOptions {
	tasksDir?: string;
	minScore?: string;
	maxRegression?: string;
	instructions?: string;
	harness?: string;
	config?: string;
}

interface CITaskResult {
	task: string;
	score: number;
	previousScore: number | null;
	delta: number | null;
	status: "pass" | "fail";
	reason: string;
	runStatus: "success" | "error" | "timeout";
}

interface ResolvedCIConfig {
	config: Config;
	cwd: string;
	tasksDir: string;
	resultsDir: string;
	minScore: number;
	maxRegression: number;
	instructions: InstructionSet;
	harness?: string;
}

const VALID_HARNESSES = ["claude-code", "opencode", "copilot", "generic", "auto", "mock"];

export function registerCICommand(program: Command): void {
	program
		.command("ci")
		.description("Run all harvested eval tasks and fail if scores regress")
		.option("--tasks-dir <dir>", "directory with task YAML files")
		.option("--min-score <n>", "minimum acceptable score 0-1")
		.option("--max-regression <n>", "max allowed score drop vs previous run 0-1")
		.option("--instructions <path>", "instruction file to use")
		.option("--harness <name>", "override harness for all tasks")
		.option("-c, --config <path>", "path to agenteval.yaml")
		.action(async (options: CIOptions) => {
			try {
				await runCI(options);
			} catch (err) {
				logger.error(err instanceof Error ? err.message : String(err));
				process.exit(2);
			}
		});
}

function resolveCIConfig(options: CIOptions): ResolvedCIConfig {
	const config = loadConfig(options.config);
	const cwd = process.cwd();
	const tasksDir = resolve(cwd, options.tasksDir ?? config.ci.tasksDir);
	const resultsDir = resolve(cwd, config.run.resultsDir);
	const minScore =
		options.minScore !== undefined ? Number.parseFloat(options.minScore) : config.ci.minScore;
	const maxRegression =
		options.maxRegression !== undefined
			? Number.parseFloat(options.maxRegression)
			: config.ci.maxRegression;

	validateThresholds(minScore, maxRegression);

	if (options.harness && !VALID_HARNESSES.includes(options.harness)) {
		throw new Error(`Unknown harness "${options.harness}". Valid: ${VALID_HARNESSES.join(", ")}`);
	}

	const instructionFile = options.instructions ?? config.ci.instructions;
	const instructions: InstructionSet = {
		sourcePath: resolve(cwd, instructionFile),
		targetFilename: instructionFile.split("/").pop() ?? "CLAUDE.md",
	};

	return {
		config,
		cwd,
		tasksDir,
		resultsDir,
		minScore,
		maxRegression,
		instructions,
		harness: options.harness,
	};
}

function validateThresholds(minScore: number, maxRegression: number): void {
	if (Number.isNaN(minScore) || minScore < 0 || minScore > 1) {
		throw new Error("--min-score must be a number between 0 and 1");
	}
	if (Number.isNaN(maxRegression) || maxRegression < 0 || maxRegression > 1) {
		throw new Error("--max-regression must be a number between 0 and 1");
	}
}

function evaluateTaskResult(
	result: StoredResult,
	resultsDir: string,
	minScore: number,
	maxRegression: number,
): CITaskResult {
	const previous = findPreviousResult(resultsDir, result.task, result.id);
	const overall = result.scores.overall ?? 0;
	const previousScore = previous?.scores.overall ?? null;
	const delta = previousScore !== null ? overall - previousScore : null;

	let status: "pass" | "fail" = "pass";
	let reason = "";

	if (overall < minScore) {
		status = "fail";
		reason = `below minimum ${minScore}`;
	} else if (delta !== null && delta < -maxRegression) {
		status = "fail";
		reason = `regressed ${Math.abs(delta).toFixed(2)} (max: ${maxRegression})`;
	}

	return {
		task: result.task,
		score: overall,
		previousScore,
		delta,
		status,
		reason,
		runStatus: result.status,
	};
}

function formatDelta(delta: number | null): string {
	if (delta === null) return chalk.dim("new");
	return delta >= 0 ? chalk.green(`+${delta.toFixed(2)}`) : chalk.red(delta.toFixed(2));
}

async function runSingleTask(
	rc: ResolvedCIConfig,
	taskPath: string,
	label: string,
): Promise<CITaskResult> {
	const task = loadTask(taskPath, rc.cwd);

	if (rc.harness) {
		task.harness = rc.harness as TaskDefinition["harness"];
	}

	process.stderr.write(chalk.dim(`  ${label} Running ${task.name}...`));

	try {
		const result = await executeRun(rc.config, task, rc.instructions, rc.cwd);
		writeResult(result, rc.resultsDir);

		const taskResult = evaluateTaskResult(result, rc.resultsDir, rc.minScore, rc.maxRegression);
		const icon = taskResult.status === "pass" ? chalk.green("\u2713") : chalk.red("\u2717");
		const scoreStr = scoreColor(taskResult.score, 1);
		const deltaStr = formatDelta(taskResult.delta);
		process.stderr.write(`\r  ${label} ${task.name}  ${scoreStr}  ${deltaStr}  ${icon}\n`);
		return taskResult;
	} catch (err) {
		process.stderr.write(
			`\r  ${label} ${task.name}  ${chalk.red("ERROR")}  ${chalk.red("\u2717")}\n`,
		);
		return {
			task: task.name,
			score: 0,
			previousScore: null,
			delta: null,
			status: "fail",
			reason: err instanceof Error ? err.message : "unknown error",
			runStatus: "error",
		};
	}
}

async function runCI(options: CIOptions): Promise<void> {
	const rc = resolveCIConfig(options);

	// 1. Discover task files
	const taskFiles = await glob("*.yaml", { cwd: rc.tasksDir });
	if (taskFiles.length === 0) {
		console.error(`No task files found in ${rc.tasksDir}`);
		console.error("Run `agenteval harvest` first to generate tasks.");
		process.exit(2);
	}

	// 2. Print header
	const instructionFile = options.instructions ?? rc.config.ci.instructions;
	console.log(header("agenteval ci"));
	console.log(kvLine("Tasks", chalk.cyan(String(taskFiles.length))));
	console.log(kvLine("Instructions", chalk.cyan(instructionFile)));
	console.log(kvLine("Min score", chalk.cyan(String(rc.minScore))));
	console.log(kvLine("Max regression", chalk.cyan(String(rc.maxRegression))));
	console.log("");

	// 3. Run each task
	const results: CITaskResult[] = [];
	const startTime = performance.now();

	for (let i = 0; i < taskFiles.length; i++) {
		const taskPath = join(rc.tasksDir, taskFiles[i]);
		const label = `[${i + 1}/${taskFiles.length}]`;
		const taskResult = await runSingleTask(rc, taskPath, label);
		results.push(taskResult);
	}

	const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);

	// 4. Print summary
	printCISummary(results, elapsed);

	// 5. Exit with appropriate code
	const failures = results.filter((r) => r.status === "fail");
	if (failures.length > 0) {
		process.exit(1);
	}
}

export function findPreviousResult(
	resultsDir: string,
	taskName: string,
	currentRunId: string,
): StoredResult | null {
	const all = listResults(resultsDir, { task: taskName });
	// Skip the result we just wrote (it's the current run)
	const previous = all.find((r) => r.id !== currentRunId);
	return previous ?? null;
}

function printCISummary(results: CITaskResult[], elapsed: string): void {
	const passed = results.filter((r) => r.status === "pass").length;
	const failed = results.filter((r) => r.status === "fail").length;

	console.log("");
	console.log(rule(54));
	console.log(
		`  ${results.length} tasks \u00B7 ${passed} passed \u00B7 ${failed} failed \u00B7 ${elapsed}s`,
	);

	const failures = results.filter((r) => r.status === "fail");
	if (failures.length > 0) {
		console.log("");
		console.log(`  ${chalk.bold("Failures:")}`);
		for (const f of failures) {
			const detail = formatFailureDetail(f);
			console.log(`    ${chalk.red("\u2717")} ${f.task}  ${detail}`);
		}
		console.log("");
		console.log(`  ${chalk.red.bold("CI FAILED")}`);
	} else {
		console.log("");
		console.log(`  ${chalk.green.bold("CI PASSED")}`);
	}

	console.log("");
}

function formatFailureDetail(f: CITaskResult): string {
	if (f.runStatus === "error") return f.reason;
	if (f.previousScore !== null) {
		return `${f.score.toFixed(2)} (was ${f.previousScore.toFixed(2)}, ${f.reason})`;
	}
	return `${f.score.toFixed(2)} (${f.reason})`;
}
