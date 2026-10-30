import { getModelContextWindow } from "../config/schema.js";
import { isLoadedAtStartup } from "../markdown/classify.js";
import { resolveImportGraph } from "../markdown/imports.js";
import { importRoots } from "./importResolver.js";
import { countTokens } from "./tokenCounter.js";
import type { Diagnostic, LintContext, LintRule } from "./types.js";

export class ContextBudgetCheckerRule implements LintRule {
	id = "context-budget";

	async run(ctx: LintContext): Promise<Diagnostic[]> {
		const diagnostics: Diagnostic[] = [];

		const startup = ctx.files.filter((f) => isLoadedAtStartup(f, ctx.cwd));
		const startupPaths = new Set(startup.map((f) => f.path));
		const { imported } = resolveImportGraph(importRoots(startup));
		let importedTokens = 0;
		for (const [path, content] of imported) {
			if (!startupPaths.has(path)) importedTokens += countTokens(content);
		}
		const totalTokens = startup.reduce((sum, f) => sum + f.tokens, 0) + importedTokens;
		const modelWindow = getModelContextWindow(ctx.config.model);
		const budgetTokens =
			ctx.config.lint.maxTotalTokens ?? Math.floor(modelWindow * ctx.config.contextBudget);

		const ratio = totalTokens / budgetTokens;

		if (totalTokens > budgetTokens) {
			diagnostics.push({
				ruleId: "context-budget/exceeded",
				severity: "error",
				message: `Startup instruction tokens (~${totalTokens}, incl. @imports) exceed budget of ${budgetTokens} (${ctx.config.contextBudget * 100}% of ${modelWindow} context window)`,
				filePath: "(all files)",
				meta: { totalTokens, importedTokens, budgetTokens, modelWindow, ratio },
				suggestion: "Remove low-value content or increase contextBudget in config",
			});
		} else if (ratio > 0.8) {
			diagnostics.push({
				ruleId: "context-budget/near-limit",
				severity: "warning",
				message: `Startup instruction tokens (~${totalTokens}, incl. @imports) are at ${Math.round(ratio * 100)}% of budget (${budgetTokens})`,
				filePath: "(all files)",
				meta: { totalTokens, importedTokens, budgetTokens, modelWindow, ratio },
				suggestion: "Consider trimming before adding more instructions",
			});
		}

		return diagnostics;
	}
}
