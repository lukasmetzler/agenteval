import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { Diagnostic, LintContext, LintRule } from "./types.js";
import { stripCodeBlocks } from "./utils.js";

const MARKDOWN_LINK_PATTERN = /\[([^\]]*)\]\(([^)]+)\)/g;
const IMAGE_LINK_PATTERN = /!\[([^\]]*)\]\(([^)]+)\)/g;
const REFERENCE_USAGE_PATTERN = /\[([^\]]+)\]\[([^\]]*)\]/g;
const REFERENCE_DEFINITION_PATTERN = /^\[([^\]]+)\]:\s*(.+)$/gm;
const FILE_PATH_PATTERN =
	/(?:^|\s)(?:see\s+|check\s+|in\s+|from\s+)?[`"]?((?:\.\/|\.\.\/|src\/|lib\/|app\/|config\/|scripts\/|docs\/)[^\s`"',)]+)[`"']?/gi;

/**
 * Convert heading text to a GitHub-style anchor slug.
 */
export function headingToAnchor(heading: string): string {
	return heading
		.toLowerCase()
		.replace(/[^\w\s-]/g, "")
		.replace(/\s+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "");
}

/**
 * Extract headings from a markdown file on disk.
 */
export function extractHeadingsFromFile(filePath: string): string[] {
	const content = readFileSync(filePath, "utf-8");
	return extractHeadingsFromContent(content);
}

/**
 * Extract headings from markdown content string.
 */
export function extractHeadingsFromContent(content: string): string[] {
	const headingRegex = /^#{1,6}\s+(.+)$/gm;
	const headings: string[] = [];
	for (const match of content.matchAll(headingRegex)) {
		headings.push(match[1].trim());
	}
	return headings;
}

/**
 * Extract markdown links from content (non-image links only).
 */
export function extractMarkdownLinks(
	content: string,
): { text: string; href: string; line: number }[] {
	const links: { text: string; href: string; line: number }[] = [];
	const lines = content.split("\n");

	for (let i = 0; i < lines.length; i++) {
		const regex = new RegExp(MARKDOWN_LINK_PATTERN.source, "g");
		for (const match of lines[i].matchAll(regex)) {
			// Skip image links (preceded by !)
			const idx = match.index ?? 0;
			if (idx > 0 && lines[i][idx - 1] === "!") continue;

			const href = match[2];
			if (href.startsWith("http://") || href.startsWith("https://")) {
				continue;
			}
			links.push({ text: match[1], href, line: i + 1 });
		}
	}

	return links;
}

/**
 * Extract image references from content.
 */
export function extractImageLinks(content: string): { alt: string; src: string; line: number }[] {
	const images: { alt: string; src: string; line: number }[] = [];
	const lines = content.split("\n");

	for (let i = 0; i < lines.length; i++) {
		const regex = new RegExp(IMAGE_LINK_PATTERN.source, "g");
		for (const match of lines[i].matchAll(regex)) {
			const src = match[2];
			if (src.startsWith("http://") || src.startsWith("https://")) {
				continue;
			}
			images.push({ alt: match[1], src, line: i + 1 });
		}
	}

	return images;
}

/**
 * Extract reference-style link usages and definitions from content.
 */
export function extractReferenceLinks(content: string): {
	usages: { text: string; ref: string; line: number }[];
	definitions: Map<string, { url: string; line: number }>;
} {
	const usages: { text: string; ref: string; line: number }[] = [];
	const definitions = new Map<string, { url: string; line: number }>();
	const lines = content.split("\n");

	// Collect definitions first
	for (let i = 0; i < lines.length; i++) {
		const regex = new RegExp(REFERENCE_DEFINITION_PATTERN.source, "gm");
		for (const match of lines[i].matchAll(regex)) {
			definitions.set(match[1].toLowerCase(), {
				url: match[2].trim(),
				line: i + 1,
			});
		}
	}

	// Collect usages
	for (let i = 0; i < lines.length; i++) {
		const regex = new RegExp(REFERENCE_USAGE_PATTERN.source, "g");
		for (const match of lines[i].matchAll(regex)) {
			// Skip if this is a definition line
			if (/^\[([^\]]+)\]:\s*/.test(lines[i])) continue;
			// The ref key: if empty bracket [text][], the key is the text itself
			const ref = match[2] || match[1];
			usages.push({ text: match[1], ref: ref.toLowerCase(), line: i + 1 });
		}
	}

	return { usages, definitions };
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

function checkSameFileAnchor(
	filePath: string,
	link: { href: string; line: number },
	fileAnchors: string[],
): Diagnostic | null {
	const anchor = link.href.slice(1);
	if (fileAnchors.includes(anchor)) return null;
	return {
		ruleId: "dead-ref/broken-anchor",
		severity: "warning",
		message: `Heading anchor #${anchor} does not match any heading in this file`,
		filePath,
		line: link.line,
		meta: { anchor, availableAnchors: fileAnchors },
		suggestion: "Fix the anchor to match an existing heading, or add the missing heading",
	};
}

function checkFileLink(
	filePath: string,
	link: { text: string; href: string; line: number },
	fileDir: string,
): Diagnostic[] {
	const hashIndex = link.href.indexOf("#");
	const filePart = hashIndex >= 0 ? link.href.slice(0, hashIndex) : link.href;
	const anchorPart = hashIndex >= 0 ? link.href.slice(hashIndex + 1) : null;
	const resolved = resolve(fileDir, filePart);

	if (!existsSync(resolved)) {
		return [
			{
				ruleId: "dead-ref/broken-link",
				severity: "warning",
				message: `Broken link [${link.text}](${link.href}) — target does not exist`,
				filePath,
				line: link.line,
				meta: { href: link.href, resolved },
				suggestion: "Fix the link target or remove the link",
			},
		];
	}

	if (anchorPart && resolved.endsWith(".md")) {
		const diag = checkCrossFileAnchor(filePath, link.line, filePart, anchorPart, resolved);
		if (diag) return [diag];
	}

	return [];
}

function checkMarkdownLinks(
	file: { path: string; content: string },
	fileDir: string,
	fileAnchors: string[],
): Diagnostic[] {
	const diagnostics: Diagnostic[] = [];
	const links = extractMarkdownLinks(file.content);

	for (const link of links) {
		if (link.href.startsWith("#")) {
			const diag = checkSameFileAnchor(file.path, link, fileAnchors);
			if (diag) diagnostics.push(diag);
			continue;
		}
		diagnostics.push(...checkFileLink(file.path, link, fileDir));
	}

	return diagnostics;
}

function checkCrossFileAnchor(
	filePath: string,
	line: number,
	filePart: string,
	anchorPart: string,
	resolved: string,
): Diagnostic | null {
	try {
		const targetHeadings = extractHeadingsFromFile(resolved);
		const targetAnchors = targetHeadings.map(headingToAnchor);
		if (!targetAnchors.includes(anchorPart)) {
			return {
				ruleId: "dead-ref/broken-anchor",
				severity: "warning",
				message: `Heading #${anchorPart} does not exist in ${filePart}`,
				filePath,
				line,
				meta: { anchor: anchorPart, targetFile: filePart, availableAnchors: targetAnchors },
				suggestion: "Fix the anchor to match an existing heading in the target file",
			};
		}
	} catch {
		// If we can't read the file, skip anchor validation
	}
	return null;
}

function checkImageLinks(file: { path: string; content: string }, fileDir: string): Diagnostic[] {
	const diagnostics: Diagnostic[] = [];
	const images = extractImageLinks(file.content);

	for (const img of images) {
		const resolved = resolve(fileDir, img.src);
		if (!existsSync(resolved)) {
			diagnostics.push({
				ruleId: "dead-ref/missing-file",
				severity: "warning",
				message: `Referenced image file "${img.src}" does not exist`,
				filePath: file.path,
				line: img.line,
				meta: { referencedPath: img.src, resolved },
				suggestion: "Remove the reference or create the missing file",
			});
		}
	}

	return diagnostics;
}

function checkReferenceLinks(
	file: { path: string; content: string },
	fileDir: string,
): Diagnostic[] {
	const diagnostics: Diagnostic[] = [];
	const { usages, definitions } = extractReferenceLinks(file.content);

	for (const usage of usages) {
		if (!definitions.has(usage.ref)) {
			diagnostics.push({
				ruleId: "dead-ref/undefined-reference",
				severity: "warning",
				message: `Reference [${usage.ref}] is not defined`,
				filePath: file.path,
				line: usage.line,
				meta: { reference: usage.ref },
				suggestion: "Add the missing reference definition or switch to inline link syntax",
			});
		}
	}

	for (const [ref, def] of definitions) {
		const url = def.url;
		if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("#")) {
			continue;
		}
		const resolved = resolve(fileDir, url);
		if (!existsSync(resolved)) {
			diagnostics.push({
				ruleId: "dead-ref/broken-link",
				severity: "warning",
				message: `Reference definition [${ref}] points to "${url}" which does not exist`,
				filePath: file.path,
				line: def.line,
				meta: { href: url, resolved },
				suggestion: "Fix the link target or remove the reference definition",
			});
		}
	}

	return diagnostics;
}

