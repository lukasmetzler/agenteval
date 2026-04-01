import type { Diagnostic, LintContext, LintRule } from "./types.js";

const DEFAULT_NGRAM_SIZE = 5;

/**
 * Generate word-level n-grams from text.
 * Words are lowercased and punctuation is stripped.
 */
export function computeNgrams(text: string, n: number = DEFAULT_NGRAM_SIZE): Set<string> {
	const words = text
		.toLowerCase()
		.replace(/[^\w\s]/g, "")
		.split(/\s+/)
		.filter((w) => w.length > 0);

	if (words.length < n) return new Set();

	const ngrams = new Set<string>();
	for (let i = 0; i <= words.length - n; i++) {
		ngrams.add(words.slice(i, i + n).join(" "));
	}
	return ngrams;
}

/**
 * Compute Jaccard similarity between two sets.
 */
export function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
	if (a.size === 0 && b.size === 0) return 0;

	let intersection = 0;
	for (const item of a) {
		if (b.has(item)) intersection++;
	}

	const union = a.size + b.size - intersection;
	if (union === 0) return 0;

	return intersection / union;
}

export class OverlapDetectorRule implements LintRule {
	id = "overlap";

	async run(ctx: LintContext): Promise<Diagnostic[]> {
		const diagnostics: Diagnostic[] = [];
		const threshold = ctx.config.lint.overlapThreshold;

		if (ctx.files.length < 2) return diagnostics;

		const fileNgrams = ctx.files.map((f) => ({
			path: f.path,
			ngrams: computeNgrams(f.content),
		}));

		for (let i = 0; i < fileNgrams.length; i++) {
			for (let j = i + 1; j < fileNgrams.length; j++) {
				const a = fileNgrams[i];
				const b = fileNgrams[j];
				const similarity = jaccardSimilarity(a.ngrams, b.ngrams);

				if (similarity > threshold) {
					diagnostics.push({
						ruleId: "overlap/high-similarity",
						severity: "warning",
						message: `${basename(a.path)} and ${basename(b.path)} share ${Math.round(similarity * 100)}% similarity`,
						filePath: a.path,
						meta: {
							otherFile: b.path,
							similarity: Math.round(similarity * 100) / 100,
						},
					});
				}
			}
		}

		return diagnostics;
	}
}

function basename(path: string): string {
	return path.split("/").pop() ?? path;
}
