export interface PRInfo {
	number: number;
	url: string;
	body: string;
	labels: string[];
}

/**
 * Check whether the GitHub CLI (`gh`) is installed and authenticated.
 */
export async function isGhAvailable(): Promise<boolean> {
	try {
		const proc = Bun.spawn(["gh", "auth", "status"], {
			stdout: "pipe",
			stderr: "pipe",
		});
		const exitCode = await proc.exited;
		return exitCode === 0;
	} catch {
		return false;
	}
}

interface GhPREntry {
	number: number;
	url: string;
	body: string;
	labels: Array<{ name: string }>;
}

/**
 * Find the merged PR associated with a given commit hash using `gh pr list`.
 * Returns null if no PR is found or if the gh CLI fails (best-effort enrichment).
 */
export async function findPRForCommit(
	repoPath: string,
	commitHash: string,
): Promise<PRInfo | null> {
	try {
		const proc = Bun.spawn(
			[
				"gh",
				"pr",
				"list",
				"--search",
				commitHash,
				"--state",
				"merged",
				"--json",
				"number,url,body,labels",
				"--limit",
				"1",
			],
			{
				cwd: repoPath,
				stdout: "pipe",
				stderr: "pipe",
			},
		);

		const exitCode = await proc.exited;
		if (exitCode !== 0) {
			return null;
		}

		const stdout = await new Response(proc.stdout).text();
		const entries: GhPREntry[] = JSON.parse(stdout);

		if (entries.length === 0) {
			return null;
		}

		const entry = entries[0];
		return {
			number: entry.number,
			url: entry.url,
			body: entry.body,
			labels: entry.labels.map((l) => l.name),
		};
	} catch {
		return null;
	}
}
