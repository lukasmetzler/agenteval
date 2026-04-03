import chalk from "chalk";
import type { Diagnostic, LintResult } from "../lint/types.js";
import { basename } from "../utils/path.js";
import { padEnd, rule } from "./terminal.js";

export interface OutputFormatter {
	format(result: LintResult): string;
}

const SEVERITY_ICONS = {
	error: chalk.red("✗ error"),
	warning: chalk.yellow("⚠ warn "),
	info: chalk.blue("ℹ info "),
} as const;

/** Group diagnostics by file path */
function groupByFile(diagnostics: Diagnostic[]): Map<string, Diagnostic[]> {
	const groups = new Map<string, Diagnostic[]>();
	for (const d of diagnostics) {
		const existing = groups.get(d.filePath);
		if (existing) {
			existing.push(d);
		} else {
			groups.set(d.filePath, [d]);
		}
	}
	return groups;
}

function formatFileGroup(filePath: string, diagnostics: Diagnostic[]): string[] {
	const lines: string[] = [];
	const pipe = chalk.dim("│");
	const ruleWidth = 35;

	lines.push(`  ${chalk.cyan.bold(basename(filePath))}`);
	lines.push(`  ${pipe}`);

	for (const d of diagnostics) {
		const icon = SEVERITY_ICONS[d.severity];
		const ruleId = padEnd(chalk.dim(d.ruleId), ruleWidth);
		const lineRef = d.line ? chalk.dim(`:${d.line}`) : "";
		lines.push(`  ${pipe}  ${icon}  ${ruleId} ${lineRef}  ${d.message}`);
		if (d.suggestion) {
			lines.push(`  ${pipe}           ${chalk.dim(`→ ${d.suggestion}`)}`);
		}
		lines.push(`  ${pipe}`);
	}

	return lines;
}

function formatGuidance(errors: number, warnings: number): string {
	if (errors > 0) {
		return chalk.red.bold(
			"  Fix the errors above — they indicate broken references or contradictions that will confuse your AI agent.",
		);
	}
	if (warnings > 0) {
		return chalk.yellow(
			"  Warnings suggest improvements. Address high-impact ones (bloat, dead refs) first.",
		);
	}
	return chalk.green.bold("  All clear. Your instruction files look good.");
}

export class ConsoleFormatter implements OutputFormatter {
	format(result: LintResult): string {
		const lines: string[] = [];

		if (result.diagnostics.length === 0) {
			lines.push(`  ${chalk.green("✓ No issues found")}`);
		} else {
			const groups = groupByFile(result.diagnostics);
			for (const [filePath, diagnostics] of groups) {
				lines.push(...formatFileGroup(filePath, diagnostics));
			}
		}

		lines.push(rule(57));

		const errors = result.diagnostics.filter((d) => d.severity === "error").length;
		const warnings = result.diagnostics.filter((d) => d.severity === "warning").length;
		const infos = result.diagnostics.filter((d) => d.severity === "info").length;

		const parts = [`${result.stats.filesAnalyzed} files`, `~${result.stats.totalTokens} tokens`];

		if (errors > 0) parts.push(chalk.red(`${errors} error${errors > 1 ? "s" : ""}`));
		if (warnings > 0) parts.push(chalk.yellow(`${warnings} warning${warnings > 1 ? "s" : ""}`));
		if (infos > 0) parts.push(chalk.blue(`${infos} info`));

		lines.push(
			`  ${parts.join(chalk.dim(" · "))} ${chalk.dim("·")} ${chalk.dim(`${Math.round(result.stats.duration)}ms`)}`,
		);
		lines.push(formatGuidance(errors, warnings));

		return lines.join("\n");
	}
}
