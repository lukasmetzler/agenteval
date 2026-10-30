import { classifyFile } from "../markdown/classify.js";
import { parseMarkdown } from "../markdown/parser.js";
import {
	extractBody,
	extractSections,
	extractSuppressions,
	parseFrontmatter,
} from "../markdown/sections.js";
import { countTokens } from "./tokenCounter.js";
import type { ParsedFile } from "./types.js";

export function parseInstructionFile(path: string, content: string, cwd: string): ParsedFile {
	const tree = parseMarkdown(content);
	const sections = extractSections(tree, content);
	for (const section of sections) {
		section.tokens = countTokens(section.content);
	}
	return {
		path,
		kind: classifyFile(path, cwd),
		content,
		body: extractBody(tree, content),
		tree,
		sections,
		suppressions: extractSuppressions(tree),
		tokens: countTokens(content),
		frontmatter: parseFrontmatter(tree),
	};
}
