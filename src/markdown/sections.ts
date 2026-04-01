import type { Heading, Html, Root } from "mdast";
import { toString as mdastToString } from "mdast-util-to-string";

export interface Section {
	heading: string;
	depth: number;
	startLine: number;
	endLine: number;
	content: string;
	tokens: number;
}

export interface SuppressionComment {
	ruleId: string | null;
	line: number;
}

/**
 * Extract heading-delimited sections from an mdast tree.
 * Also captures inline suppression comments: <!-- agenteval-disable [rule-id] -->
 */
export function extractSections(tree: Root, rawContent: string): Section[] {
	const lines = rawContent.split("\n");
	const headings: { heading: string; depth: number; startLine: number }[] = [];

	for (const node of tree.children) {
		if (node.type === "heading") {
			const h = node as Heading;
			headings.push({
				heading: mdastToString(h),
				depth: h.depth,
				startLine: h.position?.start.line ?? 0,
			});
		}
	}

	if (headings.length === 0) {
		return [
			{
				heading: "(root)",
				depth: 0,
				startLine: 1,
				endLine: lines.length,
				content: rawContent,
				tokens: 0,
			},
		];
	}

	const sections: Section[] = [];

	for (let i = 0; i < headings.length; i++) {
		const current = headings[i];
		const next = headings[i + 1];
		const startLine = current.startLine;
		const endLine = next ? next.startLine - 1 : lines.length;

		const sectionLines = lines.slice(startLine - 1, endLine);
		const content = sectionLines.join("\n");

		sections.push({
			heading: current.heading,
			depth: current.depth,
			startLine,
			endLine,
			content,
			tokens: 0,
		});
	}

	return sections;
}

/**
 * Parse inline suppression comments from an mdast tree.
 * Supports:
 *   <!-- agenteval-disable -->          (disable all rules for next section)
 *   <!-- agenteval-disable rule-id -->  (disable specific rule for next section)
 */
export function extractSuppressions(tree: Root): SuppressionComment[] {
	const suppressions: SuppressionComment[] = [];
	const pattern = /<!--\s*agenteval-disable\s*(\S+)?\s*-->/;

	for (const node of tree.children) {
		if (node.type === "html") {
			const html = node as Html;
			const match = pattern.exec(html.value);
			if (match) {
				suppressions.push({
					ruleId: match[1] ?? null,
					line: html.position?.start.line ?? 0,
				});
			}
		}
	}

	return suppressions;
}

/**
 * Extract YAML frontmatter content from an mdast tree.
 * Returns the raw YAML string or null if no frontmatter found.
 */
export function extractFrontmatter(tree: Root): string | null {
	for (const node of tree.children) {
		if (node.type === "yaml") {
			return (node as { value: string }).value;
		}
	}
	return null;
}
