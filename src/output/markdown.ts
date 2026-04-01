import type { Diagnostic, LintResult, Severity } from "../lint/types.js";
import type { OutputFormatter } from "./formatter.js";

function basename(path: string): string {
	return path.split("/").pop() ?? path;
}

function formatDiagnosticLine(d: Diagnostic): string {
	return `- **${d.ruleId}** in \`${basename(d.filePath)}\`${d.line ? `:${d.line}` : ""} — ${d.message}`;
}

function renderSection(title: string, diagnostics: Diagnostic[]): string[] {
	if (diagnostics.length === 0) return [];
	return [`## ${title} (${diagnostics.length})`, "", ...diagnostics.map(formatDiagnosticLine), ""];
}

function groupBySeverity(diagnostics: Diagnostic[]): Record<Severity, Diagnostic[]> {
	return {
		error: diagnostics.filter((d) => d.severity === "error"),
		warning: diagnostics.filter((d) => d.severity === "warning"),
		info: diagnostics.filter((d) => d.severity === "info"),
	};
}

export class MarkdownFormatter implements OutputFormatter {
	format(result: LintResult): string {
		const lines: string[] = [
			"# agenteval Lint Report",
			"",
			`**${result.stats.filesAnalyzed}** files analyzed · **~${result.stats.totalTokens}** tokens · **${Math.round(result.stats.duration)}ms**`,
			"",
		];

		if (result.diagnostics.length === 0) {
			lines.push("No issues found.");
			return lines.join("\n");
		}

		const grouped = groupBySeverity(result.diagnostics);
		lines.push(...renderSection("Errors", grouped.error));
		lines.push(...renderSection("Warnings", grouped.warning));
		lines.push(...renderSection("Info", grouped.info));

		return lines.join("\n");
	}
}
