import { copyFileSync } from "node:fs";
import { join } from "node:path";
import type { InstructionSet, RawRunResult, RunMetrics, TaskDefinition } from "../run/types.js";
import type { HarnessAdapter } from "./types.js";

interface GenericAdapterConfig {
	command: string;
	args: string[];
	instructionPath: string;
}

export class GenericAdapter implements HarnessAdapter {
	name = "generic";
	private config: GenericAdapterConfig;

	constructor(config: GenericAdapterConfig) {
		this.config = config;
	}

	async isAvailable(): Promise<boolean> {
		try {
			const proc = Bun.spawn(["which", this.config.command], { stdout: "pipe", stderr: "pipe" });
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

		const fullArgs = [...this.config.args, task.prompt];
		const proc = Bun.spawn([this.config.command, ...fullArgs], {
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
		// Try common token count patterns from stdout/stderr
		const combined = `${raw.stdout}\n${raw.stderr}`;
		const patterns = [
			/total[_ ]tokens?[:\s]+(\d[\d,]*)/i,
			/tokens?[_ ]used[:\s]+(\d[\d,]*)/i,
			/token[_ ]count[:\s]+(\d[\d,]*)/i,
		];

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
