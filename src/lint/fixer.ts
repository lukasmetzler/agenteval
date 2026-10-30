import { readFileSync, writeFileSync } from "node:fs";
import type { Diagnostic } from "./types.js";

/**
 * Filler phrases that can be safely removed or simplified.
 * Each entry: [pattern to find, replacement (empty = remove entirely)]
 */
const FILLER_REPLACEMENTS: [RegExp, string][] = [
	[/\bit is important to note that\b/gi, ""],
	[/\bplease make sure to\b/gi, ""],
	[/\bkeep in mind that\b/gi, ""],
	[/\bit should be noted that\b/gi, ""],
	[/\bas a general rule\b/gi, ""],
	[/\bin order to\b/gi, "to"],
	[/\bat the end of the day\b/gi, ""],
	[/\bfor the purpose of\b/gi, "for"],
	[/\bit goes without saying\b/gi, ""],
	[/\bneedless to say\b/gi, ""],
	[/\bas previously mentioned\b/gi, ""],
	[/\bin terms of\b/gi, "regarding"],
	[/\bwith respect to\b/gi, "regarding"],
	[/\bin the event that\b/gi, "if"],
	[/\bon a regular basis\b/gi, "regularly"],
	[/\bplease ensure that\b/gi, ""],
	[/\bmake sure that\b/gi, ""],
	[/\bplease ensure\b/gi, ""],
	[/\bmake sure to\b/gi, ""],
];

export interface FixResult {
	file: string;
	fixesApplied: number;
	written: boolean;
}

/**
 * Apply auto-fixes to a file based on diagnostics.
 * Currently fixes:
 * - bloat/filler-phrases: removes or simplifies filler phrases
 *
 * Returns the number of fixes applied.
 */
export function applyFixes(filePath: string, diagnostics: Diagnostic[]): FixResult {
	const fixable = diagnostics.filter((d) => d.filePath === filePath && isFixableRule(d.ruleId));

	if (fixable.length === 0) {
		return { file: filePath, fixesApplied: 0, written: false };
	}

	let content = readFileSync(filePath, "utf-8");
	let fixCount = 0;

	// Fix filler phrases
	if (fixable.some((d) => d.ruleId.startsWith("bloat/"))) {
		const result = fixFillerPhrases(content);
		content = result.content;
		fixCount += result.fixes;
	}

	if (fixCount > 0) {
		writeFileSync(filePath, content, "utf-8");
	}

	return { file: filePath, fixesApplied: fixCount, written: fixCount > 0 };
}

function replaceFillers(line: string): { text: string; count: number } {
	let text = line;
	let count = 0;
	for (const [pattern, replacement] of FILLER_REPLACEMENTS) {
		const before = text;
		text = text.replace(pattern, replacement);
		if (text !== before) count++;
	}
	return { text, count };
}

/**
 * Remove filler phrases from prose lines only. Fenced code blocks are left
 * alone, and whitespace cleanup touches only lines a replacement changed, so
 * indentation, tables, and code are preserved.
 */
export function fixFillerPhrases(content: string): { content: string; fixes: number } {
	let fixes = 0;
	let inFence = false;
	const out: string[] = [];

	for (const line of content.split("\n")) {
		if (/^\s*(```|~~~)/.test(line)) {
			inFence = !inFence;
			out.push(line);
			continue;
		}
		if (inFence) {
			out.push(line);
			continue;
		}
		const { text: fixed, count } = replaceFillers(line);
		fixes += count;
		if (count === 0) {
			out.push(line);
			continue;
		}
		const indent = /^\s*/.exec(fixed)?.[0] ?? "";
		const cleaned = indent + fixed.slice(indent.length).replace(/ {2,}/g, " ").trimEnd();
		// Drop a line the removal emptied; keep lines that were blank already.
		if (cleaned.trim().length > 0 || line.trim().length === 0) out.push(cleaned);
	}

	return { content: out.join("\n"), fixes };
}

function isFixableRule(ruleId: string): boolean {
	return ruleId.startsWith("bloat/");
}
