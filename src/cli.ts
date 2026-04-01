#!/usr/bin/env bun
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Command } from "commander";
import { registerCompareCommand } from "./commands/compare.js";
import { registerHarvestCommand } from "./commands/harvest.js";
import { registerLintCommand } from "./commands/lint.js";
import { registerResultsCommand } from "./commands/results.js";
import { registerRunCommand } from "./commands/run.js";

const version = readFileSync(join(import.meta.dir, "../VERSION"), "utf-8").trim();

const program = new Command()
	.name("agenteval")
	.description("Evaluate AI coding instruction quality")
	.version(version);

registerLintCommand(program);
registerRunCommand(program);
registerResultsCommand(program);
registerCompareCommand(program);
registerHarvestCommand(program);

program.parse();
