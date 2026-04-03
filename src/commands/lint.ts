import type { Command } from "commander";
import { loadConfig } from "../config/loader.js";
import { runLint } from "../lint/index.js";
import type { Severity } from "../lint/types.js";
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
		.option("--fix", "auto-fix where possible")
		.option("--explain", "show detailed explanation for each rule triggered")
		.action(async (globs: string[], options: LintOptions) => {
			try {
				if (options.fix) {
					console.log("agenteval lint --fix: auto-fix not yet implemented");
				}

				const config = loadConfig(options.config);

				if (globs.length > 0) {
					config.instructionGlobs = globs;
				}

				if (options.quiet) {
					logger.level = "error";
				}

				const result = await runLint(config, process.cwd());

				const minSeverity = options.severity as Severity;
				const minOrder = SEVERITY_ORDER[minSeverity] ?? 0;
				result.diagnostics = result.diagnostics.filter(
					(d) => SEVERITY_ORDER[d.severity] >= minOrder,
				);

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
