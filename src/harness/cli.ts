import type { RawRunResult, RunMetrics, TaskDefinition } from "../run/types.js";
import { commandExists, copyInstructions, spawnAgent } from "./spawn.js";
import type { HarnessAdapter } from "./types.js";

/** Declarative description of a headless agent CLI. */
export interface CliHarnessSpec {
	name: string;
	/** Executable to spawn and to look for on PATH. */
	binary: string;
	instructionTarget: string;
	/** Arguments for a non-interactive, auto-approving run. */
	args: (options: { model?: string }) => string[];
	/** How the prompt reaches the CLI. stdin avoids ARG_MAX limits on long prompts. */
	prompt: "stdin" | "last-arg";
	parseMetrics: (raw: RawRunResult) => RunMetrics;
	env?: Record<string, string>;
}

export class CliAdapter implements HarnessAdapter {
	readonly name: string;
	readonly instructionTarget: string;

	constructor(private readonly spec: CliHarnessSpec) {
		this.name = spec.name;
		this.instructionTarget = spec.instructionTarget;
	}

	async isAvailable(): Promise<boolean> {
		return commandExists(this.spec.binary);
	}

	async injectInstructions(worktreePath: string, sourcePath: string): Promise<void> {
		copyInstructions(worktreePath, sourcePath, this.instructionTarget);
	}

	async runTask(
		worktreePath: string,
		task: TaskDefinition,
		timeoutSeconds: number,
	): Promise<RawRunResult> {
		const args = this.spec.args({ model: task.model });
		const viaStdin = this.spec.prompt === "stdin";
		return spawnAgent({
			command: [this.spec.binary, ...args, ...(viaStdin ? [] : [task.prompt])],
			cwd: worktreePath,
			timeoutSeconds,
			stdin: viaStdin ? task.prompt : undefined,
			env: this.spec.env,
		});
	}

	parseMetrics(raw: RawRunResult): RunMetrics {
		return this.spec.parseMetrics(raw);
	}
}