function checkBareFileRefs(file: { path: string; content: string }, cwd: string): Diagnostic[] {
	const diagnostics: Diagnostic[] = [];
	const proseOnly = stripCodeBlocks(file.content);
	const fileRefs = extractFileReferences(proseOnly);

	for (const ref of fileRefs) {
		const resolved = resolve(cwd, ref.path);
		if (!existsSync(resolved)) {
			diagnostics.push({
				ruleId: "dead-ref/missing-file",
				severity: "error",
				message: `Referenced file "${ref.path}" does not exist`,
				filePath: file.path,
				line: ref.line,
				meta: { referencedPath: ref.path, resolved },
				suggestion: "Remove the reference or create the missing file",
			});
		}
	}

	return diagnostics;
}

export class DeadSectionAnalyzerRule implements LintRule {
	id = "dead-ref";

	async run(ctx: LintContext): Promise<Diagnostic[]> {
		const diagnostics: Diagnostic[] = [];

		for (const file of ctx.files) {
			const fileDir = dirname(resolve(file.path));
			const fileHeadings = extractHeadingsFromContent(file.content);
			const fileAnchors = fileHeadings.map(headingToAnchor);

			diagnostics.push(...checkMarkdownLinks(file, fileDir, fileAnchors));
			diagnostics.push(...checkImageLinks(file, fileDir));
			diagnostics.push(...checkReferenceLinks(file, fileDir));
			diagnostics.push(...checkBareFileRefs(file, ctx.cwd));
		}

		return diagnostics;
	}
}
