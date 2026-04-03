import type { Diagnostic, LintContext, LintRule } from "./types.js";

const FILLER_PHRASES = [
	"it is important to note that",
	"please make sure to",
	"keep in mind that",
	"it should be noted that",
	"as a general rule",
	"in order to",
	"at the end of the day",
	"for the purpose of",
	"it goes without saying",
	"needless to say",
	"as previously mentioned",
	"in terms of",
	"with respect to",
	"in the event that",
	"on a regular basis",
];

export interface DensityMetrics {
	uniqueWordRatio: number;
	avgSentenceLength: number;
	fillerPhraseCount: number;
	overallScore: number;
}

/**
 * Score information density of text.
 * Returns a score from 0 to 1, where lower = more bloated.
 */
export function scoreDensity(text: string): DensityMetrics {
	const words = text
		.toLowerCase()
		.replace(/[^\w\s]/g, "")
		.split(/\s+/)
		.filter((w) => w.length > 0);

	if (words.length < 10) {
		return {
			uniqueWordRatio: 1,
			avgSentenceLength: words.length,
			fillerPhraseCount: 0,
			overallScore: 1,
		};
	}

	const uniqueWords = new Set(words);
	const uniqueWordRatio = uniqueWords.size / words.length;

	const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
	const avgSentenceLength = sentences.length > 0 ? words.length / sentences.length : words.length;

	const lowerText = text.toLowerCase();
	let fillerPhraseCount = 0;
	for (const phrase of FILLER_PHRASES) {
		let idx = lowerText.indexOf(phrase);
		while (idx !== -1) {
			fillerPhraseCount++;
			idx = lowerText.indexOf(phrase, idx + phrase.length);
		}
	}

	const sentenceLengthScore = 1 - Math.min(avgSentenceLength / 40, 1);
	const fillerPenalty = 1 - Math.min(fillerPhraseCount / 10, 1);

	const overallScore = uniqueWordRatio * 0.4 + sentenceLengthScore * 0.3 + fillerPenalty * 0.3;

	return { uniqueWordRatio, avgSentenceLength, fillerPhraseCount, overallScore };
}

export class BloatScorerRule implements LintRule {
	id = "bloat";

	async run(ctx: LintContext): Promise<Diagnostic[]> {
		const diagnostics: Diagnostic[] = [];
		const threshold = ctx.config.lint.bloatThreshold;

		for (const file of ctx.files) {
			for (const section of file.sections) {
				const metrics = scoreDensity(section.content);

				if (metrics.overallScore < threshold) {
					diagnostics.push({
						ruleId: "bloat/low-density",
						severity: "warning",
						message: `Section "${section.heading}" has low information density (score: ${metrics.overallScore.toFixed(2)}, threshold: ${threshold})`,
						filePath: file.path,
						line: section.startLine,
						section: section.heading,
						meta: { ...metrics },
						suggestion: "Remove filler phrases and tighten the language",
					});
				}

				if (metrics.fillerPhraseCount > 0) {
					diagnostics.push({
						ruleId: "bloat/filler-phrases",
						severity: "info",
						message: `Section "${section.heading}" contains ${metrics.fillerPhraseCount} filler phrase(s)`,
						filePath: file.path,
						line: section.startLine,
						section: section.heading,
						meta: { fillerPhraseCount: metrics.fillerPhraseCount },
						suggestion: "Rewrite without phrases like 'make sure to', 'it is important that'",
					});
				}
			}
		}

		return diagnostics;
	}
}
