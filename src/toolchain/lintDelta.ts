import { type Toolchain, toolsWithRole } from "./detect.js";
import { parseUnifiedDiff } from "./diff.js";
import { runnerFor, runTool, type ToolDiagnostic, type ToolRunResult } from "./runners.js";
import type { ToolId } from "./tools.js";

export interface LintDeltaResult {
	runs: ToolRunResult[];
	/** Diagnostics on lines the diff added, or anywhere in files it created. */
	newDiagnostics: ToolDiagnostic[];
}

/**
 * Linters (and, unless disabled, type checkers) the repo uses that agenteval
 * knows how to run. Type checkers check the whole project, so interactive
 * callers may skip them for speed.
 */
export function autoLintTools(
	toolchain: Toolchain,
	options: { typecheck?: boolean } = {},
): ToolId[] {
	const typecheckers = options.typecheck === false ? [] : toolsWithRole(toolchain, "typechecker");
	const ids = [...toolsWithRole(toolchain, "linter"), ...typecheckers]
		.map((t) => t.id)
		.filter((id) => runnerFor(id) !== undefined);
	return [...new Set(ids)];
}

/**
 * Run the given tools on the files a diff touches and keep only findings the
 * diff introduced. Mapping findings to added lines avoids a second baseline
 * run: pre-existing problems on untouched lines don't count against the agent.
 */
export async function computeLintDelta(options: {
	root: string;
	diff: string;
	tools: ToolId[];
	toolchain: Toolchain;
	timeoutMs?: number;
	binRoots?: string[];
}): Promise<LintDeltaResult> {
	const changes = parseUnifiedDiff(options.diff).filter((c) => !c.isDeleted);
	const byPath = new Map(changes.map((c) => [c.path, c]));
	const files = changes.map((c) => c.path);

	const runs: ToolRunResult[] = [];
	for (const id of options.tools) {
		runs.push(
			await runTool({
				id,
				root: options.root,
				files,
				toolchain: options.toolchain,
				timeoutMs: options.timeoutMs ?? 120_000,
				binRoots: options.binRoots,
			}),
		);
	}

	const newDiagnostics = runs.flatMap((run) =>
		run.status === "ok"
			? run.diagnostics.filter((d) => {
					const change = byPath.get(d.file);
					return change !== undefined && (change.isNew || change.addedLines.has(d.line));
				})
			: [],
	);
	return { runs, newDiagnostics };
}
