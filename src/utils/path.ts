/**
 * Extract the filename from a path string.
 * Works with both Unix and Windows separators.
 */
export function basename(path: string): string {
	return path.split("/").pop() ?? path;
}
