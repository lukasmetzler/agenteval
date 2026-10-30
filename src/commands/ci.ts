import { join, resolve } from "node:path";
import chalk from "chalk";
import type { Command } from "commander";
import { glob } from "glob";
import { loadConfig } from "../config/loader.js";
import type { Config } from "../config/schema.js";
import { isKnownHarness, knownHarnesses } from "../harness/registry.js";
import { formatCIJson, formatCIJunit } from "../output/ci.js";
import { header, kvLine, rule, scoreColor } from "../output/terminal.js";
import { executeRun } from "../run/index.js";
import { loadTask } from "../run/task-loader.js";
import { runTrials } from "../run/trials.js";
import type { InstructionSet, StoredResult } from "../run/types.js";
import { listResults, writeResult } from "../store/index.js";
import { logger } from "../utils/logger.js";

interface CIOptions {
	tasksDir?: string;
	minScore?: string;
	maxRegression?: string;
	instructions?: string;
	harness?: string;
	config?: string;
	parallel?: string;
	trials?: string;
	format?: string;
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
	trials?: number;
}

export function registerCICommand(program: Command): void {
	program
		.command("ci")
		.description("Run all harvested eval tasks and fail if scores regress")
		.option("--tasks-dir <dir>", "directory with task YAML files")
		.option("--min-score <n>", "minimum acceptable score 0-1")
		.option("--max-regression <n>", "max allowed score drop vs previous run 0-1")
		.option("--instructions <path>", "instruction file to use")
		.option("--harness <name>", "override harness for all tasks")
		.option("--parallel <n>", "run up to N tasks in parallel")
		.option("--trials <n>", "attempts per task; the gate uses the mean score")
		.option("--format <format>", "report format: console, json, junit", "console")
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

	if (options.harness && !isKnownHarness(options.harness, config)) {
		throw new Error(
			`Unknown harness "${options.harness}". Valid: ${knownHarnesses(config).join(", ")}, auto`,
		);
	}

	const instructionFile = options.instructions ?? config.ci.instructions;
	const instructions: InstructionSet = { sourcePath: resolve(cwd, instructionFile) };

	return {
		config,
		cwd,
		tasksDir,
		resultsDir,
		minScore,
		maxRegression,
		instructions,
		harness: options.harness,
		trials: options.trials !== undefined ? Number.parseInt(options.trials, 10) : undefined,
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
	results: StoredResult[],
	resultsDir: string,
	minScore: number,
	maxRegression: number,
): CITaskResult {
	const first = results[0];
	if (!first) throw new Error("no results to evaluate");
	const overall = meanScore(results);
	const previousScore = findPreviousScore(
		resultsDir,
		first.task,
		new Set(results.map((r) => r.id)),
	);
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

	const failed = results.find((r) => r.status !== "success");
	return {
		task: first.task,
		score: overall,
		previousScore,
		delta,
		status,
		reason,
		runStatus: failed?.status ?? "success",
	};
}

/** Mean overall score; runs without a score count as 0. */
function meanScore(results: StoredResult[]): number {
	return results.reduce((sum, r) => sum + (r.scores.overall ?? 0), 0) / results.length;
}

/**
 * Score of the most recent earlier run of a task. When that run was one of
 * several trials, the mean over its whole trial group.
 */
export function findPreviousScore(
	resultsDir: string,
	taskName: string,
	currentIds: Set<string>,
): number | null {
	const all = listResults(resultsDir, { task: taskName }).filter((r) => !currentIds.has(r.id));
	const latest = all.find((r) => r.trial?.arm !== "baseline");
	if (!latest) return null;
	const group = latest.trial?.group;
	if (!group) return latest.scores.overall ?? 0;
	return meanScore(all.filter((r) => r.trial?.group === group && r.trial.arm === "instructions"));
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
		task.harness = rc.harness;
	}

	process.stderr.write(chalk.dim(`  ${label} Running ${task.name}...`));

	try {
		const trials = rc.trials ?? task.trials ?? 1;
		const runs =
			trials > 1
				? (
						await runTrials({
							config: rc.config,
							task,
							instructions: rc.instructions,
							cwd: rc.cwd,
							trials,
							baseline: false,
						})
					).instructions
				: [await executeRun(rc.config, task, rc.instructions, rc.cwd)];
		for (const run of runs) writeResult(run, rc.resultsDir);

		const taskResult = evaluateTaskResult(runs, rc.resultsDir, rc.minScore, rc.maxRegression);
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

	const format = options.format ?? "console";
	if (!["console", "json", "junit"].includes(format)) {
		throw new Error(`Unknown format "${format}". Valid: console, json, junit`);
	}
	// Machine formats own stdout; the human header goes to stderr with the progress lines.
	const out = format === "console" ? console.log : console.error;

	// 2. Print header
	const instructionFile = options.instructions ?? rc.config.ci.instructions;
	out(header("agenteval ci"));
	out(kvLine("Tasks", chalk.cyan(String(taskFiles.length))));
	out(kvLine("Instructions", chalk.cyan(instructionFile)));
	out(kvLine("Min score", chalk.cyan(String(rc.minScore))));
	out(kvLine("Max regression", chalk.cyan(String(rc.maxRegression))));
	out("");

	// 3. Run tasks (sequential or parallel)
	const concurrency = options.parallel ? Math.max(1, Number.parseInt(options.parallel, 10)) : 1;
	const results: CITaskResult[] = [];
	const startTime = performance.now();

	if (concurrency > 1) {
		out(kvLine("Parallel", chalk.cyan(String(concurrency))));
		results.push(...(await runTasksParallel(rc, taskFiles, concurrency)));
	} else {
		for (let i = 0; i < taskFiles.length; i++) {
			const taskPath = join(rc.tasksDir, taskFiles[i]);
			const label = `[${i + 1}/${taskFiles.length}]`;
			const taskResult = await runSingleTask(rc, taskPath, label);
			results.push(taskResult);
		}
	}

	const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);

	// 4. Print summary
	if (format === "json") console.log(formatCIJson(results, Number(elapsed)));
	else if (format === "junit") console.log(formatCIJunit(results, Number(elapsed)));
	else printCISummary(results, elapsed);

	// 5. Exit with appropriate code
	const failures = results.filter((r) => r.status === "fail");
	if (failures.length > 0) {
		process.exit(1);
	}
}

async function runTasksParallel(
	rc: ResolvedCIConfig,
	taskFiles: string[],
	concurrency: number,
): Promise<CITaskResult[]> {
	const results: CITaskResult[] = new Array(taskFiles.length);
	let nextIndex = 0;

	async function worker(): Promise<void> {
		while (nextIndex < taskFiles.length) {
			const i = nextIndex++;
			const taskPath = join(rc.tasksDir, taskFiles[i]);
			const label = `[${i + 1}/${taskFiles.length}]`;
			results[i] = await runSingleTask(rc, taskPath, label);
		}
	}

	const workers = Array.from({ length: Math.min(concurrency, taskFiles.length) }, () => worker());
	await Promise.all(workers);
	return results;
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
