import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import type { InstructionSet, RawRunResult, RunMetrics, TaskDefinition } from "../run/types.js";
import type { HarnessAdapter } from "./types.js";

/**
 * Cursor AI adapter.
 *
 * Instruction files: .cursorrules (project root) or .cursor/rules/*.mdc
 * CLI: cursor --cli (non-interactive mode)
 */
export class CursorAdapter implements HarnessAdapter {
	name = "cursor";

	async isAvailable(): Promise<boolean> {
		try {
			const proc = Bun.spawn(["which", "cursor"], { stdout: "pipe", stderr: "pipe" });
			return (await proc.exited) === 0;
		} catch {
			return false;
		}
	}

	async injectInstructions(worktreePath: string, instructions: InstructionSet): Promise<void> {
		const targetPath = join(worktreePath, instructions.targetFilename);
		const targetDir = dirname(targetPath);
		if (!existsSync(targetDir)) {
			mkdirSync(targetDir, { recursive: true });
		}
		copyFileSync(instructions.sourcePath, targetPath);
	}

	async runTask(
		worktreePath: string,
		task: TaskDefinition,
		timeoutSeconds: number,
	): Promise<RawRunResult> {
		const start = performance.now();

		const proc = Bun.spawn(["cursor", "--cli", task.prompt], {
			cwd: worktreePath,
			stdout: "pipe",
			stderr: "pipe",
		});

		let timedOut = false;
		const timeoutId = setTimeout(() => {
			timedOut = true;
			proc.kill("SIGTERM");
		}, timeoutSeconds * 1000);

		const exitCode = await proc.exited;
		clearTimeout(timeoutId);

		const stdout = await new Response(proc.stdout).text();
		const stderr = await new Response(proc.stderr).text();
		const durationMs = performance.now() - start;

		return { stdout, stderr, exitCode, durationMs, timedOut };
	}

	parseMetrics(raw: RawRunResult): RunMetrics {
		// Cursor CLI doesn't expose token counts in stdout/stderr
		return {
			tokensInput: null,
			tokensOutput: null,
			tokensTotal: null,
			tokenSource: "unavailable",
		};
	}
}
