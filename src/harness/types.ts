import type { InstructionSet, RawRunResult, RunMetrics, TaskDefinition } from "../run/types.js";

export interface HarnessAdapter {
	name: string;

	/** Check if this harness CLI is available on the system */
	isAvailable(): Promise<boolean>;

	/** Inject instructions into the harness's expected location in the worktree */
	injectInstructions(worktreePath: string, instructions: InstructionSet): Promise<void>;

	/** Spawn the agent with a task, return when complete or timed out */
	runTask(
		worktreePath: string,
		task: TaskDefinition,
		timeoutSeconds: number,
	): Promise<RawRunResult>;

	/** Parse harness-specific output into standardized metrics */
	parseMetrics(raw: RawRunResult): RunMetrics;
}
