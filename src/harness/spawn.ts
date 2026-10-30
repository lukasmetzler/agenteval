import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import type { RawRunResult } from "../run/types.js";

/** Grace period between SIGTERM and SIGKILL when an agent overruns its timeout. */
export const KILL_GRACE_MS = 10_000;

/**
 * Run an agent CLI to completion. stdout and stderr are drained while the
 * process runs (so a chatty agent can't block on a full pipe), and a timeout
 * sends SIGTERM, then SIGKILL if the agent ignores it.
 */
export async function spawnAgent(options: {
	command: string[];
	cwd: string;
	timeoutSeconds: number;
	stdin?: string;
	env?: Record<string, string>;
	killGraceMs?: number;
}): Promise<RawRunResult> {
	const start = performance.now();
	const proc = Bun.spawn(options.command, {
		cwd: options.cwd,
		stdin: options.stdin === undefined ? "ignore" : new Blob([options.stdin]),
		stdout: "pipe",
		stderr: "pipe",
		env: { ...process.env, ...options.env },
	});

	let timedOut = false;
	let killTimer: ReturnType<typeof setTimeout> | undefined;
	const termTimer = setTimeout(() => {
		timedOut = true;
		proc.kill("SIGTERM");
		killTimer = setTimeout(() => proc.kill("SIGKILL"), options.killGraceMs ?? KILL_GRACE_MS);
	}, options.timeoutSeconds * 1000);

	const [stdout, stderr, exitCode] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
		proc.exited,
	]);
	clearTimeout(termTimer);
	clearTimeout(killTimer);

	return { stdout, stderr, exitCode, durationMs: performance.now() - start, timedOut };
}

/** Copy an instruction file to where the agent reads it, creating parent dirs. */
export function copyInstructions(worktreePath: string, sourcePath: string, target: string): void {
	const destination = join(worktreePath, target);
	mkdirSync(dirname(destination), { recursive: true });
	copyFileSync(sourcePath, destination);
}

export function commandExists(binary: string): boolean {
	return Bun.which(binary) !== null;
}
