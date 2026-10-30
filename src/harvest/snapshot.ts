import { minimatch } from "minimatch";
import { DEFAULT_IGNORE } from "../utils/glob.js";

/** Read several blobs with one `git cat-file --batch` process instead of one spawn per file. */
async function readBlobs(repoPath: string, specs: string[]): Promise<(string | null)[]> {
	if (specs.length === 0) return [];
	const proc = Bun.spawn(["git", "cat-file", "--batch"], {
		cwd: repoPath,
		stdin: new Blob([`${specs.join("\n")}\n`]),
		stdout: "pipe",
		stderr: "pipe",
	});
	const out = Buffer.from(await new Response(proc.stdout).arrayBuffer());
	await proc.exited;

	const blobs: (string | null)[] = [];
	let pos = 0;
	for (let i = 0; i < specs.length && pos < out.length; i++) {
		const headerEnd = out.indexOf(10, pos);
		const header = out.subarray(pos, headerEnd).toString("utf-8");
		pos = headerEnd + 1;
		const size = /^\S+ blob (\d+)$/.exec(header)?.[1];
		if (size === undefined) {
			blobs.push(null); // "<spec> missing" or a non-blob object
			continue;
		}
		const length = Number(size);
		blobs.push(out.subarray(pos, pos + length).toString("utf-8"));
		pos += length + 1; // content is followed by a newline
	}
	return blobs;
}

/**
 * Retrieve instruction file contents at the parent of the given commit.
 * Returns a map of relative path -> file content for each glob match.
 */
export async function getInstructionSnapshot(
	repoPath: string,
	commitHash: string,
	globs: string[],
	ignore: string[] = [],
): Promise<Record<string, string>> {
	const result: Record<string, string> = {};
	const parent = `${commitHash}^`;

	const lsTree = Bun.spawn(["git", "ls-tree", "-r", "--name-only", parent], {
		cwd: repoPath,
		stdout: "pipe",
		stderr: "pipe",
	});
	const lsOutput = await new Response(lsTree.stdout).text();
	// A non-zero exit means no parent (initial commit): nothing to snapshot.
	if ((await lsTree.exited) !== 0) return result;

	const skip = [...DEFAULT_IGNORE, ...ignore];
	const matched = lsOutput
		.split("\n")
		.filter(
			(file) =>
				file.length > 0 &&
				globs.some((glob) => minimatch(file, glob)) &&
				!skip.some((glob) => minimatch(file, glob)),
		);

	const contents = await readBlobs(
		repoPath,
		matched.map((file) => `${parent}:${file}`),
	);
	for (const [i, file] of matched.entries()) {
		const content = contents[i];
		if (content !== null && content !== undefined) result[file] = content;
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
