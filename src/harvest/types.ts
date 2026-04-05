export type DetectionMethod = "co-author-tag" | "message-pattern" | "author-email";

export interface RawCommit {
	hash: string;
	shortHash: string;
	subject: string;
	authorEmail: string;
	date: string;
	coAuthorRaw: string;
}

export interface AICommit {
	hash: string;
	shortHash: string;
	message: string;
	author: string;
	coAuthors: string[];
	detectionMethod: DetectionMethod;
	detectedTool?: string;
	confidence: number;
	timestamp: Date;
	filesChanged: string[];
	diffStat: { additions: number; deletions: number; filesChanged: number };
}

export interface HarvestOptions {
	repoPath: string;
	since?: string;
	until?: string;
	commit?: string;
	outputDir?: string;
	dryRun?: boolean;
	force?: boolean;
	harness?: "claude-code" | "cursor" | "opencode" | "windsurf" | "copilot" | "generic" | "auto";
	timeout?: number;
	minConfidence?: number;
	github?: boolean;
	live?: boolean;
	analyze?: boolean;
}

export interface CommitSummary {
	shortHash: string;
	tool: string;
	confidence: number;
	message: string;
}

export interface HarvestResult {
	commitsScanned: number;
	aiCommitsDetected: number;
	tasksEmitted: number;
	tasks: string[];
	skipped: Array<{ hash: string; reason: string }>;
	commitSummaries?: CommitSummary[];
	liveReview?: LiveReviewResult;
}

export interface LiveReviewResult {
	rubrics: RubricResult[];
	overallScore: number;
	filesAnalyzed: number;
	summary: string;
}

export interface RubricResult {
	name: string;
	score: number;
	maxScore: number;
	details: string[];
	suggestion?: string;
}
