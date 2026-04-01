import { describe, expect, test } from "bun:test";
import { ConfigSchema } from "../../src/config/schema.js";

describe("ConfigSchema Phase 2 extensions", () => {
	test("run config has sensible defaults", () => {
		const config = ConfigSchema.parse({ version: 1 });
		expect(config.run.timeout).toBe(300);
		expect(config.run.tokensBudget).toBe(50_000);
		expect(config.run.resultsDir).toBe(".agenteval/results");
		expect(config.run.worktreesDir).toBe(".agenteval/worktrees");
		expect(config.run.resultRetention).toBe("90d");
	});

	test("run config accepts custom values", () => {
		const config = ConfigSchema.parse({
			version: 1,
			run: { timeout: 600, tokensBudget: 100_000 },
		});
		expect(config.run.timeout).toBe(600);
		expect(config.run.tokensBudget).toBe(100_000);
	});

	test("harnesses config accepts custom entries", () => {
		const config = ConfigSchema.parse({
			version: 1,
			harnesses: {
				"claude-code": { command: "claude", args: ["--print"] },
				"custom-agent": { command: "my-agent", instructionPath: "AGENTS.md" },
			},
		});
		expect(config.harnesses["claude-code"].command).toBe("claude");
		expect(config.harnesses["custom-agent"].instructionPath).toBe("AGENTS.md");
	});

	test("harnesses config defaults to empty", () => {
		const config = ConfigSchema.parse({ version: 1 });
		expect(Object.keys(config.harnesses)).toHaveLength(0);
	});

	test("existing lint config still works after extension", () => {
		const config = ConfigSchema.parse({
			version: 1,
			lint: { maxTokensPerFile: 5000 },
		});
		expect(config.lint.maxTokensPerFile).toBe(5000);
		expect(config.lint.overlapThreshold).toBe(0.3);
	});

	test("full config with all sections", () => {
		const config = ConfigSchema.parse({
			version: 1,
			model: "claude-opus-4-20250514",
			instructionGlobs: ["CLAUDE.md"],
			instructions: [{ path: "CLAUDE.md", harness: "claude-code" }],
			lint: { bloatThreshold: 0.6 },
			run: { timeout: 180, tokensBudget: 30_000 },
			harnesses: {
				"claude-code": { command: "claude", args: ["--print", "--dangerously-skip-permissions"] },
			},
		});
		expect(config.model).toBe("claude-opus-4-20250514");
		expect(config.run.timeout).toBe(180);
		expect(config.harnesses["claude-code"].args).toContain("--print");
	});
});
