import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { InstructionSet, RawRunResult, RunMetrics, TaskDefinition } from "../run/types.js";
import type { HarnessAdapter } from "./types.js";

export interface MockBehavior {
	filesToChange: Record<string, string>;
	exitCode: number;
	stdout: string;
	stderr?: string;
	durationMs: number;
	timedOut?: boolean;
	tokensTotal?: number;
}

/**
 * Mock harness adapter for testing.
 * Simulates agent behavior by writing files and returning configured output.
 * No real agent is spawned.
 */
export class MockAdapter implements HarnessAdapter {
	name = "mock";
	private behavior: MockBehavior;

	constructor(behavior: MockBehavior) {
		this.behavior = behavior;
	}

	async isAvailable(): Promise<boolean> {
		return true;
	}

	async injectInstructions(_worktreePath: string, _instructions: InstructionSet): Promise<void> {
		// Mock does nothing for instruction injection
	}

	async runTask(
		worktreePath: string,
		_task: TaskDefinition,
		_timeoutSeconds: number,
	): Promise<RawRunResult> {
		// Simulate agent changes by writing files
		for (const [relativePath, content] of Object.entries(this.behavior.filesToChange)) {
			const fullPath = join(worktreePath, relativePath);
			mkdirSync(dirname(fullPath), { recursive: true });
			writeFileSync(fullPath, content, "utf-8");
		}

		return {
			stdout: this.behavior.stdout,
			stderr: this.behavior.stderr ?? "",
			exitCode: this.behavior.exitCode,
			durationMs: this.behavior.durationMs,
			timedOut: this.behavior.timedOut ?? false,
		};
	}

	parseMetrics(_raw: RawRunResult): RunMetrics {
		if (this.behavior.tokensTotal !== undefined) {
			return {
				tokensInput: null,
				tokensOutput: null,
				tokensTotal: this.behavior.tokensTotal,
				tokenSource: "estimated",
			};
		}
		return {
			tokensInput: null,
			tokensOutput: null,
			tokensTotal: null,
			tokenSource: "unavailable",
		};
	}
}
