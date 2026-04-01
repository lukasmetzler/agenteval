import type { Command } from "commander";

export function registerRunCommand(program: Command): void {
	program
		.command("run")
		.description("Run a task against current instructions and measure the outcome")
		.option("--task <task>", "task description or path to task YAML")
		.option("--harness <name>", "harness to use: claude-code, opencode, copilot")
		.option("--instructions <path>", "alternative instruction directory")
		.action(() => {
			console.log("agenteval run: not yet implemented (Phase 2)");
			process.exit(0);
		});
}
