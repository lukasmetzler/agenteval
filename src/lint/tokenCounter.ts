import { getEncoding } from "js-tiktoken";
import type { Diagnostic, LintContext, LintRule } from "./types.js";

const enc = getEncoding("cl100k_base");

/**
 * Count tokens using cl100k_base (OpenAI's tokenizer).
 * Results are approximate (~10-15% variance from Claude's actual counts).
 */
export function countTokens(text: string): number {
	if (!text) return 0;
	return enc.encode(text).length;
}

export class TokenCounterRule implements LintRule {
	id = "token-count";

	async run(ctx: LintContext): Promise<Diagnostic[]> {
		const diagnostics: Diagnostic[] = [];
		const maxPerFile = ctx.config.lint.maxTokensPerFile;

		for (const file of ctx.files) {
			if (file.tokens > maxPerFile) {
				diagnostics.push({
					ruleId: "token-count/file-too-large",
					severity: "warning",
					message: `~${file.tokens} tokens exceeds limit of ${maxPerFile}`,
					filePath: file.path,
					meta: { tokens: file.tokens, limit: maxPerFile },
					suggestion: "Split into multiple instruction files or remove low-value sections",
				});
			}

			for (const section of file.sections) {
				if (file.sections.length > 1 && file.tokens > 0 && section.tokens / file.tokens > 0.4) {
					diagnostics.push({
						ruleId: "token-count/section-heavy",
						severity: "info",
						message: `Section "${section.heading}" uses ~${section.tokens} tokens (${Math.round((section.tokens / file.tokens) * 100)}% of file)`,
						filePath: file.path,
						line: section.startLine,
						section: section.heading,
						meta: {
							sectionTokens: section.tokens,
							fileTokens: file.tokens,
							ratio: section.tokens / file.tokens,
						},
						suggestion: "Break this section into subsections or move detail to a linked doc",
					});
				}
			}
		}

		return diagnostics;
	}
}
