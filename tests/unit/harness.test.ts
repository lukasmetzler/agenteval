import { afterAll, describe, expect, test } from "bun:test";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { BUILTIN_SPECS } from "../../src/harness/builtin.js";
import { CliAdapter } from "../../src/harness/cli.js";
import {
	parseAntigravityJson,
	parseClaudeResult,
	parseCodexEvents,
	parseGeminiJson,
	parseJsonEvents,
	parseOpenCodeEvents,
} from "../../src/harness/jsonl.js";
import { spawnAgent } from "../../src/harness/spawn.js";
import type { TaskDefinition } from "../../src/run/types.js";

const FIXTURES = resolve(import.meta.dir, "../fixtures/harness");
const fixture = (name: string) => readFileSync(join(FIXTURES, name), "utf-8");

describe("agent output parsers", () => {
	test("Claude Code result: input includes cache tokens, cost, turns, model", () => {
		expect(parseClaudeResult(fixture("claude-code.json"))).toEqual({
			tokensInput: 412 + 8120 + 61344,
			tokensOutput: 2210,
			tokensTotal: 412 + 8120 + 61344 + 2210,
			tokenSource: "api",
			costUsd: 0.1834,
			model: "claude-sonnet-5-5",
			turns: 7,
		});
	});

	test("Codex JSONL: sums usage across turns, counts reasoning as output", () => {
		const m = parseCodexEvents(fixture("codex.jsonl"));
		expect([m.tokensInput, m.tokensOutput, m.turns, m.tokenSource]).toEqual([27763, 586, 2, "api"]);
	});

	test("Gemini CLI JSON: per-model token stats", () => {
		const m = parseGeminiJson(fixture("gemini.json"));
		expect([m.tokensInput, m.tokensOutput, m.tokensTotal, m.model]).toEqual([
			18240,
			910,
			19650,
			"gemini-3.1-pro",
		]);
	});

	test("Antigravity JSON: usage and turns", () => {
		const m = parseAntigravityJson(fixture("antigravity.json"));
		expect([m.tokensInput, m.tokensOutput, m.tokensTotal, m.turns]).toEqual([
			15100, 2000, 17100, 5,
		]);
	});

	test("OpenCode events: sums step-finish tokens and cost", () => {
		const m = parseOpenCodeEvents(fixture("opencode.jsonl"));
		expect([m.tokensInput, m.tokensOutput, m.costUsd, m.turns]).toEqual([18800, 470, 0.016, 2]);
	});

	test("Amp stream-json uses the Claude-compatible result event", () => {
		const m = parseClaudeResult(fixture("amp.jsonl"));
		expect([m.tokensTotal, m.turns, m.costUsd]).toEqual([12800, 4, null]);
	});

	test("plain text output yields unavailable metrics, not zeros", () => {
		expect(parseClaudeResult("Done, I changed two files.").tokenSource).toBe("unavailable");
		expect(parseCodexEvents("").tokensTotal).toBeNull();
	});

	test("parseJsonEvents skips non-JSON progress lines", () => {
		expect(parseJsonEvents('warming up\n{"type":"a"}\n{"type":"b"}\n')).toEqual([
			{ type: "a" },
			{ type: "b" },
		]);
	});
});

describe("built-in specs", () => {
	test("each agent has a unique name and a known instruction target", () => {
		const names = BUILTIN_SPECS.map((s) => s.name);
		expect(new Set(names).size).toBe(names.length);
		const targets = Object.fromEntries(BUILTIN_SPECS.map((s) => [s.name, s.instructionTarget]));
		expect(targets).toEqual({
			"claude-code": "CLAUDE.md",
			codex: "AGENTS.md",
			gemini: "GEMINI.md",
			antigravity: "GEMINI.md",
			copilot: ".github/copilot-instructions.md",
			cursor: "AGENTS.md",
			opencode: "AGENTS.md",
			devin: "AGENTS.md",
			amp: "AGENTS.md",
		});
	});

	test("claude-code never uses --bare (it would skip CLAUDE.md)", () => {
		const claude = BUILTIN_SPECS.find((s) => s.name === "claude-code");
		expect(claude?.args({})).not.toContain("--bare");
		expect(claude?.args({ model: "claude-haiku-5-5" })).toContain("claude-haiku-5-5");
	});
});

describe("CliAdapter with a real process", () => {
	const dir = mkdtempSync(join(tmpdir(), "cli-adapter-"));
	afterAll(() => rmSync(dir, { recursive: true, force: true }));

	const script = (name: string, body: string) => {
		const path = join(dir, name);
		writeFileSync(path, `#!/bin/sh\n${body}\n`);
		chmodSync(path, 0o755);
		return path;
	};

	const task: TaskDefinition = {
		name: "t",
		description: "d",
		prompt: "write hello",
		harness: "x",
		timeout: 5,
		assertions: [],
		scoring: { correctness: 1, precision: 0, efficiency: 0, conventions: 0 },
	};

	test("pipes the prompt on stdin and parses JSON output", async () => {
		const bin = script(
			"fake-agent",
			'read prompt; echo "$prompt" > out.txt; echo \'{"type":"result","num_turns":1,"usage":{"input_tokens":5,"output_tokens":2}}\'',
		);
		const adapter = new CliAdapter({
			name: "fake",
			binary: bin,
			instructionTarget: "docs/AGENTS.md",
			args: () => [],
			prompt: "stdin",
			parseMetrics: (raw) => parseClaudeResult(raw.stdout),
		});
		expect(await adapter.isAvailable()).toBe(true);
		writeFileSync(join(dir, "src.md"), "# rules");
		await adapter.injectInstructions(dir, join(dir, "src.md"));
		expect(existsSync(join(dir, "docs/AGENTS.md"))).toBe(true);

		const raw = await adapter.runTask(dir, task, 5);
		expect(readFileSync(join(dir, "out.txt"), "utf-8").trim()).toBe("write hello");
		expect(adapter.parseMetrics(raw).tokensTotal).toBe(7);
	});

	test("escalates to SIGKILL when the agent ignores SIGTERM", async () => {
		const bin = script("stubborn", "trap '' TERM\nwhile true; do sleep 0.1; done");
		const start = performance.now();
		const raw = await spawnAgent({
			command: [bin],
			cwd: dir,
			timeoutSeconds: 0.2,
			killGraceMs: 200,
		});
		expect(raw.timedOut).toBe(true);
		expect(performance.now() - start).toBeLessThan(3_000);
	});
});
