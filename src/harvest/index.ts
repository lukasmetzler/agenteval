import { loadConfig } from "../config/loader.js";
import { logger } from "../utils/logger.js";
import { detectAICommits } from "./detect.js";
import { emitTaskYaml, writeTaskFile } from "./emit.js";
import type { PRInfo } from "./github.js";
import { findPRForCommit, isGhAvailable } from "./github.js";
import { getInstructionSnapshot } from "./snapshot.js";
import type { AICommit, HarvestOptions, HarvestResult } from "./types.js";

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
 * Fetch PR info for each commit via the GitHub CLI. Requires `gh` to be authenticated.
 */
async function fetchPRInfoMap(repoPath: string, commits: AICommit[]): Promise<Map<string, PRInfo>> {
	const ghReady = await isGhAvailable();
	if (!ghReady) {
		throw new Error(
			"--github requires the GitHub CLI (gh). Install it from https://cli.github.com/ and run 'gh auth login'.",
		);
	}
	const prInfoMap = new Map<string, PRInfo>();
	for (const commit of commits) {
		const prInfo = await findPRForCommit(repoPath, commit.hash);
		if (prInfo) {
			prInfoMap.set(commit.hash, prInfo);
			logger.debug(`Found PR #${prInfo.number} for ${commit.shortHash}`);
		}
	}
	return prInfoMap;
}

/**
 * Mine git history for AI-involved commits and emit TaskDefinition YAML files.
 */
export async function harvest(options: HarvestOptions): Promise<HarvestResult> {
	await validateGitRepo(options.repoPath);

	if (options.live) {
		const { runLiveReview } = await import("./live.js");
		const liveResult = await runLiveReview(options.repoPath, options.analyze);
		return {
			commitsScanned: 0,
			aiCommitsDetected: 0,
			tasksEmitted: 0,
			tasks: [],
			skipped: [],
			liveReview: liveResult,
		};
	}

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

	// GitHub enrichment: fetch PR data for each commit if --github is set
	const prInfoMap = options.github
		? await fetchPRInfoMap(options.repoPath, filtered)
		: new Map<string, PRInfo>();

	const result: HarvestResult = {
		commitsScanned: scanned,
		aiCommitsDetected: filtered.length,
		tasksEmitted: 0,
		tasks: [],
		skipped: [...skipped],
	};

	if (options.dryRun) {
		result.commitSummaries = filtered.map((c) => ({
			shortHash: c.shortHash,
			tool: c.detectedTool ?? "unknown",
			confidence: c.confidence,
			message: c.message.length > 42 ? `${c.message.slice(0, 39)}...` : c.message,
		}));
		for (const commit of filtered) {
			const snapshot = await getInstructionSnapshot(
				options.repoPath,
				commit.hash,
				instructionGlobs,
			);
			const task = emitTaskYaml(
				commit,
				{ harness: options.harness, timeout: options.timeout },
				{ snapshot, prInfo: prInfoMap.get(commit.hash) },
				options.repoPath,
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
			{ snapshot, prInfo: prInfoMap.get(commit.hash) },
			options.repoPath,
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
export { detectTestCommand, emitTaskYaml, writeTaskFile } from "./emit.js";
export type { PRInfo } from "./github.js";
export { findPRForCommit, isGhAvailable } from "./github.js";
export { diffInstructionSnapshots, getInstructionSnapshot } from "./snapshot.js";
export type {
	AICommit,
	CommitSummary,
	HarvestOptions,
	HarvestResult,
	LiveReviewResult,
} from "./types.js";
