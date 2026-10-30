import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { ConfigSchema } from "../../src/config/schema.js";
import { MockAdapter } from "../../src/harness/mock.js";
import type { HarnessAdapter } from "../../src/harness/types.js";
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
	return executeRun(config, task, { sourcePath: "CLAUDE.md" }, repo, {
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

describe("baseline arm", () => {
	test("removes every instruction file before the agent runs", async () => {
		const seen: string[] = [];
		const probe: HarnessAdapter = {
			name: "probe",
			instructionTarget: "CLAUDE.md",
			isAvailable: async () => true,
			injectInstructions: async () => {},
			runTask: async (worktree) => {
				seen.push(existsSync(join(worktree, "CLAUDE.md")) ? "present" : "absent");
				return { stdout: "", stderr: "", exitCode: 0, durationMs: 1, timedOut: false };
			},
			parseMetrics: () => ({
				tokensInput: null,
				tokensOutput: null,
				tokensTotal: null,
				tokenSource: "unavailable",
			}),
		};
		const config = ConfigSchema.parse({ version: 1 });
		const withInstructions = await executeRun(config, task, { sourcePath: "CLAUDE.md" }, repo, {
			adapter: probe,
		});
		const baseline = await executeRun(config, task, { sourcePath: null }, repo, { adapter: probe });
		expect(seen).toEqual(["present", "absent"]);
		expect(baseline.instructions).toBe("(baseline: no instructions)");
		expect(withInstructions.instructions).toBe("CLAUDE.md");
	});
});

describe("agent failures and replay start point", () => {
	const failing = (stdout: string, exitCode: number): HarnessAdapter => ({
		name: "failing",
		instructionTarget: "CLAUDE.md",
		isAvailable: async () => true,
		injectInstructions: async () => {},
		runTask: async () => ({ stdout, stderr: "boom", exitCode, durationMs: 1, timedOut: false }),
		parseMetrics: () => ({
			tokensInput: null,
			tokensOutput: null,
			tokensTotal: null,
			tokenSource: "unavailable",
		}),
	});
	const config = ConfigSchema.parse({ version: 1 });

	test("a non-zero exit is an error even when the agent printed JSON", async () => {
		const stdout = JSON.stringify({
			type: "turn.failed",
			error: { message: JSON.stringify({ error: { message: "model not supported" } }) },
		});
		const result = await executeRun(config, task, { sourcePath: "CLAUDE.md" }, repo, {
			adapter: failing(stdout, 1),
		});
		expect(result.status).toBe("error");
		expect(result.error).toContain("model not supported");
	});

	test("an is_error result is an error even with exit code 0", async () => {
		const stdout = '{"type":"result","subtype":"error_max_turns","is_error":true}';
		const result = await executeRun(config, task, { sourcePath: "CLAUDE.md" }, repo, {
			adapter: failing(stdout, 0),
		});
		expect(result.status).toBe("error");
	});

	test("a harvested task starts from its source commit's parent", async () => {
		writeFileSync(join(repo, "src/later.js"), "export const later = 1;\n");
		await sh(repo, "git", "add", "-A");
		await sh(
			repo,
			"git",
			"-c",
			"user.name=t",
			"-c",
			"user.email=t@t",
			"commit",
			"-qm",
			"add later",
		);
		const head = (await Bun.$`git rev-parse HEAD`.cwd(repo).text()).trim();
		const seen: boolean[] = [];
		const probe: HarnessAdapter = {
			...failing("", 0),
			runTask: async (worktree) => {
				seen.push(existsSync(join(worktree, "src/later.js")));
				return { stdout: "", stderr: "", exitCode: 0, durationMs: 1, timedOut: false };
			},
		};
		await executeRun(config, { ...task, sourceCommit: head }, { sourcePath: "CLAUDE.md" }, repo, {
			adapter: probe,
		});
		await executeRun(config, task, { sourcePath: "CLAUDE.md" }, repo, { adapter: probe });
		expect(seen).toEqual([false, true]);
	});
});

describe("timeouts", () => {
	test("a task without timeout uses config run.timeout", async () => {
		let seen = 0;
		const probe: HarnessAdapter = {
			name: "probe",
			instructionTarget: "CLAUDE.md",
			isAvailable: async () => true,
			injectInstructions: async () => {},
			runTask: async (_w, _t, timeoutSeconds) => {
				seen = timeoutSeconds;
				return { stdout: "", stderr: "", exitCode: 0, durationMs: 1, timedOut: false };
			},
			parseMetrics: () => ({
				tokensInput: null,
				tokensOutput: null,
				tokensTotal: null,
				tokenSource: "unavailable",
			}),
		};
		const config = ConfigSchema.parse({ version: 1, run: { timeout: 42 } });
		await executeRun(config, { ...task, timeout: undefined }, { sourcePath: "CLAUDE.md" }, repo, {
			adapter: probe,
		});
		expect(seen).toBe(42);
		await executeRun(config, { ...task, timeout: 7 }, { sourcePath: "CLAUDE.md" }, repo, {
			adapter: probe,
		});
		expect(seen).toBe(7);
	});
});
