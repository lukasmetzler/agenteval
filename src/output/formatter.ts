import chalk from "chalk";
import type { Diagnostic, LintResult } from "../lint/types.js";
import { basename } from "../utils/path.js";
import { rule } from "./terminal.js";

export interface OutputFormatter {
	format(result: LintResult): string;
}

const SEVERITY_ICONS = {
	error: chalk.red.bold(" ERROR "),
	warning: chalk.yellow(" WARN  "),
	info: chalk.blue(" info  "),
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

	lines.push("");
	lines.push(`  ${chalk.cyan.underline(basename(filePath))}`);

	for (const d of diagnostics) {
		const icon = SEVERITY_ICONS[d.severity];
		const lineRef = d.line ? chalk.dim(`line ${d.line}`) : "";
		const ruleTag = chalk.dim(`(${d.ruleId})`);
		lines.push(`    ${icon} ${d.message}  ${ruleTag}`);
		if (d.line) {
			lines.push(`           ${lineRef}`);
		}
		if (d.suggestion) {
			lines.push(`           ${chalk.green("→")} ${chalk.dim(d.suggestion)}`);
		}
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

		const errors = result.diagnostics.filter((d) => d.severity === "error").length;
		const warnings = result.diagnostics.filter((d) => d.severity === "warning").length;
		const infos = result.diagnostics.filter((d) => d.severity === "info").length;
		const total = errors + warnings + infos;

		// Header
		lines.push("");
		const titleParts = [
			chalk.bold("agenteval lint"),
			chalk.dim(`${result.stats.filesAnalyzed} files`),
			chalk.dim(`~${result.stats.totalTokens} tokens`),
			chalk.dim(`${Math.round(result.stats.duration)}ms`),
		];
		lines.push(`  ${titleParts.join(chalk.dim("  ·  "))}`);
		lines.push(rule(70));

		if (total === 0) {
			lines.push("");
			lines.push(`  ${chalk.green("✓")} ${chalk.green.bold("No issues found")}`);
		} else {
			const groups = groupByFile(result.diagnostics);
			for (const [filePath, diagnostics] of groups) {
				lines.push(...formatFileGroup(filePath, diagnostics));
			}
		}

		// Footer
		lines.push("");
		lines.push(rule(70));
		const countParts: string[] = [];
		if (errors > 0) countParts.push(chalk.red.bold(`${errors} error${errors > 1 ? "s" : ""}`));
		if (warnings > 0)
			countParts.push(chalk.yellow(`${warnings} warning${warnings > 1 ? "s" : ""}`));
		if (infos > 0) countParts.push(chalk.blue(`${infos} info`));
		if (countParts.length > 0) {
			lines.push(`  ${countParts.join(chalk.dim("  ·  "))}`);
		}
		lines.push(formatGuidance(errors, warnings));

		return lines.join("\n");
	}
}
