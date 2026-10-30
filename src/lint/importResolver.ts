import { MAX_IMPORT_DEPTH, resolveImportGraph } from "../markdown/imports.js";
import { displayPath } from "../utils/path.js";
import type { Diagnostic, LintContext, LintRule, ParsedFile } from "./types.js";

/** File kinds whose @path references the agent expands inline. */
export function importRoots(files: ParsedFile[]): ParsedFile[] {
	return files.filter((f) => f.kind === "instruction" || f.kind === "claude-rule");
}

export class ImportResolverRule implements LintRule {
	id = "import";

	async run(ctx: LintContext): Promise<Diagnostic[]> {
		const { issues } = resolveImportGraph(importRoots(ctx.files));
		return issues.map((issue): Diagnostic => {
			const base = {
				filePath: issue.from,
				line: issue.ref.line,
				meta: { resolved: issue.resolved },
			};
			switch (issue.kind) {
				case "missing":
					return {
						...base,
						ruleId: "import/missing",
						severity: "error",
						message: `Imported file "@${issue.ref.path}" does not exist`,
						suggestion:
							"Fix the path (it resolves relative to the importing file) or remove the import",
					};
				case "cycle":
					return {
						...base,
						ruleId: "import/cycle",
						severity: "warning",
						message: `Import "@${issue.ref.path}" creates a cycle back to ${displayPath(issue.resolved, ctx.cwd)}`,
					};
				case "too-deep":
					return {
						...base,
						ruleId: "import/too-deep",
						severity: "warning",
						message: `Import "@${issue.ref.path}" is more than ${MAX_IMPORT_DEPTH} hops deep. Claude Code stops following imports there.`,
					};
				default: {
					const _exhaustive: never = issue;
					return _exhaustive;
				}
			}
		});
	}
}
