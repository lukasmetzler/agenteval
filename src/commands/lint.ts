import type { Command } from "commander";

export function registerLintCommand(program: Command): void {
	program
		.command("lint")
		.description("Analyze instruction files for quality issues")
		.argument("[globs...]", "glob patterns for instruction files")
		.option("-c, --config <path>", "path to agenteval.yaml")
		.option("-f, --format <type>", "output format: console, json, markdown", "console")
		.option("--severity <level>", "minimum severity: info, warning, error", "info")
		.option("--quiet", "only show errors")
		.option("--fix", "auto-fix where possible")
		.action((_globs, _options) => {
			console.log("agenteval lint: not yet implemented");
			process.exit(0);
		});
}
