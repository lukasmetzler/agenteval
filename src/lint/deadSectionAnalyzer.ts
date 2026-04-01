import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { Diagnostic, LintContext, LintRule } from "./types.js";

const MARKDOWN_LINK_PATTERN = /\[([^\]]*)\]\(([^)]+)\)/g;
const FILE_PATH_PATTERN =
	/(?:^|\s)(?:see\s+|check\s+|in\s+|from\s+)?[`"]?((?:\.\/|\.\.\/|src\/|lib\/|app\/|config\/|scripts\/|docs\/)[^\s`"',)]+)[`"']?/gi;

/**
 * Extract markdown links from content.
 */
export function extractMarkdownLinks(
	content: string,
): { text: string; href: string; line: number }[] {
	const links: { text: string; href: string; line: number }[] = [];
	const lines = content.split("\n");

	for (let i = 0; i < lines.length; i++) {
		const regex = new RegExp(MARKDOWN_LINK_PATTERN.source, "g");
		for (const match of lines[i].matchAll(regex)) {
			const href = match[2];
			if (href.startsWith("http://") || href.startsWith("https://") || href.startsWith("#")) {
				continue;
			}
			links.push({ text: match[1], href, line: i + 1 });
		}
	}

	return links;
}

/**
 * Extract bare file path references from content.
 */
export function extractFileReferences(content: string): { path: string; line: number }[] {
	const refs: { path: string; line: number }[] = [];
	const lines = content.split("\n");

	for (let i = 0; i < lines.length; i++) {
		const regex = new RegExp(FILE_PATH_PATTERN.source, "gi");
		for (const match of lines[i].matchAll(regex)) {
			const filePath = match[1].replace(/[`"']/g, "");
			if (filePath.includes("*") || filePath.includes("{")) continue;
			refs.push({ path: filePath, line: i + 1 });
		}
	}

	return refs;
}

export class DeadSectionAnalyzerRule implements LintRule {
	id = "dead-ref";

	async run(ctx: LintContext): Promise<Diagnostic[]> {
		const diagnostics: Diagnostic[] = [];

		for (const file of ctx.files) {
			const fileDir = dirname(resolve(file.path));

			const links = extractMarkdownLinks(file.content);
			for (const link of links) {
				const resolved = resolve(fileDir, link.href);
				if (!existsSync(resolved)) {
					diagnostics.push({
						ruleId: "dead-ref/broken-link",
						severity: "warning",
						message: `Broken link [${link.text}](${link.href}) — target does not exist`,
						filePath: file.path,
						line: link.line,
						meta: { href: link.href, resolved },
					});
				}
			}

			const fileRefs = extractFileReferences(file.content);
			for (const ref of fileRefs) {
				const resolved = resolve(ctx.cwd, ref.path);
				if (!existsSync(resolved)) {
					diagnostics.push({
						ruleId: "dead-ref/missing-file",
						severity: "error",
						message: `Referenced file "${ref.path}" does not exist`,
						filePath: file.path,
						line: ref.line,
						meta: { referencedPath: ref.path, resolved },
					});
				}
			}
		}

		return diagnostics;
	}
}
