import { describe, expect, test } from "bun:test";
import { evaluateAssertion } from "../../src/run/assertions.js";

const emptyContext = {
	changedFiles: [],
	diff: "",
	testResults: new Map<string, { passed: boolean; output: string }>(),
};

describe("evaluateAssertion", () => {
	describe("files-changed", () => {
		test("passes when matching files are changed", () => {
			const result = evaluateAssertion(
				{ type: "files-changed", pattern: "src/**/*.ts", expect: "modified" },
				{ ...emptyContext, changedFiles: ["src/auth/login.ts", "src/auth/session.ts"] },
			);
			expect(result.passed).toBe(true);
		});

		test("fails when no matching files changed", () => {
			const result = evaluateAssertion(
				{ type: "files-changed", pattern: "src/auth/**", expect: "modified" },
				{ ...emptyContext, changedFiles: ["src/billing/invoice.ts"] },
			);
			expect(result.passed).toBe(false);
		});
	});

	describe("files-unchanged", () => {
		test("passes when no matching files changed", () => {
			const result = evaluateAssertion(
				{ type: "files-unchanged", pattern: "src/billing/**" },
				{ ...emptyContext, changedFiles: ["src/auth/login.ts"] },
			);
			expect(result.passed).toBe(true);
		});

		test("fails when matching files were changed", () => {
			const result = evaluateAssertion(
				{ type: "files-unchanged", pattern: "src/billing/**" },
				{ ...emptyContext, changedFiles: ["src/billing/invoice.ts"] },
			);
			expect(result.passed).toBe(false);
		});
	});

	describe("test-pass", () => {
		test("passes when command exits 0", () => {
			const testResults = new Map([["bun test", { passed: true, output: "5 tests passed" }]]);
			const result = evaluateAssertion(
				{ type: "test-pass", command: "bun test" },
				{ ...emptyContext, testResults },
			);
			expect(result.passed).toBe(true);
		});

		test("fails when command exits non-zero", () => {
			const testResults = new Map([["bun test", { passed: false, output: "2 failures" }]]);
			const result = evaluateAssertion(
				{ type: "test-pass", command: "bun test" },
				{ ...emptyContext, testResults },
			);
			expect(result.passed).toBe(false);
		});

		test("fails when command was not executed", () => {
			const result = evaluateAssertion({ type: "test-pass", command: "bun test" }, emptyContext);
			expect(result.passed).toBe(false);
		});
	});

	describe("convention", () => {
		test("passes when pattern found in added lines", () => {
			const diff = `diff --git a/file.ts b/file.ts
--- a/file.ts
+++ b/file.ts
@@ -1,3 +1,3 @@
-console.log("old");
+logger.info("new");`;
			const result = evaluateAssertion(
				{ type: "convention", pattern: "logger\\.info", expect: "present-in-changes" },
				{ ...emptyContext, diff },
			);
			expect(result.passed).toBe(true);
		});

		test("fails when pattern not found in added lines", () => {
			const diff = `+++ b/file.ts
+console.log("still old");`;
			const result = evaluateAssertion(
				{ type: "convention", pattern: "logger\\.info", expect: "present-in-changes" },
				{ ...emptyContext, diff },
			);
			expect(result.passed).toBe(false);
		});
	});
});
