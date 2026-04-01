import type { Command } from "commander";

export function registerCompareCommand(program: Command): void {
	program
		.command("compare")
		.description("Compare results between instruction versions")
		.argument("[versions...]", "version identifiers to compare")
		.option("--metric <name>", "specific metric to compare")
		.option("--report", "generate markdown report")
		.action(() => {
			console.log("agenteval compare: not yet implemented (Phase 2)");
			process.exit(0);
		});
}
