#!/usr/bin/env bun
import chalk from "chalk";
import { Command } from "commander";
import { registerCompareCommand } from "./commands/compare.js";
import { registerHarvestCommand } from "./commands/harvest.js";
import { registerInitCommand } from "./commands/init.js";
import { registerLintCommand } from "./commands/lint.js";
import { registerResultsCommand } from "./commands/results.js";
import { registerRunCommand } from "./commands/run.js";
import { version } from "./version.js";

const program = new Command()
	.name("agenteval")
	.description("Evaluate AI coding instruction quality")
	.version(version);

registerInitCommand(program);
registerLintCommand(program);
registerRunCommand(program);
registerResultsCommand(program);
registerCompareCommand(program);
registerHarvestCommand(program);

try {
	await program.parseAsync(process.argv);
} catch (err) {
	const msg = err instanceof Error ? err.message : String(err);
	console.error(chalk.red(`\n  Error: ${msg}\n`));
	process.exit(2);
}
