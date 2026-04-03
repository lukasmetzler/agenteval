import { minimatch } from "minimatch";

/**
 * Retrieve instruction file contents at the parent of the given commit.
 * Returns a map of relative path -> file content for each glob match.
 */
export async function getInstructionSnapshot(
	repoPath: string,
	commitHash: string,
	globs: string[],
): Promise<Record<string, string>> {
	const result: Record<string, string> = {};

	// Check if the commit has a parent
	const parentCheck = Bun.spawn(["git", "rev-parse", "--verify", `${commitHash}^`], {
		cwd: repoPath,
		stdout: "pipe",
		stderr: "pipe",
	});
	const parentExit = await parentCheck.exited;
	if (parentExit !== 0) {
		// Initial commit — no parent to snapshot
		return result;
	}

	// Enumerate files at the parent commit
	const lsTree = Bun.spawn(["git", "ls-tree", "-r", "--name-only", `${commitHash}^`], {
		cwd: repoPath,
		stdout: "pipe",
		stderr: "pipe",
	});
	await lsTree.exited;
	const lsOutput = await new Response(lsTree.stdout).text();
	const allFiles = lsOutput
		.trim()
		.split("\n")
		.filter((f) => f.length > 0);

	// Filter by globs
	const matched = allFiles.filter((file) => globs.some((glob) => minimatch(file, glob)));

	// Retrieve content for each matched file
	for (const file of matched) {
		const show = Bun.spawn(["git", "show", `${commitHash}^:${file}`], {
			cwd: repoPath,
			stdout: "pipe",
			stderr: "pipe",
		});
		const exitCode = await show.exited;
		if (exitCode !== 0) {
			continue;
		}
		const content = await new Response(show.stdout).text();
		result[file] = content;
	}

	return result;
}

/**
 * Compare two instruction snapshot maps and classify each key.
 */
export function diffInstructionSnapshots(
	a: Record<string, string>,
	b: Record<string, string>,
): Record<string, "added" | "removed" | "changed" | "unchanged"> {
	const result: Record<string, "added" | "removed" | "changed" | "unchanged"> = {};

	const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);

	for (const key of allKeys) {
		const inA = key in a;
		const inB = key in b;

		if (inB && !inA) {
			result[key] = "added";
		} else if (inA && !inB) {
			result[key] = "removed";
		} else if (a[key] === b[key]) {
			result[key] = "unchanged";
		} else {
			result[key] = "changed";
		}
	}

	return result;
}
