import { describe, expect, test } from "bun:test";
import type { LiveReviewConfig } from "../../src/config/schema.js";
import { selectAndScoreRubrics } from "../../src/harvest/live.js";

const defaultConfig: LiveReviewConfig = {
	rubrics: {
		scopeDiscipline: { enabled: true, weight: 1.0 },
		testCoverage: { enabled: true, weight: 1.0 },
		diffHygiene: { enabled: true, weight: 1.0 },
		conventionCompliance: { enabled: true, weight: 1.0 },
		progressiveDisclosure: { enabled: true, weight: 1.0 },
	},
};

const sampleFiles = ["src/auth.ts", "tests/auth.test.ts"];
const cleanDiff = [
	"diff --git a/src/auth.ts b/src/auth.ts",
	"--- a/src/auth.ts",
	"+++ b/src/auth.ts",
	"@@ -1,3 +1,4 @@",
	" import { foo } from './foo';",
	"+import { bar } from './bar';",
	" ",
	" export function auth() {",
].join("\n");

// ──────────────────────────────────────────────
// selectAndScoreRubrics
// ──────────────────────────────────────────────

describe("selectAndScoreRubrics", () => {
	test("all rubrics enabled with equal weight — average score", async () => {
		const result = await selectAndScoreRubrics(sampleFiles, cleanDiff, defaultConfig);
		expect(result.rubrics).toHaveLength(3);
		expect(result.overallScore).toBeGreaterThan(0);
		expect(result.overallScore).toBeLessThanOrEqual(10);
		expect(result.filesAnalyzed).toBe(2);

		const names = result.rubrics.map((r) => r.name);
		expect(names).toContain("scope-discipline");
		expect(names).toContain("test-coverage");
		expect(names).toContain("diff-hygiene");
	});

	test("one rubric disabled — excluded from result and average", async () => {
		const config: LiveReviewConfig = {
			rubrics: {
				scopeDiscipline: { enabled: true, weight: 1.0 },
				testCoverage: { enabled: false, weight: 1.0 },
				diffHygiene: { enabled: true, weight: 1.0 },
				conventionCompliance: { enabled: true, weight: 1.0 },
				progressiveDisclosure: { enabled: true, weight: 1.0 },
			},
		};
		const result = await selectAndScoreRubrics(sampleFiles, cleanDiff, config);
		expect(result.rubrics).toHaveLength(2);

		const names = result.rubrics.map((r) => r.name);
		expect(names).toContain("scope-discipline");
		expect(names).not.toContain("test-coverage");
		expect(names).toContain("diff-hygiene");
	});

	test("custom weights — weighted average", async () => {
		// scopeDiscipline weight 2.0, others 1.0
		const config: LiveReviewConfig = {
			rubrics: {
				scopeDiscipline: { enabled: true, weight: 2.0 },
				testCoverage: { enabled: true, weight: 1.0 },
				diffHygiene: { enabled: true, weight: 1.0 },
				conventionCompliance: { enabled: true, weight: 1.0 },
				progressiveDisclosure: { enabled: true, weight: 1.0 },
			},
		};
		// Use files that produce known scores with divergence:
		// scopeDiscipline: 2 dirs (src, tests) => score 8 => normalized 0.8
		// testCoverage: 1 test / 5 impl = 0.2 ratio => score 5 => normalized 0.5
		// diffHygiene: clean => 10 => normalized 1.0
		const manyFiles = [
			"src/a.ts",
			"src/b.ts",
			"src/c.ts",
			"src/d.ts",
			"src/e.ts",
			"tests/a.test.ts",
		];
		const result = await selectAndScoreRubrics(manyFiles, cleanDiff, config);

		// weighted = (0.8*2 + 0.5*1 + 1.0*1) / (2+1+1) = 3.1/4 = 0.775 * 10 = 7.8
		expect(result.overallScore).toBe(7.8);
	});

	test("all rubrics disabled — overallScore 0 and empty rubrics", async () => {
		const config: LiveReviewConfig = {
			rubrics: {
				scopeDiscipline: { enabled: false, weight: 1.0 },
				testCoverage: { enabled: false, weight: 1.0 },
				diffHygiene: { enabled: false, weight: 1.0 },
				conventionCompliance: { enabled: false, weight: 1.0 },
				progressiveDisclosure: { enabled: false, weight: 1.0 },
			},
		};
		const result = await selectAndScoreRubrics(sampleFiles, cleanDiff, config);
		expect(result.rubrics).toHaveLength(0);
		expect(result.overallScore).toBe(0);
		expect(result.summary).toContain("no rubrics enabled");
	});

	test("zero weight — contributes nothing to average", async () => {
		const config: LiveReviewConfig = {
			rubrics: {
				scopeDiscipline: { enabled: true, weight: 0 },
				testCoverage: { enabled: true, weight: 1.0 },
				diffHygiene: { enabled: true, weight: 1.0 },
				conventionCompliance: { enabled: true, weight: 1.0 },
				progressiveDisclosure: { enabled: true, weight: 1.0 },
			},
		};
		// Files: all in src => scopeDiscipline = 10 (weight 0, ignored)
		// 0 tests / 5 impl => testCoverage = 0 (4+ impl, ratio 0)
		// clean diff => diffHygiene = 10
		const files = ["src/a.ts", "src/b.ts", "src/c.ts", "src/d.ts", "src/e.ts"];
		const result = await selectAndScoreRubrics(files, cleanDiff, config);

		// testCoverage: 0/10 => 0.0, diffHygiene: 10/10 => 1.0
		// weighted = (0.0*1 + 1.0*1) / (0+1+1) = 1.0/2 = 0.5 * 10 = 5
		expect(result.rubrics).toHaveLength(3); // still present in results
		expect(result.overallScore).toBe(5);
	});

	test("no files — returns score 10 with no rubrics", async () => {
		const result = await selectAndScoreRubrics([], "", defaultConfig);
		expect(result.rubrics).toHaveLength(0);
		expect(result.overallScore).toBe(10);
		expect(result.filesAnalyzed).toBe(0);
		expect(result.summary).toContain("No changes");
	});

	test("all weights zero — overallScore 0", async () => {
		const config: LiveReviewConfig = {
			rubrics: {
				scopeDiscipline: { enabled: true, weight: 0 },
				testCoverage: { enabled: true, weight: 0 },
				diffHygiene: { enabled: true, weight: 0 },
				conventionCompliance: { enabled: true, weight: 0 },
				progressiveDisclosure: { enabled: true, weight: 0 },
			},
		};
		const result = await selectAndScoreRubrics(sampleFiles, cleanDiff, config);
		expect(result.overallScore).toBe(0);
	});

	test("analyze false — LLM rubrics not included even when enabled", async () => {
		const result = await selectAndScoreRubrics(sampleFiles, cleanDiff, defaultConfig, {
			analyze: false,
		});
		const names = result.rubrics.map((r) => r.name);
		expect(names).not.toContain("convention-compliance");
		expect(names).not.toContain("progressive-disclosure");
		// Only heuristic rubrics should be present
		expect(result.rubrics).toHaveLength(3);
	});

	test("analyze undefined — LLM rubrics not included even when enabled", async () => {
		const result = await selectAndScoreRubrics(sampleFiles, cleanDiff, defaultConfig);
		const names = result.rubrics.map((r) => r.name);
		expect(names).not.toContain("convention-compliance");
		expect(names).not.toContain("progressive-disclosure");
	});
});
