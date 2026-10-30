export interface InstructionSet {
	/**
	 * Instruction file to inject (e.g. "./instructions-v2/CLAUDE.md"). The harness
	 * decides where it lands (CLAUDE.md, AGENTS.md, GEMINI.md, ...). null is the
	 * baseline arm: every instruction file is removed from the worktree.
	 */
	sourcePath: string | null;
}

export interface TaskDefinition {
	name: string;
	description: string;
	prompt: string;
	/** Built-in harness name, a key of config.harnesses, or "auto". */
	harness: string;
	/** Model passed to the agent CLI (its --model flag); the CLI default when unset. */
	model?: string;
	timeout: number;
	/** Independent attempts per run (default 1). Agents are nondeterministic; 3+ is recommended. */
	trials?: number;
	/** Shell commands run in the worktree before the agent starts (e.g. "bun install"). */
	setup?: string[];
	assertions: TaskAssertion[];
	scoring: ScoringWeights;
	sourceCommit?: string;
	instructionSnapshot?: Record<string, string>;
	prUrl?: string;
	prBody?: string;
	detectionConfidence?: number;
	harvestDate?: string;
}

export interface TaskAssertion {
	type:
		| "files-changed"
		| "files-unchanged"
		| "test-pass"
		| "no-new-warnings"
		| "convention"
		| "lint-delta";
	pattern?: string;
	command?: string;
	expect?: string;
	/** lint-delta: tool ids to run, or "auto" for every detected linter/type checker. */
	tools?: string[] | "auto";
	/** lint-delta: how many new findings are tolerated (default 0). */
	maxNew?: number;
}

/** Assertion types scored in the conventions dimension rather than correctness. */
export const CONVENTION_ASSERTIONS: ReadonlySet<string> = new Set<TaskAssertion["type"]>([
	"convention",
	"lint-delta",
]);

export interface TrialInfo {
	/** Shared by every trial and arm started by one `agenteval run`. */
	group: string;
	/** 1-based trial number within its arm. */
	index: number;
	of: number;
	/** "instructions" = with the instruction file; "baseline" = all instruction files removed. */
	arm: "instructions" | "baseline";
}

/** Linter findings an agent's diff introduced, stored with the run. */
export interface LintSummary {
	tools: { tool: string; status: "ok" | "unavailable" | "failed"; detail?: string }[];
	newDiagnostics: {
		tool: string;
		file: string;
		line: number;
		rule: string;
		severity: "error" | "warning" | "info";
		message: string;
	}[];
}

export interface ScoringWeights {
	correctness: number;
	precision: number;
	efficiency: number;
	conventions: number;
}

export interface RawRunResult {
	stdout: string;
	stderr: string;
	exitCode: number;
	durationMs: number;
	timedOut: boolean;
}

export interface RunMetrics {
	tokensInput: number | null;
	tokensOutput: number | null;
	tokensTotal: number | null;
	tokenSource: "api" | "estimated" | "unavailable";
	/** Cost the agent CLI reported (Claude Code reports a client-side estimate). */
	costUsd?: number | null;
	/** Model the agent reported using. */
	model?: string | null;
	/** Agent turns (model round trips) the CLI reported. */
	turns?: number | null;
}

export interface StoredResult {
	id: string;
	timestamp: string;
	task: string;
	harness: string;
	instructions: string;
	status: "success" | "error" | "timeout";
	metrics: RunMetrics;
	scores: ResultScores;
	assertions: AssertionResult[];
	diffSummary: string;
	model: string | null;
	/** Wall-clock time of the agent process. */
	durationMs?: number;
	/** Set when the run is one of several trials or arms of the same task. */
	trial?: TrialInfo;
	lint?: LintSummary;
	error?: string;
	sourceCommit?: string;
	instructionSnapshot?: Record<string, string>;
	prUrl?: string;
	detectionConfidence?: number;
}

export interface ResultScores {
	correctness: number | null;
	precision: number | null;
	efficiency: number | null;
	conventions: number | null;
	overall: number | null;
	confidenceAdjustedOverall?: number | null;
}

export interface AssertionResult {
	type: string;
	expected: string;
	actual: string;
	passed: boolean;
}
