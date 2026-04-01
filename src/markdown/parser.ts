import { readFileSync } from "node:fs";
import type { Root } from "mdast";
import remarkFrontmatter from "remark-frontmatter";
import remarkParse from "remark-parse";
import { unified } from "unified";

const processor = unified().use(remarkParse).use(remarkFrontmatter, ["yaml"]);

export function parseMarkdown(content: string): Root {
	return processor.parse(content);
}

export function parseMarkdownFile(filePath: string): Root {
	const content = readFileSync(filePath, "utf-8");
	return parseMarkdown(content);
}
