import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { parseUnifiedDiff } from "../../src/toolchain/diff.js";
import {
	parseBiomeSarif,
	parseEslint,
	parseOxlint,
	parseRuff,
	parseTsc,
} from "../../src/toolchain/runners.js";

const FIXTURES = resolve(import.meta.dir, "../fixtures/linters");
const read = (name: string) => Bun.file(`${FIXTURES}/${name}`).text();
const brief = (result: unknown) =>
	Array.isArray(result)
		? result.map((d) => `${d.tool}:${d.file}:${d.line}:${d.rule}:${d.severity}`)
		: result;

describe("linter output parsers", () => {
	test("oxlint JSON (recorded from oxlint 1.90)", async () => {
		// oxlint is multithreaded, so output order varies between runs.
		const parsed = brief(parseOxlint(await read("oxlint.json"), "/repo"));
		expect(Array.isArray(parsed) && [...parsed].sort()).toEqual([
			"oxlint:bad.js:2:eslint(no-debugger):warning",
			"oxlint:bad.js:3:eslint(no-unused-vars):warning",
			"oxlint:bad.ts:1:eslint(no-unused-vars):warning",
		]);
	});

	test("oxlint JSON preceded by a 'No files found' notice", () => {
		const stdout = 'No files found to lint.\n{ "diagnostics": [], "number_of_files": 0 }';
		expect(parseOxlint(stdout, "/repo")).toEqual([]);
	});

	test("Biome SARIF (recorded from Biome 2.4)", async () => {
		expect(brief(parseBiomeSarif(await read("biome.sarif.json"), "/repo"))).toEqual([
			"biome:bad.js:3:lint/correctness/noUnusedVariables:warning",
			"biome:bad.ts:2:lint/suspicious/noExplicitAny:warning",
			"biome:bad.ts:1:lint/correctness/noUnusedVariables:warning",
			"biome:bad.js:2:lint/suspicious/noDebugger:error",
		]);
	});

	test("ESLint JSON formatter, absolute paths made repo-relative", async () => {
		expect(brief(parseEslint(await read("eslint.json"), "/repo"))).toEqual([
			"eslint:src/app.js:3:no-unused-vars:error",
			"eslint:src/app.js:4:eqeqeq:warning",
			"eslint:src/app.js:9:fatal:error",
		]);
	});

	test("ruff JSON", async () => {
		expect(brief(parseRuff(await read("ruff.json"), "/repo"))).toEqual([
			"ruff:app/main.py:1:F401:error",
			"ruff:app/main.py:5:E711:error",
		]);
	});

	test("tsc --pretty false (recorded from TypeScript 6)", async () => {
		expect(brief(parseTsc(await read("tsc.txt"), "/repo"))).toEqual([
			"tsc:types.ts:1:TS2322:error",
			"tsc:src/a.ts:10:TS2304:error",
		]);
	});

	test("unparseable output is reported, not swallowed", () => {
		expect(parseOxlint("segfault", "/repo")).toEqual({ error: "no JSON document in output" });
	});
});

describe("parseUnifiedDiff", () => {
	test("tracks added line numbers per file and new/deleted files", () => {
		const diff = [
			"diff --git a/src/a.ts b/src/a.ts",
			"--- a/src/a.ts",
			"+++ b/src/a.ts",
			"@@ -1,3 +1,4 @@",
			" line1",
			"-old",
			"+new2",
			"+new3",
			" line4",
			"@@ -20,2 +21,2 @@",
			" ctx",
			"+added22",
			"diff --git a/src/b.ts b/src/b.ts",
			"new file mode 100644",
			"--- /dev/null",
			"+++ b/src/b.ts",
			"@@ -0,0 +1,1 @@",
			"+hello",
			"diff --git a/gone.ts b/gone.ts",
			"deleted file mode 100644",
		].join("\n");
		const changes = parseUnifiedDiff(diff);
		expect(changes.map((c) => [c.path, [...c.addedLines], c.isNew, c.isDeleted])).toEqual([
			["src/a.ts", [2, 3, 22], false, false],
			["src/b.ts", [1], true, false],
			["gone.ts", [], false, true],
		]);
	});
});
