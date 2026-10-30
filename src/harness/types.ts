import type { RawRunResult, RunMetrics, TaskDefinition } from "../run/types.js";

export interface HarnessAdapter {
	name: string;

	/** Where this agent reads project instructions, relative to the repo root. */
	instructionTarget: string;

	/** Check if this harness CLI is available on the system */
	isAvailable(): Promise<boolean>;

	/** Copy an instruction file to this harness's instructionTarget in the worktree */
	injectInstructions(worktreePath: string, sourcePath: string): Promise<void>;

	/** Spawn the agent with a task, return when complete or timed out */
	runTask(
		worktreePath: string,
		task: TaskDefinition,
		timeoutSeconds: number,
	): Promise<RawRunResult>;

	/** Parse harness-specific output into standardized metrics */
	parseMetrics(raw: RawRunResult): RunMetrics;
}
