import chalk from "chalk";
import type { LintResult } from "../lint/types.js";

export interface OutputFormatter {
	format(result: LintResult): string;
}

const SEVERITY_ICONS = {
	error: chalk.red("✗ error "),
	warning: chalk.yellow("⚠ warn  "),
	info: chalk.blue("ℹ info  "),
} as const;

function basename(path: string): string {
	return path.split("/").pop() ?? path;
}

export class ConsoleFormatter implements OutputFormatter {
	format(result: LintResult): string {
		const lines: string[] = [];

		if (result.diagnostics.length === 0) {
			lines.push(chalk.green("✓ No issues found"));
		} else {
			for (const d of result.diagnostics) {
				const icon = SEVERITY_ICONS[d.severity];
				const rule = chalk.dim(d.ruleId.padEnd(35));
				const file = chalk.cyan(basename(d.filePath));
				const lineRef = d.line ? chalk.dim(`:${d.line}`) : "";
				lines.push(`  ${icon} ${rule} ${file}${lineRef}  ${d.message}`);
			}
		}

		lines.push("");
		lines.push(chalk.dim("─".repeat(70)));

		const errors = result.diagnostics.filter((d) => d.severity === "error").length;
		const warnings = result.diagnostics.filter((d) => d.severity === "warning").length;
		const infos = result.diagnostics.filter((d) => d.severity === "info").length;

		const parts = [
			`${result.stats.filesAnalyzed} files analyzed`,
			`~${result.stats.totalTokens} tokens`,
		];

		if (errors > 0) parts.push(chalk.red(`${errors} error${errors > 1 ? "s" : ""}`));
		if (warnings > 0) parts.push(chalk.yellow(`${warnings} warning${warnings > 1 ? "s" : ""}`));
		if (infos > 0) parts.push(chalk.blue(`${infos} info`));

		lines.push(`  ${parts.join(" · ")} · ${Math.round(result.stats.duration)}ms`);

		return lines.join("\n");
	}
}
