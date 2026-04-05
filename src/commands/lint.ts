import chalk from "chalk";
import type { Command } from "commander";
import { loadConfig } from "../config/loader.js";
import type { Config } from "../config/schema.js";
import { applyFixes } from "../lint/fixer.js";
import { runLint } from "../lint/index.js";
import type { LintResult, Severity } from "../lint/types.js";
import { ConsoleFormatter } from "../output/formatter.js";
import { JsonFormatter } from "../output/json.js";
import { MarkdownFormatter } from "../output/markdown.js";
import { logger } from "../utils/logger.js";

const SEVERITY_ORDER: Record<Severity, number> = { info: 0, warning: 1, error: 2 };

interface LintOptions {
	config?: string;
	format: string;
	severity: string;
	quiet?: boolean;
	fix?: boolean;
	explain?: boolean;
}

export function registerLintCommand(program: Command): void {
	program
		.command("lint")
		.description("Analyze instruction files for quality issues")
		.argument("[globs...]", "glob patterns for instruction files")
		.option("-c, --config <path>", "path to agenteval.yaml")
		.option("-f, --format <type>", "output format: console, json, markdown", "console")
		.option("--severity <level>", "minimum severity: info, warning, error", "info")
		.option("--quiet", "only show errors")
		.option("--fix", "auto-fix filler phrases and simple issues")
		.option("--explain", "show detailed explanation for each rule triggered")
		.action(async (globs: string[], options: LintOptions) => {
			try {
				const config = loadConfig(options.config);
				if (globs.length > 0) config.instructionGlobs = globs;
				if (options.quiet) logger.level = "error";

				let result = await runLint(config, process.cwd());

				if (options.fix) {
					result = await runFixAndRelint(result, config);
				}

				result.diagnostics = filterBySeverity(result.diagnostics, options.severity as Severity);

				const formatter = createFormatter(options.format, options.explain);
				console.log(formatter.format(result));

				const hasErrors = result.diagnostics.some((d) => d.severity === "error");
				process.exit(hasErrors ? 1 : 0);
			} catch (err) {
				logger.error(err instanceof Error ? err.message : String(err));
				process.exit(2);
			}
		});
}

async function runFixAndRelint(result: LintResult, config: Config): Promise<LintResult> {
	const files = [...new Set(result.diagnostics.map((d) => d.filePath))];
	let totalFixes = 0;

	for (const file of files) {
		const fileDiags = result.diagnostics.filter((d) => d.filePath === file);
		const fixResult = applyFixes(file, fileDiags);
		if (fixResult.written) {
			console.log(chalk.green(`  Fixed ${fixResult.fixesApplied} issue(s) in ${file}`));
			totalFixes += fixResult.fixesApplied;
		}
	}

	if (totalFixes > 0) {
		console.log(chalk.green(`\n  ${totalFixes} fix(es) applied. Re-running lint...\n`));
		return runLint(config, process.cwd());
	}

	return result;
}

function filterBySeverity(diagnostics: LintResult["diagnostics"], minSeverity: Severity) {
	const minOrder = SEVERITY_ORDER[minSeverity] ?? 0;
	return diagnostics.filter((d) => SEVERITY_ORDER[d.severity] >= minOrder);
}

function createFormatter(format: string, explain?: boolean) {
	switch (format) {
		case "json":
			return new JsonFormatter();
		case "markdown":
		case "md":
			return new MarkdownFormatter();
		case "console":
			return new ConsoleFormatter({ explain });
		default:
			logger.error(`Unknown format "${format}". Valid formats: console, json, markdown`);
			process.exit(2);
	}
}
