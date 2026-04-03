import { scoreDiffHygiene, scoreScopeDiscipline, scoreTestCoverage } from "./rubrics.js";
import type { LiveReviewResult } from "./types.js";

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
	const diffProc = Bun.spawn(["git", "diff", "HEAD"], {
		cwd: repoPath,
		stdout: "pipe",
		stderr: "pipe",
	});
	await diffProc.exited;
	const diff = await new Response(diffProc.stdout).text();

	return { files, diff };
}

/**
 * Run a live review of the current working tree against heuristic rubrics.
 */
export async function runLiveReview(repoPath: string): Promise<LiveReviewResult> {
	const { files, diff } = await getWorkingDiff(repoPath);

	if (files.length === 0) {
		return {
			rubrics: [],
			overallScore: 10,
			filesAnalyzed: 0,
			summary: "No changes to review",
		};
	}

	const rubrics = [scoreScopeDiscipline(files), scoreTestCoverage(files), scoreDiffHygiene(diff)];

	const overallScore =
		(rubrics.reduce((sum, r) => sum + r.score / r.maxScore, 0) / rubrics.length) * 10;

	const rounded = Math.round(overallScore * 10) / 10;

	return {
		rubrics,
		overallScore: rounded,
		filesAnalyzed: files.length,
		summary: `Score: ${rounded}/10 — ${files.length} files analyzed`,
	};
}
