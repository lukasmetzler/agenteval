import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { ToolchainCheckerRule } from "../../src/lint/toolchainChecker.js";
import { parseMarkdown } from "../../src/markdown/parser.js";
import { extractCommands, parseCommand } from "../../src/toolchain/commands.js";
import { detectToolchain } from "../../src/toolchain/detect.js";
import { makeParsedFile } from "../../tests/helpers.js";

const FIXTURES = resolve(import.meta.dir, "../fixtures/toolchain");

describe("detectToolchain", () => {
	test("bun + oxlint + TypeScript 7", () => {
		const tc = detectToolchain(`${FIXTURES}/bun-oxlint`);
		expect(tc.jsPackageManager).toBe("bun");
		expect(tc.typescriptMajor).toBe(7);
		expect(tc.tools.map((t) => [t.id, t.source.kind])).toEqual([
			["oxlint", "config"],
			["tsc", "config"],
		]);
	});

	test("packageManager field wins and dependencies count without config", () => {
		const tc = detectToolchain(`${FIXTURES}/pnpm-eslint-prettier`);
		expect(tc.jsPackageManager).toBe("pnpm");
		expect(tc.tools.map((t) => [t.id, t.source.kind])).toEqual([
			["eslint", "config"],
			["prettier", "dependency"],
		]);
	});

	test("Python: ruff from a nested pyproject table, uv lockfile", () => {
		const tc = detectToolchain(`${FIXTURES}/python-ruff`);
		expect(tc.packageManagers).toEqual(["uv"]);
		expect(tc.jsPackageManager).toBeNull();
		expect(tc.tools.map((t) => t.id)).toEqual(["ruff"]);
	});
});

describe("parseCommand", () => {
	const kinds = (text: string) => {
		const c = parseCommand(text, 1);
		if (!c) return null;
		if (c.kind === "script") return `script:${c.pm}:${c.script}`;
		if (c.kind === "pm") return `pm:${c.pm}:${c.subcommand}`;
		return `tool:${c.tool.id}`;
	};

	test.each([
		["bun run lint", "script:bun:lint"],
		["npm test", "script:npm:test"],
		["pnpm lint", "script:pnpm:lint"],
		["yarn build", "script:yarn:build"],
		["npm install", "pm:npm:install"],
		["yarn", "pm:yarn:install"],
		["npx eslint .", "tool:eslint"],
		["bunx --bun oxlint src", "tool:oxlint"],
		["pnpm exec prettier --check .", "tool:prettier"],
		["ruff check .", "tool:ruff"],
		["CI=1 bun run test", "script:bun:test"],
		["$ tsc --noEmit", "tool:tsc"],
	])("%s", (text, expected) => {
		expect(kinds(text)).toBe(expected);
	});

	test.each([
		["bun test"],
		["bun run src/cli.ts"],
		["npm install -g agenteval-cli"],
		["git status"],
		["pnpm install"],
	])("ignores %s", (text) => {
		const c = parseCommand(text, 1);
		expect(c === null || c.kind === "pm").toBe(true);
	});
});

describe("extractCommands", () => {
	test("reads shell fences and inline code with line numbers, skips other languages", () => {
		const md =
			"Run `bun run lint`.\n\n```bash\nbun install && bun run test # tests\n```\n\n```ts\nnpm run nope\n```\n";
		const cmds = extractCommands(parseMarkdown(md)).map((c) => [c.text, c.line]);
		expect(cmds).toEqual([
			["bun run lint", 1],
			["bun install", 4],
			["bun run test", 4],
		]);
	});
});

describe("ToolchainCheckerRule", () => {
	const rule = new ToolchainCheckerRule();
	const lintFixture = async (dir: string, file: string) => {
		const path = `${FIXTURES}/${dir}/${file}`;
		const parsed = makeParsedFile(await Bun.file(path).text(), path);
		return rule.run({ config: {} as never, files: [parsed], cwd: `${FIXTURES}/${dir}` });
	};

	test("bun-oxlint: wrong package manager, missing script, absent tool", async () => {
		const diags = await lintFixture("bun-oxlint", "CLAUDE.md");
		expect(diags.map((d) => [d.ruleId, d.line])).toEqual([
			["toolchain/wrong-package-manager", 6],
			["toolchain/missing-script", 8],
			["toolchain/absent-tool", 9],
			["toolchain/undocumented", undefined],
		]);
		expect(diags[2]?.message).toContain("this repo uses oxlint (.oxlintrc.json)");
		expect(diags[3]?.message).toContain("TypeScript");
	});

	test("pnpm: implicit script run documents eslint; prettier and tests are undocumented", async () => {
		const diags = await lintFixture("pnpm-eslint-prettier", "AGENTS.md");
		expect(diags.map((d) => d.ruleId)).toEqual([
			"toolchain/undocumented",
			"toolchain/undocumented",
		]);
		expect(diags.map((d) => d.meta)).toEqual([{ tool: "prettier" }, { script: "test" }]);
	});

	test("python: black is flagged when the repo formats with ruff", async () => {
		const diags = await lintFixture("python-ruff", "AGENTS.md");
		expect(diags.map((d) => d.ruleId)).toEqual(["toolchain/absent-tool"]);
		expect(diags[0]?.message).toContain("this repo uses Ruff");
	});
});
