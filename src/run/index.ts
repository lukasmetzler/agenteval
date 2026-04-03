import type { Config } from "../config/schema.js";
import { detectHarness, getAdapter } from "../harness/registry.js";
import { logger } from "../utils/logger.js";
import { scoreRun } from "./scorer.js";
import type { InstructionSet, StoredResult, TaskDefinition } from "./types.js";
import { cleanStaleWorktrees, createWorktree, generateRunId, removeWorktree } from "./worktree.js";

/**
 * Execute a single eval run.
 *
 * Flow:
 * 1. Clean stale worktrees
 * 2. Resolve harness adapter
 * 3. Create isolated worktree
 * 4. Inject instructions → run agent → capture diff → run test commands → score
 * 5. Clean up worktree (always, even on error)
 * 6. Return structured result
 */
export async function executeRun(
	config: Config,
	task: TaskDefinition,
	instructions: InstructionSet,
	cwd: string,
): Promise<StoredResult> {
	const runId = generateRunId(config.run.resultsDir);
	const timestamp = new Date().toISOString();

	// Step 1: Clean stale worktrees
	const cleaned = await cleanStaleWorktrees(
		cwd,
		config.run.worktreesDir,
		config.run.staleWorktreeMaxAge,
	);
	if (cleaned > 0) {
		logger.warn(`Cleaned ${cleaned} stale worktree(s)`);
	}

	// Step 2: Resolve harness
	const harnessName = task.harness === "auto" ? detectHarness(cwd) : task.harness;
	const adapter = getAdapter(harnessName, config);

	const available = await adapter.isAvailable();
	if (!available) {
		return makeErrorResult(
			runId,
			timestamp,
			task,
			harnessName,
			instructions,
			`Harness "${harnessName}" is not available on this system`,
		);
	}

	// Step 3-5: Create worktree → run → cleanup
	let worktreePath: string | null = null;
	try {
		worktreePath = await createWorktree(runId, cwd, config.run.worktreesDir);
		logger.info(`Running task "${task.name}" with ${harnessName} in ${worktreePath}`);

		// Inject instructions
		await adapter.injectInstructions(worktreePath, instructions);

		// Run agent
		const timeout = task.timeout ?? config.run.timeout;
		const rawResult = await adapter.runTask(worktreePath, task, timeout);

		if (rawResult.timedOut) {
			return makeErrorResult(
				runId,
				timestamp,
				task,
				harnessName,
				instructions,
				`Timed out after ${timeout} seconds`,
				"timeout",
			);
		}

		if (rawResult.exitCode !== 0 && !rawResult.stdout) {
			return makeErrorResult(
				runId,
				timestamp,
				task,
				harnessName,
				instructions,
				`Agent exited with code ${rawResult.exitCode}: ${rawResult.stderr.slice(0, 500)}`,
			);
		}

		// Capture git diff
		const diff = await captureGitDiff(worktreePath);
		const changedFiles = parseChangedFiles(diff);

		// Run test/lint assertion commands
		const testResults = await runAssertionCommands(task, worktreePath);

		// Parse metrics
		const metrics = adapter.parseMetrics(rawResult);

		// Score
		const expectedPatterns = task.assertions
			.filter((a) => a.type === "files-changed" && a.pattern)
			.map((a) => a.pattern as string);

		const { scores, assertionResults } = scoreRun({
			assertions: task.assertions,
			weights: task.scoring,
			changedFiles,
			diff,
			testResults,
			metrics,
			tokensBudget: config.run.tokensBudget,
			expectedFilePatterns: expectedPatterns,
			detectionConfidence: task.detectionConfidence,
		});

		return {
			id: runId,
			timestamp,
			task: task.name,
			harness: harnessName,
			instructions: `${instructions.sourcePath}`,
			status: "success",
			metrics,
			scores,
			assertions: assertionResults,
			diffSummary: summarizeDiff(diff),
			model: null,
			sourceCommit: task.sourceCommit,
			instructionSnapshot: task.instructionSnapshot,
			prUrl: task.prUrl,
			detectionConfidence: task.detectionConfidence,
		};
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return makeErrorResult(runId, timestamp, task, harnessName, instructions, message);
	} finally {
		if (worktreePath) {
			await removeWorktree(worktreePath, cwd);
		}
	}
}

function makeErrorResult(
	id: string,
	timestamp: string,
	task: TaskDefinition,
	harness: string,
	instructions: InstructionSet,
	error: string,
	status: "error" | "timeout" = "error",
): StoredResult {
	return {
		id,
		timestamp,
		task: task.name,
		harness,
		instructions: instructions.sourcePath,
		status,
		metrics: {
			tokensInput: null,
			tokensOutput: null,
			tokensTotal: null,
			tokenSource: "unavailable",
		},
		scores: {
			correctness: null,
			precision: null,
			efficiency: null,
			conventions: null,
			overall: null,
		},
		assertions: [],
		diffSummary: "",
		model: null,
		error,
		sourceCommit: task.sourceCommit,
		instructionSnapshot: task.instructionSnapshot,
		prUrl: task.prUrl,
		detectionConfidence: task.detectionConfidence,
	};
}

async function captureGitDiff(worktreePath: string): Promise<string> {
	const proc = Bun.spawn(["git", "diff", "HEAD"], {
		cwd: worktreePath,
		stdout: "pipe",
		stderr: "pipe",
	});
	await proc.exited;
	return new Response(proc.stdout).text();
}

function parseChangedFiles(diff: string): string[] {
	const files: string[] = [];
	for (const line of diff.split("\n")) {
		if (line.startsWith("diff --git")) {
			const match = /b\/(.+)$/.exec(line);
			if (match) files.push(match[1]);
		}
	}
	return [...new Set(files)];
}

function summarizeDiff(diff: string): string {
	const files = parseChangedFiles(diff);
	const additions = diff
		.split("\n")
		.filter((l) => l.startsWith("+") && !l.startsWith("+++")).length;
	const deletions = diff
		.split("\n")
		.filter((l) => l.startsWith("-") && !l.startsWith("---")).length;
	return `${files.length} file(s) changed, ${additions} insertion(s), ${deletions} deletion(s)`;
}

async function runAssertionCommands(
	task: TaskDefinition,
	worktreePath: string,
): Promise<Map<string, { passed: boolean; output: string }>> {
	const results = new Map<string, { passed: boolean; output: string }>();

	for (const assertion of task.assertions) {
		if (assertion.type !== "test-pass" && assertion.type !== "no-new-warnings") continue;
		if (!assertion.command) continue;

		const proc = Bun.spawn(["sh", "-c", assertion.command], {
			cwd: worktreePath,
			stdout: "pipe",
			stderr: "pipe",
		});

		const exitCode = await proc.exited;
		const stdout = await new Response(proc.stdout).text();
		const stderr = await new Response(proc.stderr).text();

		results.set(assertion.command, {
			passed: exitCode === 0,
			output: `${stdout}\n${stderr}`.trim(),
		});
	}

	return results;
}
