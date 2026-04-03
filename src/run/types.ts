export interface InstructionSet {
	/** Path to the instruction file to use (e.g., "./instructions-v2/CLAUDE.md") */
	sourcePath: string;
	/** Target filename in worktree (e.g., "CLAUDE.md", "AGENTS.md") */
	targetFilename: string;
}

export interface TaskDefinition {
	name: string;
	description: string;
	prompt: string;
	harness: "claude-code" | "opencode" | "copilot" | "generic" | "auto";
	timeout: number;
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
	type: "files-changed" | "files-unchanged" | "test-pass" | "no-new-warnings" | "convention";
	pattern?: string;
	command?: string;
	expect?: string;
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
}

export interface AssertionResult {
	type: string;
	expected: string;
	actual: string;
	passed: boolean;
}
