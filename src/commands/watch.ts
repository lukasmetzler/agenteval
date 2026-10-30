import { existsSync, watch } from "node:fs";
import { relative, resolve } from "node:path";
import chalk from "chalk";
import type { Command } from "commander";
import { minimatch } from "minimatch";
import { loadConfig } from "../config/loader.js";
import { runLint } from "../lint/index.js";
import type { Severity } from "../lint/types.js";
import { ConsoleFormatter } from "../output/formatter.js";
import { DEFAULT_IGNORE, resolveInstructionFiles } from "../utils/glob.js";

const SEVERITY_ORDER: Record<Severity, number> = { info: 0, warning: 1, error: 2 };
const DEBOUNCE_MS = 300;
const POLL_MS = 2_000;

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
			const files = await resolveInstructionFiles(config.instructionGlobs, cwd, config.lint.ignore);

			if (files.length === 0) {
				console.error(chalk.red("  No instruction files found to watch."));
				process.exit(2);
			}

			console.log(
				chalk.dim(
					`  Watching ${files.length} file${files.length !== 1 ? "s" : ""} for changes (new files included)...\n`,
				),
			);

			// Initial lint run
			await runAndPrint(config, cwd, options);

			// One recursive watcher on the project, filtered by the instruction globs,
			// so files created after startup are picked up too.
			const ignore = [...DEFAULT_IGNORE, ...config.lint.ignore];
			const isInstructionFile = (rel: string) =>
				config.instructionGlobs.some((g) => minimatch(rel, g, { dot: true })) &&
				!ignore.some((g) => minimatch(rel, g, { dot: true }));

			let debounceTimer: ReturnType<typeof setTimeout> | null = null;
			const relint = (what: string, rel: string) => {
				if (debounceTimer) clearTimeout(debounceTimer);
				debounceTimer = setTimeout(async () => {
					console.log(chalk.dim(`\n  ${what}: ${rel}`));
					console.log(chalk.dim("  ─".repeat(35)));
					await runAndPrint(config, cwd, options);
				}, DEBOUNCE_MS);
			};

			const watcher = watch(cwd, { recursive: true }, (_event, filename) => {
				if (!filename) return;
				const rel = filename.toString().split("\\").join("/");
				if (!isInstructionFile(rel)) return;
				relint(existsSync(resolve(cwd, rel)) ? "Change detected" : "File removed", rel);
			});

			// Some Bun versions (1.3.x) don't watch directories created after
			// startup, so also re-resolve the globs periodically to catch new files.
			let known = new Set(files);
			const poll = setInterval(async () => {
				const current = await resolveInstructionFiles(
					config.instructionGlobs,
					cwd,
					config.lint.ignore,
				);
				const added = current.filter((f) => !known.has(f));
				const removed = [...known].filter((f) => !current.includes(f));
				known = new Set(current);
				const changed = added[0] ?? removed[0];
				if (changed) relint(added[0] ? "New file" : "File removed", relative(cwd, changed));
			}, POLL_MS);

			// Keep process alive, clean up on exit
			process.on("SIGINT", () => {
				if (debounceTimer) clearTimeout(debounceTimer);
				clearInterval(poll);
				watcher.close();
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
