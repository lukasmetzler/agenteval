/**
 * Strip fenced code blocks from markdown text.
 * Blanks content between ``` markers (including the markers) but keeps the
 * newlines, so line numbers computed on the result match the original file.
 */
export function stripCodeBlocks(text: string): string {
	return text.replace(/```[\s\S]*?```/g, (block) => block.replace(/[^\n]/g, ""));
}

/**
 * Strip inline code spans from markdown text.
 * Removes content between single backticks.
 */
export function stripInlineCode(text: string): string {
	return text.replace(/`[^`\n]+`/g, "");
}

/**
 * Strip all code (fenced blocks + inline) from markdown text.
 */
export function stripAllCode(text: string): string {
	return stripInlineCode(stripCodeBlocks(text));
}
