import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { runLiveReview } from "../../src/harvest/live.js";

const repoRoot = join(import.meta.dir, "../..");

describe("runLiveReview", () => {
	test("returns valid structure", async () => {
		const result = await runLiveReview(repoRoot);
		expect(result).toHaveProperty("rubrics");
		expect(result).toHaveProperty("overallScore");
		expect(result).toHaveProperty("filesAnalyzed");
		expect(result).toHaveProperty("summary");
		expect(result.overallScore).toBeGreaterThanOrEqual(0);
		expect(result.overallScore).toBeLessThanOrEqual(10);
		expect(result.filesAnalyzed).toBeGreaterThanOrEqual(0);
	});

	test("clean working tree returns score 10", async () => {
		// This test assumes a clean working tree (e.g., in CI)
		// If there are uncommitted changes, the score may differ
		const result = await runLiveReview(repoRoot);
		if (result.filesAnalyzed === 0) {
			expect(result.overallScore).toBe(10);
			expect(result.summary).toContain("No changes");
		}
	});

	test("rubric names are correct when files are present", async () => {
		const result = await runLiveReview(repoRoot);
		if (result.rubrics.length > 0) {
			const names = result.rubrics.map((r) => r.name);
			expect(names).toContain("scope-discipline");
			expect(names).toContain("test-coverage");
			expect(names).toContain("diff-hygiene");
		}
	});
});
