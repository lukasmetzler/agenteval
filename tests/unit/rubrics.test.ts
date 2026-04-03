import { describe, expect, test } from "bun:test";
import {
	scoreDiffHygiene,
	scoreScopeDiscipline,
	scoreTestCoverage,
} from "../../src/harvest/rubrics.js";

// ──────────────────────────────────────────────
// scoreScopeDiscipline
// ──────────────────────────────────────────────

describe("scoreScopeDiscipline", () => {
	test("single file scores 10", () => {
		const result = scoreScopeDiscipline(["src/auth.ts"]);
		expect(result.score).toBe(10);
		expect(result.maxScore).toBe(10);
		expect(result.name).toBe("scope-discipline");
	});

	test("focused change in one directory scores 10", () => {
		const result = scoreScopeDiscipline(["src/auth.ts", "src/auth.test.ts"]);
		expect(result.score).toBe(10);
	});

	test("two directories scores 8", () => {
		const result = scoreScopeDiscipline(["src/auth.ts", "tests/auth.test.ts"]);
		expect(result.score).toBe(8);
	});

	test("scattered across 5 directories scores 2", () => {
		const result = scoreScopeDiscipline([
			"src/a.ts",
			"tests/b.ts",
			"docs/c.md",
			"scripts/d.sh",
			"config/e.yaml",
		]);
		expect(result.score).toBe(2);
	});

	test("very scattered across 8+ directories scores 0", () => {
		const result = scoreScopeDiscipline([
			"src/a.ts",
			"tests/b.ts",
			"docs/c.md",
			"scripts/d.sh",
			"config/e.yaml",
			"lib/f.ts",
			"bin/g.ts",
			"tools/h.ts",
		]);
		expect(result.score).toBe(0);
	});

	test("empty file list scores 10", () => {
		const result = scoreScopeDiscipline([]);
		expect(result.score).toBe(10);
	});

	test("root files (no directory) scores 10", () => {
		const result = scoreScopeDiscipline(["README.md", "package.json"]);
		expect(result.score).toBe(10);
	});
});

// ──────────────────────────────────────────────
// scoreTestCoverage
// ──────────────────────────────────────────────

describe("scoreTestCoverage", () => {
	test("good ratio (1:1) scores 10", () => {
		const result = scoreTestCoverage([
			"src/a.ts",
			"src/b.ts",
			"src/c.ts",
			"tests/a.test.ts",
			"tests/b.test.ts",
			"tests/c.test.ts",
		]);
		expect(result.score).toBe(10);
	});

	test("some tests (ratio 0.2) scores 5", () => {
		const result = scoreTestCoverage([
			"src/a.ts",
			"src/b.ts",
			"src/c.ts",
			"src/d.ts",
			"src/e.ts",
			"tests/a.test.ts",
		]);
		expect(result.score).toBe(5);
	});

	test("no tests with many impl files scores 0", () => {
		const result = scoreTestCoverage(["src/a.ts", "src/b.ts", "src/c.ts", "src/d.ts", "src/e.ts"]);
		expect(result.score).toBe(0);
	});

	test("no tests with few impl files scores 3", () => {
		const result = scoreTestCoverage(["src/a.ts", "src/b.ts"]);
		expect(result.score).toBe(3);
	});

	test("test-only change scores 10", () => {
		const result = scoreTestCoverage(["tests/a.test.ts", "tests/b.test.ts", "tests/c.test.ts"]);
		expect(result.score).toBe(10);
	});

	test("empty file list scores 10", () => {
		const result = scoreTestCoverage([]);
		expect(result.score).toBe(10);
	});
});

// ──────────────────────────────────────────────
// scoreDiffHygiene
// ──────────────────────────────────────────────

describe("scoreDiffHygiene", () => {
	test("clean diff scores 10", () => {
		const diff = [
			"diff --git a/src/auth.ts b/src/auth.ts",
			"--- a/src/auth.ts",
			"+++ b/src/auth.ts",
			"@@ -1,3 +1,4 @@",
			" import { foo } from './foo';",
			"+import { bar } from './bar';",
			" ",
			" export function auth() {",
		].join("\n");
		const result = scoreDiffHygiene(diff);
		expect(result.score).toBe(10);
	});

	test("console.log subtracts 1 point", () => {
		const diff = [
			"diff --git a/src/auth.ts b/src/auth.ts",
			"--- a/src/auth.ts",
			"+++ b/src/auth.ts",
			"@@ -1,3 +1,4 @@",
			' import { foo } from "./foo";',
			'+  console.log("debug")',
			" ",
		].join("\n");
		const result = scoreDiffHygiene(diff);
		expect(result.score).toBe(9);
		expect(result.details.some((d) => d.includes("console.log"))).toBe(true);
	});

	test("debugger statement subtracts 1 point", () => {
		const diff = [
			"diff --git a/src/auth.ts b/src/auth.ts",
			"--- a/src/auth.ts",
			"+++ b/src/auth.ts",
			"@@ -1,3 +1,4 @@",
			" import { foo } from './foo';",
			"+  debugger;",
			" ",
		].join("\n");
		const result = scoreDiffHygiene(diff);
		expect(result.score).toBe(9);
		expect(result.details.some((d) => d.includes("debugger"))).toBe(true);
	});

	test("multiple issues subtract multiple points", () => {
		const diff = [
			"diff --git a/src/auth.ts b/src/auth.ts",
			"--- a/src/auth.ts",
			"+++ b/src/auth.ts",
			"@@ -1,3 +1,7 @@",
			'+  console.log("a")',
			'+  console.log("b")',
			'+  console.log("c")',
			"+  debugger;",
			" ",
		].join("\n");
		const result = scoreDiffHygiene(diff);
		expect(result.score).toBe(6);
	});

	test("empty diff scores 10", () => {
		const result = scoreDiffHygiene("");
		expect(result.score).toBe(10);
	});

	test("TODO comment subtracts 1 point", () => {
		const diff = [
			"diff --git a/src/auth.ts b/src/auth.ts",
			"--- a/src/auth.ts",
			"+++ b/src/auth.ts",
			"@@ -1,3 +1,4 @@",
			" import { foo } from './foo';",
			"+  // TODO: fix this",
			" ",
		].join("\n");
		const result = scoreDiffHygiene(diff);
		expect(result.score).toBe(9);
		expect(result.details.some((d) => d.includes("TODO/FIXME"))).toBe(true);
	});
});
