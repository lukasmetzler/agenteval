import type { Command } from "commander";

export function registerHarvestCommand(program: Command): void {
	program
		.command("harvest")
		.description("Mine git history for AI-involved PRs to build eval datasets")
		.option("--since <date>", "only scan commits after this date")
		.action(() => {
			console.log("agenteval harvest: not yet implemented (Phase 3)");
			process.exit(0);
		});
}
