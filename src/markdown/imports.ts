import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { stripAllCode } from "../lint/utils.js";

/** Claude Code follows @imports at most this many hops deep. */
export const MAX_IMPORT_DEPTH = 4;

export interface ImportRef {
	path: string;
	line: number;
}

// `@path` at line start or after whitespace. Only tokens that look like files
// (explicit ./ ../ ~/ prefix or a file extension) count, so `@types/node` or
// `@username` prose is not mistaken for an import.
const IMPORT_PATTERN = /(?:^|\s)@((?:\.{1,2}\/|~\/)?[\w./-]+)/g;
const FILE_LIKE = /^(?:\.{1,2}\/|~\/)|\.[a-zA-Z0-9]+$/;

export function extractImports(content: string): ImportRef[] {
	const refs: ImportRef[] = [];
	const lines = stripAllCode(content).split("\n");
	for (const [index, line] of lines.entries()) {
		for (const match of line.matchAll(IMPORT_PATTERN)) {
			const path = match[1]?.replace(/[.,;:)]+$/, "");
			if (path && FILE_LIKE.test(path)) refs.push({ path, line: index + 1 });
		}
	}
	return refs;
}

export type ImportIssue =
	| { kind: "missing"; from: string; ref: ImportRef; resolved: string }
	| { kind: "cycle"; from: string; ref: ImportRef; resolved: string }
	| { kind: "too-deep"; from: string; ref: ImportRef; resolved: string };

export interface ImportGraph {
	/** Imported files that exist, with their content, keyed by absolute path. */
	imported: Map<string, string>;
	issues: ImportIssue[];
}

/**
 * Follow @imports from each root file. Home-directory imports (`@~/...`) are
 * user-specific, so they are neither followed nor reported.
 */
export function resolveImportGraph(
	roots: { path: string; content: string }[],
	readFile: (path: string) => string | null = defaultReadFile,
): ImportGraph {
	const imported = new Map<string, string>();
	const issues: ImportIssue[] = [];

	const visit = (path: string, content: string, depth: number, chain: string[]) => {
		for (const ref of extractImports(content)) {
			if (ref.path.startsWith("~/")) continue;
			const resolved = resolve(dirname(path), ref.path);
			if (chain.includes(resolved)) {
				issues.push({ kind: "cycle", from: path, ref, resolved });
				continue;
			}
			if (depth >= MAX_IMPORT_DEPTH) {
				issues.push({ kind: "too-deep", from: path, ref, resolved });
				continue;
			}
			const child = imported.get(resolved) ?? readFile(resolved);
			if (child === null) {
				issues.push({ kind: "missing", from: path, ref, resolved });
				continue;
			}
			imported.set(resolved, child);
			visit(resolved, child, depth + 1, [...chain, resolved]);
		}
	};

	for (const root of roots) {
		const abs = resolve(root.path);
		visit(abs, root.content, 0, [abs]);
	}
	return { imported, issues };
}

function defaultReadFile(path: string): string | null {
	if (!existsSync(path)) return null;
	try {
		return readFileSync(path, "utf-8");
	} catch {
		return null;
	}
}
