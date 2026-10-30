import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ImportResolverRule } from "../../src/lint/importResolver.js";
import { extractImports, resolveImportGraph } from "../../src/markdown/imports.js";
import { makeContext, makeParsedFile } from "../../tests/helpers.js";

describe("extractImports", () => {
	test("finds file-like @imports and skips package names, mentions, and code", () => {
		const content = [
			"See @AGENTS.md and @docs/style.md.",
			"Personal: @~/.claude/me.md",
			"Install @types/node, ping @alice, mail bob@example.com",
			"`@ignored.md` and",
			"```",
			"@also-ignored.md",
			"```",
			"@./rel/path",
		].join("\n");
		expect(extractImports(content).map((r) => r.path)).toEqual([
			"AGENTS.md",
			"docs/style.md",
			"~/.claude/me.md",
			"./rel/path",
		]);
	});
});

describe("resolveImportGraph", () => {
	const files: Record<string, string> = {
		"/r/CLAUDE.md": "@a.md",
		"/r/a.md": "@sub/b.md",
		"/r/sub/b.md": "@../a.md and @c.md",
	};
	const read = (p: string) => files[p] ?? null;

	test("resolves relative to the importing file and reports cycles and missing files", () => {
		const graph = resolveImportGraph(
			[{ path: "/r/CLAUDE.md", content: files["/r/CLAUDE.md"] ?? "" }],
			read,
		);
		expect([...graph.imported.keys()]).toEqual(["/r/a.md", "/r/sub/b.md"]);
		expect(graph.issues.map((i) => `${i.kind}:${i.resolved}`)).toEqual([
			"cycle:/r/a.md",
			"missing:/r/sub/c.md",
		]);
	});

	test("stops after 4 hops", () => {
		const chain: Record<string, string> = {
			"/d/0.md": "@1.md",
			"/d/1.md": "@2.md",
			"/d/2.md": "@3.md",
			"/d/3.md": "@4.md",
			"/d/4.md": "@5.md",
			"/d/5.md": "end",
		};
		const graph = resolveImportGraph(
			[{ path: "/d/0.md", content: "@1.md" }],
			(p) => chain[p] ?? null,
		);
		expect(graph.issues.map((i) => i.kind)).toEqual(["too-deep"]);
		expect(graph.imported.size).toBe(4);
	});
});

describe("ImportResolverRule", () => {
	test("reports a missing import with line number", async () => {
		const dir = mkdtempSync(join(tmpdir(), "imports-"));
		mkdirSync(join(dir, "docs"));
		writeFileSync(join(dir, "docs", "ok.md"), "fine");
		const file = makeParsedFile(
			"# Rules\n\n@docs/ok.md\n@docs/missing.md\n",
			join(dir, "CLAUDE.md"),
		);
		const diags = await new ImportResolverRule().run(makeContext([file]));
		rmSync(dir, { recursive: true });
		expect(diags.map((d) => [d.ruleId, d.line])).toEqual([["import/missing", 4]]);
	});
});
