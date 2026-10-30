/** Lines a diff adds to one file. */
export interface FileChange {
	path: string;
	/** Line numbers (in the new file) the diff adds or rewrites. */
	addedLines: Set<number>;
	isNew: boolean;
	isDeleted: boolean;
}

const HUNK_HEADER = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

/** Apply one non-header diff line to the file it belongs to; returns the next new-file line number. */
function applyLine(change: FileChange, line: string, newLine: number): number {
	if (line.startsWith("new file mode")) change.isNew = true;
	else if (line.startsWith("deleted file mode")) change.isDeleted = true;
	else if (line.startsWith("+++ ") || line.startsWith("--- ")) return newLine;
	else if (line.startsWith("@@")) return Number(HUNK_HEADER.exec(line)?.[1] ?? 0);
	else if (line.startsWith("+")) {
		change.addedLines.add(newLine);
		return newLine + 1;
	} else if (line.startsWith(" ")) return newLine + 1;
	return newLine;
}

/** Parse a unified `git diff` into per-file added line numbers. */
export function parseUnifiedDiff(diff: string): FileChange[] {
	const changes: FileChange[] = [];
	let current: FileChange | null = null;
	let newLine = 0;

	for (const line of diff.split("\n")) {
		if (line.startsWith("diff --git ")) {
			const path = / b\/(.+)$/.exec(line)?.[1] ?? "";
			current = { path, addedLines: new Set(), isNew: false, isDeleted: false };
			changes.push(current);
		} else if (current) {
			newLine = applyLine(current, line, newLine);
		}
	}
	return changes;
}
