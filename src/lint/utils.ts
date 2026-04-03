/**
 * Strip fenced code blocks from markdown text.
 * Removes content between ``` markers (including the markers).
 */
export function stripCodeBlocks(text: string): string {
	return text.replace(/```[\s\S]*?```/g, "");
}

/**
 * Strip inline code spans from markdown text.
 * Removes content between single backticks.
 */
export function stripInlineCode(text: string): string {
	return text.replace(/`[^`]+`/g, "");
}

/**
 * Strip all code (fenced blocks + inline) from markdown text.
 */
export function stripAllCode(text: string): string {
	return stripInlineCode(stripCodeBlocks(text));
}
