import { loadConfig } from "../config/loader.js";
import { logger } from "../utils/logger.js";
import { detectAICommits } from "./detect.js";
import { emitTaskYaml, writeTaskFile } from "./emit.js";
import { getInstructionSnapshot } from "./snapshot.js";
import type { HarvestOptions, HarvestResult } from "./types.js";

/**
 * Validate that the given path is inside a git repository.
 */
async function validateGitRepo(repoPath: string): Promise<void> {
	const proc = Bun.spawn(["git", "rev-parse", "--show-toplevel"], {
		cwd: repoPath,
		stdout: "pipe",
		stderr: "pipe",
	});

	const exitCode = await proc.exited;
	if (exitCode !== 0) {
		throw new Error("Not a git repository (or git not found).");
	}
}

/**
 * Mine git history for AI-involved commits and emit TaskDefinition YAML files.
 */
export async function harvest(options: HarvestOptions): Promise<HarvestResult> {
	await validateGitRepo(options.repoPath);

	const minConfidence = options.minConfidence ?? 0.5;
	const outputDir = options.outputDir ?? "tasks/harvested";

	const { commits, scanned, skipped } = await detectAICommits(options.repoPath, {
		since: options.since,
		until: options.until,
		commit: options.commit,
	});

	// Filter by confidence threshold
	const filtered = commits.filter((c) => c.confidence >= minConfidence);
	const belowThreshold = commits.length - filtered.length;
	if (belowThreshold > 0) {
		logger.debug(`Filtered ${belowThreshold} commits below confidence threshold ${minConfidence}`);
	}

	const config = loadConfig(options.repoPath);
	const instructionGlobs = config.instructionGlobs;

	const result: HarvestResult = {
		commitsScanned: scanned,
		aiCommitsDetected: filtered.length,
		tasksEmitted: 0,
		tasks: [],
		skipped: [...skipped],
	};

	if (options.dryRun) {
		// In dry-run mode, populate tasks with what would be generated but don't write
		for (const commit of filtered) {
			const snapshot = await getInstructionSnapshot(
				options.repoPath,
				commit.hash,
				instructionGlobs,
			);
			const task = emitTaskYaml(
				commit,
				{ harness: options.harness, timeout: options.timeout },
				{ snapshot },
			);
			result.tasks.push(task.name);
		}
		return result;
	}

	for (const commit of filtered) {
		const snapshot = await getInstructionSnapshot(options.repoPath, commit.hash, instructionGlobs);
		const task = emitTaskYaml(
			commit,
			{ harness: options.harness, timeout: options.timeout },
			{ snapshot },
		);

		const filePath = writeTaskFile(task, outputDir, options.force ?? false);

		if (filePath) {
			result.tasks.push(filePath);
			result.tasksEmitted++;
			logger.debug(`Wrote ${filePath}`);
		} else {
			result.skipped.push({
				hash: commit.shortHash,
				reason: "file exists (use --force to overwrite)",
			});
		}
	}

	return result;
}

export { detectAICommits } from "./detect.js";
export { emitTaskYaml, writeTaskFile } from "./emit.js";
export { diffInstructionSnapshots, getInstructionSnapshot } from "./snapshot.js";
export type { AICommit, HarvestOptions, HarvestResult } from "./types.js";
