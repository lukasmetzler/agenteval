import { readFileSync } from "node:fs";
import { loadConfig } from "../config/loader.js";
import type { LiveReviewConfig } from "../config/schema.js";
import { detectToolchain } from "../toolchain/detect.js";
import { autoLintTools, computeLintDelta } from "../toolchain/lintDelta.js";
import { resolveInstructionFiles } from "../utils/glob.js";
import { GIT_DIFF_FLAGS } from "../utils/path.js";
import { scoreConventionCompliance, scoreProgressiveDisclosure } from "./llm-rubrics.js";
import {
	scoreDiffHygiene,
	scoreLintDelta,
	scoreScopeDiscipline,
	scoreTestCoverage,
} from "./rubrics.js";
import type { LiveReviewResult, RubricResult } from "./types.js";

/**
 * Get the working tree diff (staged + unstaged) for the given repo.
 */
export async function getWorkingDiff(repoPath: string): Promise<{ files: string[]; diff: string }> {
	// Get numstat for staged changes
	const stagedProc = Bun.spawn(["git", "diff", "--cached", "--numstat"], {
		cwd: repoPath,
		stdout: "pipe",
		stderr: "pipe",
	});
	await stagedProc.exited;
	const stagedOut = await new Response(stagedProc.stdout).text();

	// Get numstat for unstaged changes
	const unstagedProc = Bun.spawn(["git", "diff", "--numstat"], {
		cwd: repoPath,
		stdout: "pipe",
		stderr: "pipe",
	});
	await unstagedProc.exited;
	const unstagedOut = await new Response(unstagedProc.stdout).text();

	// Combine and deduplicate file paths
	const fileSet = new Set<string>();
	for (const output of [stagedOut, unstagedOut]) {
		for (const line of output.trim().split("\n")) {
			if (!line.trim()) continue;
			const parts = line.split("\t");
			if (parts.length >= 3) {
				fileSet.add(parts.slice(2).join("\t"));
			}
		}
	}

	const files = [...fileSet];

	if (files.length === 0) {
		return { files: [], diff: "" };
	}

	// Get the full combined diff
	const diffProc = Bun.spawn(["git", "diff", ...GIT_DIFF_FLAGS, "HEAD"], {
		cwd: repoPath,
		stdout: "pipe",
		stderr: "pipe",
	});
	await diffProc.exited;
	const diff = await new Response(diffProc.stdout).text();

	return { files, diff };
}

/**
 * Read instruction files matching the configured globs.
 */
export async function readInstructionFiles(repoPath: string, globs: string[]): Promise<string> {
	const matched = await resolveInstructionFiles(globs, repoPath);
	const contents: string[] = [];

	for (const filePath of matched) {
		try {
			contents.push(readFileSync(filePath, "utf-8"));
		} catch {
			// Skip files that can't be read
		}
	}

	return contents.join("\n\n---\n\n");
}

type RubricEntry = { result: RubricResult; weight: number };

function heuristicEntries(files: string[], diff: string, config: LiveReviewConfig): RubricEntry[] {
	const { scopeDiscipline, testCoverage, diffHygiene } = config.rubrics;
	const entries: RubricEntry[] = [];
	if (scopeDiscipline.enabled) {
		entries.push({ result: scoreScopeDiscipline(files), weight: scopeDiscipline.weight });
	}
	if (testCoverage.enabled) {
		entries.push({ result: scoreTestCoverage(files), weight: testCoverage.weight });
	}
	if (diffHygiene.enabled) {
		entries.push({ result: scoreDiffHygiene(diff), weight: diffHygiene.weight });
	}
	return entries;
}

async function llmEntries(
	diff: string,
	instructions: string,
	config: LiveReviewConfig,
): Promise<RubricEntry[]> {
	const { conventionCompliance, progressiveDisclosure } = config.rubrics;
	const judge = { model: config.judgeModel };
	const entries: RubricEntry[] = [];
	if (conventionCompliance.enabled) {
		const result = await scoreConventionCompliance(diff, instructions, judge);
		if (result) entries.push({ result, weight: conventionCompliance.weight });
	}
	if (progressiveDisclosure.enabled) {
		const result = await scoreProgressiveDisclosure(diff, instructions, judge);
		if (result) entries.push({ result, weight: progressiveDisclosure.weight });
	}
	return entries;
}

async function lintDeltaRubric(repoPath: string, diff: string): Promise<RubricResult | null> {
	const toolchain = detectToolchain(repoPath);
	// Linters only: a full-project type check is too slow for an interactive review.
	const tools = autoLintTools(toolchain, { typecheck: false });
	if (tools.length === 0) return null;
	return scoreLintDelta(await computeLintDelta({ root: repoPath, diff, tools, toolchain }));
}

/**
 * Pure function: select enabled rubrics, run them, and compute a weighted average.
 * When analyze is true and LLM rubrics are enabled, includes them in results.
 */
export async function selectAndScoreRubrics(
	files: string[],
	diff: string,
	config: LiveReviewConfig,
	options?: { analyze?: boolean; instructions?: string; repoPath?: string },
): Promise<LiveReviewResult> {
	if (files.length === 0) {
		return {
			rubrics: [],
			overallScore: 10,
			filesAnalyzed: 0,
			summary: "No changes to review",
		};
	}

	const rubricEntries = heuristicEntries(files, diff, config);

	if (options?.repoPath && config.rubrics.lintDelta.enabled) {
		const result = await lintDeltaRubric(options.repoPath, diff);
		if (result) rubricEntries.push({ result, weight: config.rubrics.lintDelta.weight });
	}

	// LLM-assisted rubrics: only run when analyze is true
	if (options?.analyze && options.instructions) {
		rubricEntries.push(...(await llmEntries(diff, options.instructions, config)));
	}

	if (rubricEntries.length === 0) {
		return {
			rubrics: [],
			overallScore: 0,
			filesAnalyzed: files.length,
			summary: `Score: 0/10 — ${files.length} files analyzed (no rubrics enabled)`,
		};
	}

	const totalWeight = rubricEntries.reduce((sum, e) => sum + e.weight, 0);

	if (totalWeight === 0) {
		return {
			rubrics: rubricEntries.map((e) => e.result),
			overallScore: 0,
			filesAnalyzed: files.length,
			summary: `Score: 0/10 — ${files.length} files analyzed`,
		};
	}

	const weightedSum = rubricEntries.reduce(
		(sum, e) => sum + (e.result.score / e.result.maxScore) * e.weight,
		0,
	);
	const overallScore = (weightedSum / totalWeight) * 10;
	const rounded = Math.round(overallScore * 10) / 10;

	return {
		rubrics: rubricEntries.map((e) => e.result),
		overallScore: rounded,
		filesAnalyzed: files.length,
		summary: `Score: ${rounded}/10 — ${files.length} files analyzed`,
	};
}

/**
 * Run a live review of the current working tree against heuristic rubrics.
 * When analyze is true, also runs LLM-assisted rubrics.
 */
export async function runLiveReview(
	repoPath: string,
	analyze?: boolean,
): Promise<LiveReviewResult> {
	const { files, diff } = await getWorkingDiff(repoPath);
	const config = loadConfig(repoPath);

	let instructions: string | undefined;
	if (analyze) {
		instructions = await readInstructionFiles(repoPath, config.instructionGlobs);
	}

	return selectAndScoreRubrics(files, diff, config.liveReview, {
		analyze,
		instructions,
		repoPath,
	});
}
