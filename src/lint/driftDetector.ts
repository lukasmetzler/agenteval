import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { extractFileReferences, extractMarkdownLinks } from "./deadSectionAnalyzer.js";
import type { Diagnostic, LintContext, LintRule } from "./types.js";
import { stripCodeBlocks } from "./utils.js";

/** Minimum age gap (in ms) before flagging drift. Default: 7 days. */
const DRIFT_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;

function formatTimeDiff(ms: number): string {
	const days = Math.floor(ms / (1000 * 60 * 60 * 24));
	if (days < 7) return `${days} day${days !== 1 ? "s" : ""}`;
	const weeks = Math.floor(days / 7);
	if (weeks < 5) return `${weeks} week${weeks !== 1 ? "s" : ""}`;
	const months = Math.floor(days / 30);
	return `${months} month${months !== 1 ? "s" : ""}`;
}

async function getGitLastModified(filePath: string, cwd: string): Promise<Date | null> {
	try {
		const proc = Bun.spawn(["git", "log", "-1", "--format=%aI", "--", filePath], {
			cwd,
			stdout: "pipe",
			stderr: "pipe",
		});
		const output = await new Response(proc.stdout).text();
		await proc.exited;
		const trimmed = output.trim();
		if (!trimmed) return null;
		const date = new Date(trimmed);
		return Number.isNaN(date.getTime()) ? null : date;
	} catch {
		return null;
	}
}

/**
 * Collect all file path references from an instruction file's content.
 * Returns deduplicated list of { path, line } objects for files that exist on disk.
 */
function collectExistingFileRefs(
	content: string,
	cwd: string,
): { path: string; line: number; resolved: string }[] {
	const stripped = stripCodeBlocks(content);
	const seen = new Set<string>();
	const results: { path: string; line: number; resolved: string }[] = [];

	// Bare file path references (src/foo.ts, ./bar.ts, etc.)
	for (const ref of extractFileReferences(stripped)) {
		const resolved = resolve(cwd, ref.path);
		if (!seen.has(resolved) && existsSync(resolved)) {
			seen.add(resolved);
			results.push({ path: ref.path, line: ref.line, resolved });
		}
	}

	// Markdown links — extract href, skip anchors-only
	for (const link of extractMarkdownLinks(stripped)) {
		const href = link.href.split("#")[0];
		if (!href) continue;
		const resolved = resolve(cwd, href);
		if (!seen.has(resolved) && existsSync(resolved)) {
			seen.add(resolved);
			results.push({ path: href, line: link.line, resolved });
		}
	}

	return results;
}

export class DriftDetectorRule implements LintRule {
	id = "drift";

	async run(ctx: LintContext): Promise<Diagnostic[]> {
		const diagnostics: Diagnostic[] = [];

		for (const file of ctx.files) {
			const instructionDate = await getGitLastModified(file.path, ctx.cwd);
			if (!instructionDate) continue; // not tracked or git unavailable

			const refs = collectExistingFileRefs(file.content, ctx.cwd);

			for (const ref of refs) {
				const refDate = await getGitLastModified(ref.resolved, ctx.cwd);
				if (!refDate) continue;

				const drift = refDate.getTime() - instructionDate.getTime();
				if (drift > DRIFT_THRESHOLD_MS) {
					diagnostics.push({
						ruleId: "drift/stale-reference",
						severity: "warning",
						message: `Referenced file "${ref.path}" was modified ${formatTimeDiff(drift)} after this instruction file was last updated`,
						filePath: file.path,
						line: ref.line,
						meta: {
							referencedPath: ref.path,
							instructionLastModified: instructionDate.toISOString(),
							referenceLastModified: refDate.toISOString(),
							driftDays: Math.floor(drift / (1000 * 60 * 60 * 24)),
						},
						suggestion: "Review whether the instructions about this file are still accurate",
					});
				}
			}
		}

		return diagnostics;
	}
}
