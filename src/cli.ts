#!/usr/bin/env bun
import { Command } from "commander";
import { registerCompareCommand } from "./commands/compare.js";
import { registerHarvestCommand } from "./commands/harvest.js";
import { registerLintCommand } from "./commands/lint.js";
import { registerResultsCommand } from "./commands/results.js";
import { registerRunCommand } from "./commands/run.js";

const program = new Command()
	.name("agenteval")
	.description("Evaluate AI coding instruction quality")
	.version("0.0.1");

registerLintCommand(program);
registerRunCommand(program);
registerResultsCommand(program);
registerCompareCommand(program);
registerHarvestCommand(program);

program.parse();
