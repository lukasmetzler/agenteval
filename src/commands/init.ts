import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import chalk from "chalk";
import type { Command } from "commander";
import { header } from "../output/terminal.js";

const CONFIG_FILENAME = "agenteval.yaml";

const TEMPLATE = `# agenteval configuration
# Full reference: https://github.com/lukasmetzler/agenteval/blob/main/docs/configuration.md
version: 1

# Which files to analyze. Patterns are relative to this file.
instructionGlobs:
  - "CLAUDE.md"
  - "AGENTS.md"
  - ".github/copilot-instructions.md"

# Model for context budget calculations
model: claude-sonnet-4-6

# Max fraction of the model's context window for instructions (0.0-1.0)
contextBudget: 0.3

# Lint settings
lint:
  maxTokensPerFile: 8000       # Warn if a single file exceeds this
  overlapThreshold: 0.3        # Flag sections with >30% content overlap
  bloatThreshold: 0.5          # Flag low information density

# Eval run settings
run:
  timeout: 300                 # Seconds per task
  resultsDir: ".agenteval/results"

# Harvest settings (mining git history)
harvest:
  outputDir: "tasks/harvested"
  minConfidence: 0.5           # Detection confidence threshold (0.0-1.0)
`;

export function registerInitCommand(program: Command): void {
	program
		.command("init")
		.description("Create a starter agenteval.yaml configuration file")
		.action(() => {
			const targetPath = join(process.cwd(), CONFIG_FILENAME);

			if (existsSync(targetPath)) {
				console.error(
					chalk.red("agenteval.yaml already exists. Delete it first to re-initialize."),
				);
				process.exit(1);
			}

			writeFileSync(targetPath, TEMPLATE, "utf-8");

			console.log(header("agenteval init"));
			console.log(`  Created ${chalk.green("agenteval.yaml")}`);
			console.log();
			console.log("  Next steps:");
			console.log(`    1. Run ${chalk.cyan("agenteval lint")} to check your instruction files`);
			console.log(`    2. Run ${chalk.cyan("agenteval harvest --dry-run")} to preview AI commits`);
			console.log(`    3. See ${chalk.cyan("docs/getting-started.md")} for the full walkthrough`);
			console.log();
		});
}
