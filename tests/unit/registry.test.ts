import { describe, expect, test } from "bun:test";
import type { Config } from "../../src/config/schema.js";
import { getAdapter } from "../../src/harness/registry.js";
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
});
