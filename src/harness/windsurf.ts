import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import type { InstructionSet, RawRunResult, RunMetrics, TaskDefinition } from "../run/types.js";
import type { HarnessAdapter } from "./types.js";

/**
 * Windsurf (Codeium) adapter.
 *
 * Instruction file: .windsurfrules in the project root.
 * CLI: windsurf (headless mode via --cli flag).
 */
export class WindsurfAdapter implements HarnessAdapter {
	name = "windsurf";

	async isAvailable(): Promise<boolean> {
		try {
			const proc = Bun.spawn(["which", "windsurf"], { stdout: "pipe", stderr: "pipe" });
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

		const proc = Bun.spawn(["windsurf", "--cli", task.prompt], {
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
		const combined = `${raw.stdout}\n${raw.stderr}`;
		const patterns = [/total[_ ]tokens?[:\s]+(\d[\d,]*)/i, /tokens?[_ ]used[:\s]+(\d[\d,]*)/i];

		for (const pattern of patterns) {
			const match = pattern.exec(combined);
			if (match?.[1]) {
				const total = Number.parseInt(match[1].replace(/,/g, ""), 10);
				return {
					tokensInput: null,
					tokensOutput: null,
					tokensTotal: total,
					tokenSource: "estimated",
				};
			}
		}

		return {
			tokensInput: null,
			tokensOutput: null,
			tokensTotal: null,
			tokenSource: "unavailable",
		};
	}
}
