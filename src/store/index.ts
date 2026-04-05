import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { StoredResult } from "../run/types.js";
import { logger } from "../utils/logger.js";
import type { ResultQuery } from "./types.js";

/**
 * Write a run result to disk as a JSON file.
 * Creates the results directory if it doesn't exist.
 */
export function writeResult(result: StoredResult, resultsDir: string): string {
	mkdirSync(resultsDir, { recursive: true });
	const filePath = join(resultsDir, `${result.id}.json`);
	writeFileSync(filePath, JSON.stringify(result, null, 2), "utf-8");
	logger.debug(`Wrote result to ${filePath}`);
	return filePath;
}

/**
 * Read a single run result by ID.
 */
export function readResult(runId: string, resultsDir: string): StoredResult | null {
	const filePath = join(resultsDir, `${runId}.json`);
	if (!existsSync(filePath)) return null;

	const raw = readFileSync(filePath, "utf-8");
	return JSON.parse(raw) as StoredResult;
}

/**
 * List all stored results, sorted by timestamp descending (newest first).
 * Supports filtering by task, harness, and status.
 */
export function listResults(resultsDir: string, query?: ResultQuery): StoredResult[] {
	if (!existsSync(resultsDir)) return [];

	const files = readdirSync(resultsDir).filter((f) => f.endsWith(".json"));
	const results: StoredResult[] = [];

	for (const file of files) {
		try {
			const raw = readFileSync(join(resultsDir, file), "utf-8");
			const result = JSON.parse(raw) as StoredResult;
			results.push(result);
		} catch {
			logger.warn(`Skipping corrupt result file: ${file}`);
		}
	}

	let filtered = results;

	if (query?.task) {
		filtered = filtered.filter((r) => r.task === query.task);
	}
	if (query?.harness) {
		filtered = filtered.filter((r) => r.harness === query.harness);
	}
	if (query?.status) {
		filtered = filtered.filter((r) => r.status === query.status);
	}

	filtered.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

	if (query?.limit) {
		filtered = filtered.slice(0, query.limit);
	}

	return filtered;
}

/**
 * Delete results older than the retention period.
 * Returns the count of pruned results.
 */
export function pruneResults(resultsDir: string, retentionDays: number): number {
	if (!existsSync(resultsDir)) return 0;

	const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
	const files = readdirSync(resultsDir).filter((f) => f.endsWith(".json"));
	let pruned = 0;

	for (const file of files) {
		try {
			const raw = readFileSync(join(resultsDir, file), "utf-8");
			const result = JSON.parse(raw) as StoredResult;
			const resultTime = new Date(result.timestamp).getTime();

			if (resultTime < cutoff) {
				rmSync(join(resultsDir, file));
				pruned++;
				logger.debug(`Pruned old result: ${file}`);
			}
		} catch {
			logger.warn(`Skipping corrupt result file during prune: ${file}`);
		}
	}

	return pruned;
}

/**
 * Parse a retention string like "90d" into number of days.
 */
export function parseRetention(retention: string): number {
	const match = /^(\d+)d$/.exec(retention);
	if (!match) {
		throw new Error(`Invalid retention format: "${retention}". Use format like "90d".`);
	}
	return Number.parseInt(match[1], 10);
}
