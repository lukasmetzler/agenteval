import { watch } from "node:fs";
import { resolve } from "node:path";
import chalk from "chalk";
import type { Command } from "commander";
import { loadConfig } from "../config/loader.js";
import { runLint } from "../lint/index.js";
import type { Severity } from "../lint/types.js";
import { ConsoleFormatter } from "../output/formatter.js";
import { resolveInstructionFiles } from "../utils/glob.js";

const SEVERITY_ORDER: Record<Severity, number> = { info: 0, warning: 1, error: 2 };
const DEBOUNCE_MS = 300;

interface WatchOptions {
	config?: string;
	severity: string;
	explain?: boolean;
}

export function registerWatchCommand(program: Command): void {
	program
		.command("watch")
		.description("Watch instruction files and re-lint on changes")
		.argument("[globs...]", "glob patterns for instruction files")
		.option("-c, --config <path>", "path to agenteval.yaml")
		.option("--severity <level>", "minimum severity: info, warning, error", "info")
		.option("--explain", "show detailed explanation for each rule triggered")
		.action(async (globs: string[], options: WatchOptions) => {
			const config = loadConfig(options.config);

			if (globs.length > 0) {
				config.instructionGlobs = globs;
			}

			const cwd = process.cwd();
			const files = await resolveInstructionFiles(config.instructionGlobs, cwd);

			if (files.length === 0) {
				console.error(chalk.red("  No instruction files found to watch."));
				process.exit(2);
			}

			console.log(
				chalk.dim(
					`  Watching ${files.length} file${files.length !== 1 ? "s" : ""} for changes...\n`,
				),
			);

			// Initial lint run
			await runAndPrint(config, cwd, options);

			// Watch each file
			let debounceTimer: ReturnType<typeof setTimeout> | null = null;
			const watchers: ReturnType<typeof watch>[] = [];

			for (const file of files) {
				const fullPath = resolve(cwd, file);
				try {
					const watcher = watch(fullPath, () => {
						if (debounceTimer) clearTimeout(debounceTimer);
						debounceTimer = setTimeout(async () => {
							console.log(chalk.dim(`\n  Change detected: ${file}`));
							console.log(chalk.dim("  ─".repeat(35)));
							await runAndPrint(config, cwd, options);
						}, DEBOUNCE_MS);
					});
					watchers.push(watcher);
				} catch {
					// File may not exist yet (glob matched but deleted)
				}
			}

			// Keep process alive, clean up on exit
			process.on("SIGINT", () => {
				for (const w of watchers) w.close();
				console.log(chalk.dim("\n  Stopped watching."));
				process.exit(0);
			});
		});
}

async function runAndPrint(
	config: ReturnType<typeof loadConfig>,
	cwd: string,
	options: WatchOptions,
): Promise<void> {
	try {
		const result = await runLint(config, cwd);

		const minSeverity = options.severity as Severity;
		const minOrder = SEVERITY_ORDER[minSeverity] ?? 0;
		result.diagnostics = result.diagnostics.filter((d) => SEVERITY_ORDER[d.severity] >= minOrder);

		const formatter = new ConsoleFormatter({ explain: options.explain });
		console.log(formatter.format(result));

		const errors = result.diagnostics.filter((d) => d.severity === "error").length;
		const warnings = result.diagnostics.filter((d) => d.severity === "warning").length;

		if (errors > 0) {
			console.log(chalk.red(`  ${errors} error${errors !== 1 ? "s" : ""}`));
		} else if (warnings > 0) {
			console.log(chalk.yellow(`  ${warnings} warning${warnings !== 1 ? "s" : ""}, 0 errors`));
		} else {
			console.log(chalk.green("  Clean."));
		}
	} catch (err) {
		console.error(chalk.red(`  ${err instanceof Error ? err.message : String(err)}`));
	}
}
