import { relative } from "node:path";
import { RULE_EXPLANATIONS } from "../lint/explanations.js";
import type { Diagnostic, LintResult, Severity } from "../lint/types.js";
import { version } from "../version.js";
import type { OutputFormatter } from "./formatter.js";

const SARIF_LEVEL: Record<Severity, "error" | "warning" | "note"> = {
	error: "error",
	warning: "warning",
	info: "note",
};

/** Diagnostics without a real file (e.g. "(all files)") are reported at the repo root. */
function artifactUri(d: Diagnostic, cwd: string): string | null {
	if (d.filePath.startsWith("(")) return null;
	return relative(cwd, d.filePath).split("\\").join("/");
}

/**
 * SARIF 2.1.0 for GitHub code scanning and other SARIF consumers
 * (upload with github/codeql-action/upload-sarif).
 */
export class SarifFormatter implements OutputFormatter {
	constructor(private readonly cwd: string = process.cwd()) {}

	format(result: LintResult): string {
		const ruleIds = [...new Set(result.diagnostics.map((d) => d.ruleId))].sort();
		const rules = ruleIds.map((id) => {
			const explanation = RULE_EXPLANATIONS[id];
			return {
				id,
				shortDescription: { text: explanation?.what ?? id },
				...(explanation ? { help: { text: `${explanation.why}\n\nFix: ${explanation.fix}` } } : {}),
			};
		});
		const results = result.diagnostics.map((d) => {
			const uri = artifactUri(d, this.cwd);
			return {
				ruleId: d.ruleId,
				ruleIndex: ruleIds.indexOf(d.ruleId),
				level: SARIF_LEVEL[d.severity],
				message: { text: d.suggestion ? `${d.message}. ${d.suggestion}` : d.message },
				locations: [
					{
						physicalLocation: {
							artifactLocation: { uri: uri ?? "." },
							...(uri && d.line ? { region: { startLine: d.line } } : {}),
						},
					},
				],
			};
		});
		return JSON.stringify(
			{
				$schema: "https://json.schemastore.org/sarif-2.1.0.json",
				version: "2.1.0",
				runs: [
					{
						tool: {
							driver: {
								name: "agenteval",
								version,
								informationUri: "https://github.com/lukasmetzler/agenteval",
								rules,
							},
						},
						results,
					},
				],
			},
			null,
			2,
		);
	}
}

const GITHUB_COMMAND: Record<Severity, "error" | "warning" | "notice"> = {
	error: "error",
	warning: "warning",
	info: "notice",
};

function escapeData(value: string): string {
	return value.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
}

function escapeProperty(value: string): string {
	return escapeData(value).replace(/:/g, "%3A").replace(/,/g, "%2C");
}

/** GitHub Actions workflow commands: inline annotations on the PR diff. */
export class GithubFormatter implements OutputFormatter {
	constructor(private readonly cwd: string = process.cwd()) {}

	format(result: LintResult): string {
		return result.diagnostics
			.map((d) => {
				const uri = artifactUri(d, this.cwd);
				const props = [
					uri ? `file=${escapeProperty(uri)}` : null,
					uri && d.line ? `line=${d.line}` : null,
					`title=${escapeProperty(d.ruleId)}`,
				].filter((p): p is string => p !== null);
				const message = d.suggestion ? `${d.message}. ${d.suggestion}` : d.message;
				return `::${GITHUB_COMMAND[d.severity]} ${props.join(",")}::${escapeData(message)}`;
			})
			.join("\n");
	}
}
