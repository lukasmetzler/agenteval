import { resolve } from "node:path";
import type { Command } from "commander";
import { loadConfig } from "../config/loader.js";
import {
	compareResults,
	formatComparisonConsole,
	formatComparisonMarkdown,
} from "../store/compare.js";
import { readResult } from "../store/index.js";
import { logger } from "../utils/logger.js";

interface CompareOptions {
	format?: string;
	report?: boolean;
	config?: string;
}

export function registerCompareCommand(program: Command): void {
	program
		.command("compare <runA> <runB>")
		.description("Compare results between two eval runs")
		.option("-f, --format <type>", "output format: console, json, markdown", "console")
		.option("--report", "generate markdown report (alias for --format markdown)")
		.option("-c, --config <path>", "path to agenteval.yaml")
		.action((runA: string, runB: string, options: CompareOptions) => {
			try {
				const config = loadConfig(options.config);
				const resultsDir = resolve(process.cwd(), config.run.resultsDir);

				const resultA = readResult(runA, resultsDir);
				if (!resultA) {
					console.error(`Run not found: ${runA}`);
					process.exit(2);
				}

				const resultB = readResult(runB, resultsDir);
				if (!resultB) {
					console.error(`Run not found: ${runB}`);
					process.exit(2);
				}

				const report = compareResults(resultA, resultB);

				const format = options.report ? "markdown" : (options.format ?? "console");

				switch (format) {
					case "json":
						console.log(JSON.stringify(report, null, 2));
						break;
					case "markdown":
						console.log(formatComparisonMarkdown(report));
						break;
					default:
						console.log(formatComparisonConsole(report));
						break;
				}

				process.exit(0);
			} catch (err) {
				logger.error(err instanceof Error ? err.message : String(err));
				process.exit(2);
			}
		});
}
