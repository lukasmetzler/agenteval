import { dirname, isAbsolute, relative, resolve } from "node:path";

/**
 * Extract the filename from a path string.
 * Works with both Unix and Windows separators.
 */
export function basename(path: string): string {
	return path.split("/").pop() ?? path;
}

/** Path for display: relative to the working directory when the file is inside it. */
export function displayPath(path: string, cwd: string = process.cwd()): string {
	if (!isAbsolute(path)) return path;
	const rel = relative(cwd, path);
	return rel.startsWith("..") || rel === "" ? path : rel;
}

/**
 * Resolve a path mentioned inside an instruction file. Links in nested files
 * are relative to the file, but bare paths are often written repo-relative, so
 * try the file's directory first and fall back to the repo root.
 */
export function resolveMentionedPath(
	ref: string,
	instructionFile: string,
	cwd: string,
	exists: (p: string) => boolean,
): string {
	const fromFile = resolve(dirname(resolve(cwd, instructionFile)), ref);
	if (exists(fromFile)) return fromFile;
	const fromRoot = resolve(cwd, ref);
	return exists(fromRoot) ? fromRoot : fromFile;
}

/**
 * `git diff` flags that pin the output format regardless of user config
 * (diff.mnemonicPrefix, diff.noprefix, color.ui, external diff drivers).
 */
export const GIT_DIFF_FLAGS = [
	"--no-color",
	"--no-ext-diff",
	"--src-prefix=a/",
	"--dst-prefix=b/",
] as const;
