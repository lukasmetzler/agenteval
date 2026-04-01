import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { logger } from "../utils/logger.js";

const DEFAULT_MAX_AGE_MS = 3_600_000; // 1 hour

/**
 * Generate a unique run ID in the format "run-YYYYMMDD-HHMMSS".
 * Appends a counter suffix on collision.
 */
export function generateRunId(resultsDir?: string): string {
	const now = new Date();
	const pad = (n: number) => String(n).padStart(2, "0");
	const base = `run-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

	if (!resultsDir || !existsSync(resultsDir)) return base;

	let id = base;
	let counter = 2;
	while (existsSync(join(resultsDir, `${id}.json`))) {
		id = `${base}-${counter}`;
		counter++;
	}
	return id;
}

/**
 * Create a git worktree for an isolated eval run.
 * Returns the absolute path to the worktree directory.
 */
export async function createWorktree(
	runId: string,
	cwd: string,
	worktreesDir: string,
): Promise<string> {
	const worktreePath = join(cwd, worktreesDir, runId);
	mkdirSync(join(cwd, worktreesDir), { recursive: true });

	const proc = Bun.spawn(["git", "worktree", "add", worktreePath, "HEAD", "--detach"], {
		cwd,
		stdout: "pipe",
		stderr: "pipe",
	});

	const exitCode = await proc.exited;
	if (exitCode !== 0) {
		const stderr = await new Response(proc.stderr).text();
		throw new Error(`Failed to create worktree: ${stderr.trim()}`);
	}

	logger.debug(`Created worktree at ${worktreePath}`);
	return worktreePath;
}

/**
 * Remove a git worktree. Forces removal even if dirty.
 */
export async function removeWorktree(worktreePath: string, cwd: string): Promise<void> {
	const proc = Bun.spawn(["git", "worktree", "remove", worktreePath, "--force"], {
		cwd,
		stdout: "pipe",
		stderr: "pipe",
	});

	const exitCode = await proc.exited;
	if (exitCode !== 0) {
		const stderr = await new Response(proc.stderr).text();
		logger.warn(`Failed to remove worktree ${worktreePath}: ${stderr.trim()}`);
	} else {
		logger.debug(`Removed worktree at ${worktreePath}`);
	}
}

/**
 * Clean up stale worktrees older than maxAgeMs.
 * Called on every `agenteval run` startup.
 * Returns the count of cleaned worktrees.
 */
export async function cleanStaleWorktrees(
	cwd: string,
	worktreesDir: string,
	maxAgeMs: number = DEFAULT_MAX_AGE_MS,
): Promise<number> {
	const fullPath = join(cwd, worktreesDir);
	if (!existsSync(fullPath)) return 0;

	const now = Date.now();
	let cleaned = 0;

	for (const entry of readdirSync(fullPath)) {
		const entryPath = join(fullPath, entry);
		try {
			const stat = statSync(entryPath);
			if (stat.isDirectory() && now - stat.mtimeMs > maxAgeMs) {
				await removeWorktree(entryPath, cwd);
				logger.warn(`Cleaned stale worktree: ${entry}`);
				cleaned++;
			}
		} catch {
			// Skip entries we can't stat
		}
	}

	return cleaned;
}
