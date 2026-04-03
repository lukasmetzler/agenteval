import type { ResultScores, StoredResult } from "../run/types.js";

export interface ResultQuery {
	task?: string;
	harness?: string;
	status?: StoredResult["status"];
	limit?: number;
}

export interface ComparisonReport {
	runA: StoredResult;
	runB: StoredResult;
	winner: "a" | "b" | "tie";
	metrics: ComparisonMetric[];
	summary: string;
	instructionDiff?: Record<string, "added" | "removed" | "changed" | "unchanged">;
}

export interface ComparisonMetric {
	name: keyof ResultScores;
	valueA: number | null;
	valueB: number | null;
	delta: number | null;
	better: "a" | "b" | "tie" | "unknown";
}
