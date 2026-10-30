import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { ConfigSchema } from "../../src/config/schema.js";
import { MockAdapter } from "../../src/harness/mock.js";
import { executeRun } from "../../src/run/index.js";
import type { TaskDefinition } from "../../src/run/types.js";

const OXLINT = resolve(import.meta.dir, "../../node_modules/.bin/oxlint");

async function sh(cwd: string, ...cmd: string[]) {
	const proc = Bun.spawn(cmd, { cwd, stdout: "pipe", stderr: "pipe" });
	if ((await proc.exited) !== 0) throw new Error(await new Response(proc.stderr).text());
}

let repo: string;

beforeAll(async () => {
	repo = mkdtempSync(join(tmpdir(), "lint-delta-"));
	mkdirSync(join(repo, "src"));
	mkdirSync(join(repo, "node_modules/.bin"), { recursive: true });
	symlinkSync(OXLINT, join(repo, "node_modules/.bin/oxlint"));
	writeFileSync(join(repo, ".gitignore"), "node_modules\n.agenteval\n");
	writeFileSync(join(repo, "package.json"), '{ "devDependencies": { "oxlint": "^1.90.0" } }\n');
	writeFileSync(join(repo, ".oxlintrc.json"), '{ "rules": { "no-debugger": "error" } }\n');
	// Pre-existing problem on a line the agent will not touch.
	writeFileSync(join(repo, "src/old.js"), "export function a() {\n\tdebugger;\n}\n");
	writeFileSync(join(repo, "CLAUDE.md"), "# Test\n");
	await sh(repo, "git", "init", "-q");
	await sh(repo, "git", "add", "-A");
	await sh(repo, "git", "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "init");
});

afterAll(() => rmSync(repo, { recursive: true, force: true }));

const task: TaskDefinition = {
	name: "lint-delta",
	description: "add a function",
	prompt: "add a function",
	harness: "generic",
	timeout: 60,
	assertions: [{ type: "lint-delta" }],
	scoring: { correctness: 0.4, precision: 0.3, efficiency: 0.2, conventions: 0.1 },
};

function mock(filesToChange: Record<string, string>) {
	return new MockAdapter({ filesToChange, exitCode: 0, stdout: "done", durationMs: 1 });
}

async function run(filesToChange: Record<string, string>) {
	const config = ConfigSchema.parse({ version: 1 });
	return executeRun(config, task, { sourcePath: "CLAUDE.md", targetFilename: "CLAUDE.md" }, repo, {
		adapter: mock(filesToChange),
	});
}

describe("lint-delta assertion with real oxlint", () => {
	test("flags a finding in a file the agent created (untracked files are in the diff)", async () => {
		const result = await run({ "src/new.js": "export function b() {\n\tdebugger;\n}\n" });
		expect(result.status).toBe("success");
		expect(result.lint?.tools).toEqual([{ tool: "oxlint", status: "ok" }]);
		expect(result.lint?.newDiagnostics.map((d) => `${d.file}:${d.line}:${d.rule}`)).toEqual([
			"src/new.js:2:eslint(no-debugger)",
		]);
		expect(result.assertions[0]?.passed).toBe(false);
		expect(result.scores.conventions).toBe(0);
	});

	test("ignores pre-existing findings on lines the agent did not touch", async () => {
		const result = await run({
			"src/old.js": "export function a() {\n\tdebugger;\n}\n\nexport const added = 1;\n",
		});
		expect(result.lint?.newDiagnostics).toEqual([]);
		expect(result.assertions[0]?.passed).toBe(true);
		expect(result.scores.conventions).toBe(1);
	});
});
