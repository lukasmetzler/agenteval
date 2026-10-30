import type { RawRunResult, RunMetrics, TaskDefinition } from "../run/types.js";
import { parseClaudeResult, unavailableMetrics } from "./jsonl.js";
import { commandExists, copyInstructions, spawnAgent } from "./spawn.js";
import type { HarnessAdapter } from "./types.js";

interface GenericAdapterConfig {
	command: string;
	args: string[];
	instructionPath: string;
}

const TOKEN_PATTERNS = [
	/total[_ ]tokens?[:\s]+(\d[\d,]*)/i,
	/tokens?[_ ]used[:\s]+(\d[\d,]*)/i,
	/token[_ ]count[:\s]+(\d[\d,]*)/i,
];

/** Any CLI configured under `harnesses:` in agenteval.yaml. The prompt is the last argument. */
export class GenericAdapter implements HarnessAdapter {
	name = "generic";
	readonly instructionTarget: string;
	private config: GenericAdapterConfig;

	constructor(config: GenericAdapterConfig) {
		this.config = config;
		this.instructionTarget = config.instructionPath;
	}

	async isAvailable(): Promise<boolean> {
		return commandExists(this.config.command);
	}

	async injectInstructions(worktreePath: string, sourcePath: string): Promise<void> {
		copyInstructions(worktreePath, sourcePath, this.instructionTarget);
	}

	async runTask(
		worktreePath: string,
		task: TaskDefinition,
		timeoutSeconds: number,
	): Promise<RawRunResult> {
		return spawnAgent({
			command: [this.config.command, ...this.config.args, task.prompt],
			cwd: worktreePath,
			timeoutSeconds,
		});
	}

	parseMetrics(raw: RawRunResult): RunMetrics {
		// CLIs that emit a Claude-Code-style result event get exact numbers.
		const structured = parseClaudeResult(raw.stdout);
		if (structured.tokenSource === "api") return structured;

		const combined = `${raw.stdout}\n${raw.stderr}`;
		for (const pattern of TOKEN_PATTERNS) {
			const match = pattern.exec(combined);
			if (match?.[1]) {
				return {
					...unavailableMetrics(),
					tokensTotal: Number.parseInt(match[1].replace(/,/g, ""), 10),
					tokenSource: "estimated",
				};
			}
		}
		return unavailableMetrics();
	}
}
