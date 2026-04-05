import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import chalk from "chalk";
import type { Command } from "commander";
import { header } from "../output/terminal.js";

const CONFIG_FILENAME = "agenteval.yaml";

const TEMPLATE = `# yaml-language-server: $schema=https://raw.githubusercontent.com/lukasmetzler/agenteval/main/schema.json
# agenteval configuration
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

# CI regression detection (agenteval ci)
ci:
  tasksDir: "tasks/harvested"  # Directory with task YAML files
  minScore: 0.5                # Fail if any task scores below this (0.0-1.0)
  maxRegression: 0.1           # Fail if score drops more than this vs previous run
  instructions: "CLAUDE.md"    # Instruction file to evaluate

# Live review rubrics (agenteval harvest --live)
liveReview:
  rubrics:
    scopeDiscipline:
      enabled: true
      weight: 1.0
    testCoverage:
      enabled: true
      weight: 1.0
    diffHygiene:
      enabled: true
      weight: 1.0
    conventionCompliance:        # LLM-assisted (requires --analyze)
      enabled: true
      weight: 1.0
    progressiveDisclosure:       # LLM-assisted (requires --analyze)
      enabled: true
      weight: 1.0
`;

const PRE_COMMIT_HOOK = `#!/bin/sh
# agenteval pre-commit hook — lint instruction files before committing
# Installed by: agenteval init --hook

# Only run if instruction files are staged
STAGED=$(git diff --cached --name-only --diff-filter=ACM | grep -E '(CLAUDE|AGENTS|copilot-instructions|SKILL|cursorrules)\\.m?d?c?$' || true)

if [ -n "$STAGED" ]; then
  echo "agenteval: linting instruction files..."
  agenteval lint --severity error
  if [ $? -ne 0 ]; then
    echo ""
    echo "agenteval: lint errors found. Fix them or commit with --no-verify to skip."
    exit 1
  fi
fi
`;

interface InitOptions {
	hook?: boolean;
}

export function registerInitCommand(program: Command): void {
	program
		.command("init")
		.description("Create a starter agenteval.yaml configuration file")
		.option("--hook", "install a git pre-commit hook that lints on commit")
		.action((options: InitOptions) => {
			const cwd = process.cwd();
			console.log(header("agenteval init"));

			// Create config
			createConfig(cwd);

			// Install hook if requested
			if (options.hook) {
				installHook(cwd);
			}

			console.log();
			console.log("  Next steps:");
			console.log(`    1. Run ${chalk.cyan("agenteval lint")} to check your instruction files`);
			console.log(`    2. Run ${chalk.cyan("agenteval harvest --dry-run")} to preview AI commits`);
			if (!options.hook) {
				console.log(
					`    3. Run ${chalk.cyan("agenteval init --hook")} to add a pre-commit lint hook`,
				);
			}
			console.log();
		});
}

function createConfig(cwd: string): void {
	const targetPath = join(cwd, CONFIG_FILENAME);

	if (existsSync(targetPath)) {
		console.log(`  ${chalk.dim("agenteval.yaml already exists, skipping")}`);
		return;
	}

	writeFileSync(targetPath, TEMPLATE, "utf-8");
	console.log(`  Created ${chalk.green("agenteval.yaml")}`);
}

function installHook(cwd: string): void {
	const hooksDir = join(cwd, ".git", "hooks");

	if (!existsSync(join(cwd, ".git"))) {
		console.log(`  ${chalk.yellow("Not a git repo, skipping hook installation")}`);
		return;
	}

	mkdirSync(hooksDir, { recursive: true });
	const hookPath = join(hooksDir, "pre-commit");

	if (existsSync(hookPath)) {
		const existing = readFileSync(hookPath, "utf-8");
		if (existing.includes("agenteval")) {
			console.log(`  ${chalk.dim("Pre-commit hook already installed")}`);
			return;
		}
		// Append to existing hook
		writeFileSync(hookPath, `${existing}\n${PRE_COMMIT_HOOK}`, "utf-8");
		console.log(`  Appended agenteval lint to existing ${chalk.green("pre-commit hook")}`);
	} else {
		writeFileSync(hookPath, PRE_COMMIT_HOOK, { mode: 0o755 });
		console.log(`  Installed ${chalk.green("pre-commit hook")} (.git/hooks/pre-commit)`);
	}
}
