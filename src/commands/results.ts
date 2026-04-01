import type { Command } from "commander";

export function registerResultsCommand(program: Command): void {
	program
		.command("results")
		.description("View and manage eval run results")
		.option("--trend", "show performance over time")
		.option("--export <format>", "export format: json, markdown")
		.option("--prune", "remove results older than retention period")
		.action(() => {
			console.log("agenteval results: not yet implemented (Phase 2)");
			process.exit(0);
		});
}
