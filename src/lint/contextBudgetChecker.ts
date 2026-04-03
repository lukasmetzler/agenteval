import { getModelContextWindow } from "../config/schema.js";
import type { Diagnostic, LintContext, LintRule } from "./types.js";

export class ContextBudgetCheckerRule implements LintRule {
	id = "context-budget";

	async run(ctx: LintContext): Promise<Diagnostic[]> {
		const diagnostics: Diagnostic[] = [];

		const totalTokens = ctx.files.reduce((sum, f) => sum + f.tokens, 0);
		const modelWindow = getModelContextWindow(ctx.config.model);
		const budgetTokens =
			ctx.config.lint.maxTotalTokens ?? Math.floor(modelWindow * ctx.config.contextBudget);

		const ratio = totalTokens / budgetTokens;

		if (totalTokens > budgetTokens) {
			diagnostics.push({
				ruleId: "context-budget/exceeded",
				severity: "error",
				message: `Total instruction tokens (~${totalTokens}) exceed budget of ${budgetTokens} (${ctx.config.contextBudget * 100}% of ${modelWindow} context window)`,
				filePath: "(all files)",
				meta: { totalTokens, budgetTokens, modelWindow, ratio },
				suggestion: "Remove low-value content or increase contextBudget in config",
			});
		} else if (ratio > 0.8) {
			diagnostics.push({
				ruleId: "context-budget/near-limit",
				severity: "warning",
				message: `Total instruction tokens (~${totalTokens}) are at ${Math.round(ratio * 100)}% of budget (${budgetTokens})`,
				filePath: "(all files)",
				meta: { totalTokens, budgetTokens, modelWindow, ratio },
				suggestion: "Consider trimming before adding more instructions",
			});
		}

		return diagnostics;
	}
}
