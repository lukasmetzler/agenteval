import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Config } from "../config/schema.js";
import { ClaudeCodeAdapter } from "./claude-code.js";
import { GenericAdapter } from "./generic.js";
import { MockAdapter } from "./mock.js";
import type { HarnessAdapter } from "./types.js";

const HARNESS_FILE_MAP: Record<string, string> = {
	"claude-code": "CLAUDE.md",
	opencode: "AGENTS.md",
	copilot: ".github/copilot-instructions.md",
};

/**
 * Get a harness adapter by name.
 * Supports: "claude-code", "generic", "mock", or any key in config.harnesses.
 */
export function getAdapter(name: string, config: Config): HarnessAdapter {
	switch (name) {
		case "claude-code":
			return new ClaudeCodeAdapter();
		case "mock":
			return new MockAdapter({
				filesToChange: {},
				exitCode: 0,
				stdout: "",
				durationMs: 100,
			});
		default: {
			const harnessConfig = config.harnesses[name];
			if (harnessConfig) {
				return new GenericAdapter({
					command: harnessConfig.command,
					args: harnessConfig.args,
					instructionPath: harnessConfig.instructionPath ?? "AGENTS.md",
				});
			}
			throw new Error(
				`Unknown harness: "${name}". Built-in: claude-code, generic, mock. Or define a custom one in agenteval.yaml:\n\n  harnesses:\n    ${name}:\n      command: "your-tool"\n      args: ["--run"]`,
			);
		}
	}
}

/**
 * Auto-detect harness from instruction files present in the working directory.
 * Returns the harness name or throws if ambiguous.
 */
export function detectHarness(cwd: string): string {
	const detected: string[] = [];

	for (const [harness, file] of Object.entries(HARNESS_FILE_MAP)) {
		if (existsSync(join(cwd, file))) {
			detected.push(harness);
		}
	}

	if (detected.length === 0) {
		throw new Error(
			"No instruction files found. Cannot auto-detect harness. Use --harness to specify.",
		);
	}

	if (detected.length > 1) {
		throw new Error(
			`Multiple instruction files found (${detected.join(", ")}). Use --harness to specify which one.`,
		);
	}

	return detected[0];
}
