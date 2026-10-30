import type { Config } from "../config/schema.js";
import type { HarnessAdapter } from "../harness/types.js";
import { executeRun } from "./index.js";
import type { InstructionSet, StoredResult, TaskDefinition, TrialInfo } from "./types.js";
import { generateRunId } from "./worktree.js";

export interface Stat {
	mean: number;
	stddev: number;
	n: number;
}

export interface TrialStats {
	trials: number;
	passes: number;
	/** Share of trials that passed. */
	passRate: number;
	/** pass@k for k = trials: at least one trial passed. */
	passAtK: boolean;
	/** pass^k for k = trials: every trial passed (consistency). */
	passAllK: boolean;
	score: Stat | null;
	tokens: Stat | null;
	costUsd: Stat | null;
	turns: Stat | null;
	durationMs: Stat | null;
}

export interface ArmDelta {
	/** treatment minus baseline; null when either side has no data. */
	passRate: number;
	score: number | null;
	tokens: number | null;
	costUsd: number | null;
	turns: number | null;
	durationMs: number | null;
}

/**
 * A trial passes when the run succeeded and every assertion held. Runs
 * without assertions pass when the agent finished without error.
 */
export function isPass(result: StoredResult): boolean {
	return result.status === "success" && result.assertions.every((a) => a.passed);
}

export function stat(values: (number | null | undefined)[]): Stat | null {
	const present = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
	if (present.length === 0) return null;
	const mean = present.reduce((a, b) => a + b, 0) / present.length;
	// Sample standard deviation; 0 for a single value.
	const variance =
		present.length > 1
			? present.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (present.length - 1)
			: 0;
	return { mean, stddev: Math.sqrt(variance), n: present.length };
}

export function summarizeTrials(results: StoredResult[]): TrialStats {
	const passes = results.filter(isPass).length;
	return {
		trials: results.length,
		passes,
		passRate: results.length === 0 ? 0 : passes / results.length,
		passAtK: passes > 0,
		passAllK: results.length > 0 && passes === results.length,
		score: stat(results.map((r) => r.scores.overall)),
		tokens: stat(results.map((r) => r.metrics.tokensTotal)),
		costUsd: stat(results.map((r) => r.metrics.costUsd)),
		turns: stat(results.map((r) => r.metrics.turns)),
		durationMs: stat(results.map((r) => r.durationMs)),
	};
}

function diff(a: Stat | null, b: Stat | null): number | null {
	return a && b ? a.mean - b.mean : null;
}

export function compareArms(treatment: TrialStats, baseline: TrialStats): ArmDelta {
	return {
		passRate: treatment.passRate - baseline.passRate,
		score: diff(treatment.score, baseline.score),
		tokens: diff(treatment.tokens, baseline.tokens),
		costUsd: diff(treatment.costUsd, baseline.costUsd),
		turns: diff(treatment.turns, baseline.turns),
		durationMs: diff(treatment.durationMs, baseline.durationMs),
	};
}

export interface TrialRun {
	group: string;
	instructions: StoredResult[];
	baseline: StoredResult[] | null;
}

/**
 * Run a task several times, optionally with a baseline arm that removes every
 * instruction file, so the effect of the instructions can be measured against
 * agent nondeterminism. Trials run one after another; arms alternate so drift
 * in the agent's backend affects both arms alike.
 */
export async function runTrials(options: {
	config: Config;
	task: TaskDefinition;
	instructions: InstructionSet;
	cwd: string;
	trials: number;
	baseline: boolean;
	adapter?: HarnessAdapter;
	onResult?: (result: StoredResult) => void;
}): Promise<TrialRun> {
	const group = generateRunId().replace(/^run-/, "group-");
	const arms: { arm: TrialInfo["arm"]; instructions: InstructionSet }[] = [
		{ arm: "instructions", instructions: options.instructions },
		...(options.baseline ? [{ arm: "baseline" as const, instructions: { sourcePath: null } }] : []),
	];
	const results: Record<TrialInfo["arm"], StoredResult[]> = { instructions: [], baseline: [] };

	for (let index = 1; index <= options.trials; index++) {
		for (const { arm, instructions } of arms) {
			const result = await executeRun(options.config, options.task, instructions, options.cwd, {
				adapter: options.adapter,
			});
			const tagged =
				options.trials > 1 || options.baseline
					? { ...result, trial: { group, index, of: options.trials, arm } }
					: result;
			results[arm].push(tagged);
			options.onResult?.(tagged);
		}
	}

	return {
		group,
		instructions: results.instructions,
		baseline: options.baseline ? results.baseline : null,
	};
}
