import chalk from "chalk";
import type { Diagnostic, LintResult } from "../lint/types.js";
import { basename } from "../utils/path.js";

export interface OutputFormatter {
	format(result: LintResult): string;
}

const SEVERITY_ICONS = {
	error: chalk.red("✗ error "),
	warning: chalk.yellow("⚠ warn  "),
	info: chalk.blue("ℹ info  "),
} as const;

function formatDiagnosticLines(diagnostics: Diagnostic[]): string[] {
	const lines: string[] = [];
	for (const d of diagnostics) {
		const icon = SEVERITY_ICONS[d.severity];
		const rule = chalk.dim(d.ruleId.padEnd(35));
		const file = chalk.cyan(basename(d.filePath));
		const lineRef = d.line ? chalk.dim(`:${d.line}`) : "";
		lines.push(`  ${icon} ${rule} ${file}${lineRef}  ${d.message}`);
		if (d.suggestion) {
			lines.push(chalk.dim(`         → ${d.suggestion}`));
		}
	}
	return lines;
}

function formatGuidance(errors: number, warnings: number): string {
	if (errors > 0) {
		return chalk.red.bold(
			"Fix the errors above — they indicate broken references or contradictions that will confuse your AI agent.",
		);
	}
	if (warnings > 0) {
		return chalk.yellow(
			"Warnings suggest improvements. Address high-impact ones (bloat, dead refs) first.",
		);
	}
	return chalk.green.bold("All clear. Your instruction files look good.");
}

export class ConsoleFormatter implements OutputFormatter {
	format(result: LintResult): string {
		const lines: string[] = [];

		if (result.diagnostics.length === 0) {
			lines.push(chalk.green("✓ No issues found"));
		} else {
			lines.push(...formatDiagnosticLines(result.diagnostics));
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
		lines.push(formatGuidance(errors, warnings));

		return lines.join("\n");
	}
}
