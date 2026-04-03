import type { Diagnostic, LintContext, LintRule, Severity } from "./types.js";

export interface AntiPattern {
	id: string;
	description: string;
	pattern: RegExp;
	severity: Severity;
	suggestion?: string;
}

export const BUILTIN_PATTERNS: AntiPattern[] = [
	{
		id: "role-play",
		description: 'Role-playing preambles like "You are an expert..."',
		pattern: /^(you are|act as|pretend to be|imagine you are|assume the role)\b/im,
		severity: "warning",
		suggestion: "Remove the preamble — models already know how to code",
	},
	{
		id: "vague-instruction",
		description: "Vague instructions without specifics",
		pattern: /\b(be careful|write good code|make sure to|try your best|do your best)\b/i,
		severity: "info",
		suggestion: "Replace with a specific example or threshold",
	},
	{
		id: "todo-in-instructions",
		description: "Draft artifacts left in instructions",
		pattern: /\b(TODO|FIXME|HACK|XXX)\b/,
		severity: "warning",
		suggestion: "Either complete the TODO or remove it",
	},
	{
		id: "meta-instruction",
		description: "Instructions about how to read instructions",
		pattern:
			/\b(read this carefully|follow these instructions|pay attention to|important to understand)\b/i,
		severity: "info",
		suggestion: "Delete — the model reads all instructions by default",
	},
	{
		id: "redundant-with-default",
		description: "Restating what models already do by default",
		pattern:
			/\b(write valid|use proper syntax|follow best practices|write clean code|be consistent)\b/i,
		severity: "info",
		suggestion: "Remove — this is already the model's default behavior",
	},
	{
		id: "time-sensitive",
		description: "Time-sensitive references that will become outdated",
		pattern:
			/\b(as of (january|february|march|april|may|june|july|august|september|october|november|december) 20\d{2}|before (january|february|march|april|may|june|july|august|september|october|november|december)|after (january|february|march|april|may|june|july|august|september|october|november|december)|starting in 20\d{2}|until 20\d{2})\b/i,
		severity: "warning",
		suggestion: "Replace with a relative reference or remove the date",
	},
];

export class AntiPatternCheckerRule implements LintRule {
	id = "anti-pattern";

	async run(ctx: LintContext): Promise<Diagnostic[]> {
		const diagnostics: Diagnostic[] = [];

		const allPatterns = [
			...BUILTIN_PATTERNS,
			...this.parseCustomPatterns(ctx.config.lint.antiPatterns),
		];

		for (const file of ctx.files) {
			for (const section of file.sections) {
				for (const ap of allPatterns) {
					const match = ap.pattern.exec(section.content);
					if (match) {
						diagnostics.push({
							ruleId: `anti-pattern/${ap.id}`,
							severity: ap.severity,
							message: `${ap.description}: "${match[0]}"`,
							filePath: file.path,
							line: section.startLine,
							section: section.heading,
							meta: { match: match[0], patternId: ap.id },
							suggestion: ap.suggestion,
						});
					}
				}
			}

			this.checkWallOfText(file, diagnostics);
			this.checkContradictions(file, diagnostics);
		}

		return diagnostics;
	}

	private checkWallOfText(
		file: { path: string; sections: { heading: string; content: string; startLine: number }[] },
		diagnostics: Diagnostic[],
	): void {
		for (const section of file.sections) {
			const paragraphs = section.content.split(/\n\n+/);
			for (const paragraph of paragraphs) {
				const wordCount = paragraph.split(/\s+/).filter((w) => w.length > 0).length;
				if (wordCount > 500) {
					diagnostics.push({
						ruleId: "anti-pattern/wall-of-text",
						severity: "warning",
						message: `Section "${section.heading}" has a paragraph with ${wordCount} words (>500). Break it up with headings.`,
						filePath: file.path,
						line: section.startLine,
						section: section.heading,
						meta: { wordCount },
						suggestion: "Break into sections with headers, or use bullet points",
					});
				}
			}
		}
	}

	private checkContradictions(
		file: { path: string; content: string },
		diagnostics: Diagnostic[],
	): void {
		const alwaysPattern = /always\s+(?:use\s+)?(\w+)/gi;
		const neverPattern = /never\s+(?:use\s+)?(\w+)/gi;

		const alwaysItems = [...file.content.matchAll(alwaysPattern)].map((m) => m[1].toLowerCase());
		const neverItems = [...file.content.matchAll(neverPattern)].map((m) => m[1].toLowerCase());

		for (const item of alwaysItems) {
			if (neverItems.includes(item)) {
				diagnostics.push({
					ruleId: "anti-pattern/contradictory-rules",
					severity: "error",
					message: `Contradictory rules: both "always ${item}" and "never ${item}" found`,
					filePath: file.path,
					meta: { item },
					suggestion: "Remove one of the contradicting rules",
				});
			}
		}
	}

	private parseCustomPatterns(patterns: string[]): AntiPattern[] {
		return patterns
			.map((p, i) => {
				try {
					return {
						id: `custom-${i}`,
						description: `Custom pattern: ${p}`,
						pattern: new RegExp(p, "i"),
						severity: "warning" as Severity,
					};
				} catch {
					return null;
				}
			})
			.filter((p): p is AntiPattern => p !== null);
	}
}
