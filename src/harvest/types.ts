export type DetectionMethod = "co-author-tag" | "message-pattern" | "author-email";

export interface AICommit {
	hash: string;
	shortHash: string;
	message: string;
	author: string;
	coAuthors: string[];
	detectionMethod: DetectionMethod;
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
	harness?: "claude-code" | "opencode" | "copilot" | "generic" | "auto";
	timeout?: number;
	minConfidence?: number;
}

export interface HarvestResult {
	commitsScanned: number;
	aiCommitsDetected: number;
	tasksEmitted: number;
	tasks: string[];
	skipped: Array<{ hash: string; reason: string }>;
}
