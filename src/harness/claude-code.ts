import { copyFileSync } from "node:fs";
import { join } from "node:path";
import type { InstructionSet, RawRunResult, RunMetrics, TaskDefinition } from "../run/types.js";
import type { HarnessAdapter } from "./types.js";

const TOKEN_PATTERN = /total[_ ]tokens?[:\s]+(\d[\d,]*)/i;
const INPUT_TOKEN_PATTERN = /input[_ ]tokens?[:\s]+(\d[\d,]*)/i;
const OUTPUT_TOKEN_PATTERN = /output[_ ]tokens?[:\s]+(\d[\d,]*)/i;

export class ClaudeCodeAdapter implements HarnessAdapter {
	name = "claude-code";

	async isAvailable(): Promise<boolean> {
		try {
			const proc = Bun.spawn(["which", "claude"], { stdout: "pipe", stderr: "pipe" });
			return (await proc.exited) === 0;
		} catch {
			return false;
		}
	}

	async injectInstructions(worktreePath: string, instructions: InstructionSet): Promise<void> {
		const target = join(worktreePath, instructions.targetFilename);
		copyFileSync(instructions.sourcePath, target);
	}

	async runTask(
		worktreePath: string,
		task: TaskDefinition,
		timeoutSeconds: number,
	): Promise<RawRunResult> {
		const start = performance.now();

		const proc = Bun.spawn(["claude", "--print", "--dangerously-skip-permissions", task.prompt], {
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

		const totalMatch = TOKEN_PATTERN.exec(combined);
		const inputMatch = INPUT_TOKEN_PATTERN.exec(combined);
		const outputMatch = OUTPUT_TOKEN_PATTERN.exec(combined);

		const parseNum = (match: RegExpExecArray | null): number | null => {
			if (!match?.[1]) return null;
			return Number.parseInt(match[1].replace(/,/g, ""), 10);
		};

		const tokensTotal = parseNum(totalMatch);
		const tokensInput = parseNum(inputMatch);
		const tokensOutput = parseNum(outputMatch);

		if (tokensTotal !== null || tokensInput !== null) {
			return {
				tokensInput,
				tokensOutput,
				tokensTotal: tokensTotal ?? (tokensInput ?? 0) + (tokensOutput ?? 0),
				tokenSource: "api",
			};
		}

		return {
			tokensInput: null,
			tokensOutput: null,
			tokensTotal: null,
			tokenSource: "unavailable",
		};
	}
}
