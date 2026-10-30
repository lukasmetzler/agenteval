import { describe, expect, test } from "bun:test";
import type { Config } from "../../src/config/schema.js";
import { getAdapter, isKnownHarness, knownHarnesses } from "../../src/harness/registry.js";
import { defaultConfig } from "../helpers.js";

describe("getAdapter", () => {
	test("returns ClaudeCodeAdapter for 'claude-code'", () => {
		const adapter = getAdapter("claude-code", defaultConfig);
		expect(adapter.name).toBe("claude-code");
	});

	test("returns MockAdapter for 'mock'", () => {
		const adapter = getAdapter("mock", defaultConfig);
		expect(adapter.name).toBe("mock");
	});

	test("returns GenericAdapter for configured harness", () => {
		const config: Config = {
			...defaultConfig,
			harnesses: {
				"my-agent": { command: "my-agent", args: ["--run"], instructionPath: "AGENTS.md" },
			},
		};
		const adapter = getAdapter("my-agent", config);
		expect(adapter.name).toBe("generic");
	});

	test("throws for unknown harness", () => {
		expect(() => getAdapter("nonexistent", defaultConfig)).toThrow("Unknown harness");
	});

	test("resolves every built-in agent", () => {
		for (const name of [
			"codex",
			"gemini",
			"antigravity",
			"copilot",
			"cursor",
			"opencode",
			"devin",
			"amp",
		]) {
			expect(getAdapter(name, defaultConfig).name).toBe(name);
		}
	});

	test("windsurf is a deprecated alias for devin", () => {
		expect(getAdapter("windsurf", defaultConfig).name).toBe("devin");
	});

	test("a harnesses: entry overrides the built-in of the same name", () => {
		const config: Config = {
			...defaultConfig,
			harnesses: { codex: { command: "my-codex", args: [], instructionPath: "AGENTS.md" } },
		};
		expect(getAdapter("codex", config).name).toBe("generic");
	});
});

describe("isKnownHarness", () => {
	test("accepts built-ins, aliases, mock, auto, and config keys", () => {
		const config: Config = {
			...defaultConfig,
			harnesses: { "my-agent": { command: "x", args: [], instructionPath: "AGENTS.md" } },
		};
		for (const name of ["claude-code", "windsurf", "mock", "auto", "my-agent"]) {
			expect(isKnownHarness(name, config)).toBe(true);
		}
		expect(isKnownHarness("nope", config)).toBe(false);
		expect(knownHarnesses(config)).toContain("my-agent");
	});
});
