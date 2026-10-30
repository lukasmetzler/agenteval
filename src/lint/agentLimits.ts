import { basename, dirname, extname, resolve, sep } from "node:path";
import { extractImports } from "../markdown/imports.js";
import type { Diagnostic, LintContext, LintRule, ParsedFile } from "./types.js";

// Sources for every limit: docs/research/2026-10-30-agent-ecosystem.md §1.
const CODEX_MAX_BYTES = 32 * 1024;
const CLAUDE_RECOMMENDED_LINES = 200;
const CLAUDE_LAZY_MAX_CHARS = 40_000;
const CURSOR_RECOMMENDED_LINES = 500;

function lineCount(content: string): number {
	return content.split("\n").length;
}

function isAncestorDir(ancestor: string, dir: string): boolean {
	return dir === ancestor || dir.startsWith(ancestor + sep);
}

/**
 * Deterministic checks for loading limits each agent documents. These catch
 * files an agent silently truncates, skips, or ignores.
 */
export class AgentLimitsRule implements LintRule {
	id = "agent-limits";

	async run(ctx: LintContext): Promise<Diagnostic[]> {
		return [
			...codexChainSize(ctx),
			...ctx.files.flatMap((f) => claudeFileLimits(f, ctx.cwd)),
			...ctx.files.flatMap(cursorRuleLimits),
			...claudeIgnoresAgentsMd(ctx),
		];
	}
}

function codexChainSize(ctx: LintContext): Diagnostic[] {
	const agentsFiles = ctx.files.filter((f) => basename(f.path) === "AGENTS.md");
	const diagnostics: Diagnostic[] = [];
	for (const file of agentsFiles) {
		const dir = dirname(resolve(ctx.cwd, file.path));
		const chain = agentsFiles.filter((f) => isAncestorDir(dirname(resolve(ctx.cwd, f.path)), dir));
		const bytes = chain.reduce((sum, f) => sum + Buffer.byteLength(f.content), 0);
		if (bytes > CODEX_MAX_BYTES) {
			diagnostics.push({
				ruleId: "agent-limits/codex-size",
				severity: "warning",
				message: `AGENTS.md chain is ${Math.round(bytes / 1024)} KiB. Codex stops reading at 32 KiB (project_doc_max_bytes), so the rest is dropped.`,
				filePath: file.path,
				meta: { bytes, limit: CODEX_MAX_BYTES, chain: chain.map((f) => f.path) },
				suggestion: "Move detail into nested AGENTS.md files or linked docs",
			});
		}
	}
	return diagnostics;
}

function claudeFileLimits(file: ParsedFile, cwd: string): Diagnostic[] {
	if (basename(file.path) !== "CLAUDE.md") return [];
	const diagnostics: Diagnostic[] = [];
	const lines = lineCount(file.content);
	if (lines > CLAUDE_RECOMMENDED_LINES) {
		diagnostics.push({
			ruleId: "agent-limits/claude-lines",
			severity: "info",
			message: `CLAUDE.md is ${lines} lines. Claude Code recommends under ${CLAUDE_RECOMMENDED_LINES} and warns above it.`,
			filePath: file.path,
			meta: { lines, limit: CLAUDE_RECOMMENDED_LINES },
			suggestion: "Split topic sections into .claude/rules/ files or @imports",
		});
	}
	const nested = dirname(resolve(cwd, file.path)) !== resolve(cwd);
	if (nested && file.content.length > CLAUDE_LAZY_MAX_CHARS) {
		diagnostics.push({
			ruleId: "agent-limits/claude-truncation",
			severity: "warning",
			message: `Nested CLAUDE.md is ${file.content.length} characters. Claude Code truncates lazily loaded files at ${CLAUDE_LAZY_MAX_CHARS} on 200K-context models.`,
			filePath: file.path,
			meta: { chars: file.content.length, limit: CLAUDE_LAZY_MAX_CHARS },
		});
	}
	return diagnostics;
}

function cursorRuleLimits(file: ParsedFile): Diagnostic[] {
	if (file.kind !== "cursor-rule") return [];
	if (extname(file.path) !== ".mdc") {
		return [
			{
				ruleId: "agent-limits/cursor-md-ignored",
				severity: "warning",
				message: "Cursor only loads .mdc files from .cursor/rules/. This .md file is ignored.",
				filePath: file.path,
				suggestion: "Rename to .mdc and add description/globs/alwaysApply frontmatter",
			},
		];
	}
	const lines = lineCount(file.content);
	if (lines <= CURSOR_RECOMMENDED_LINES) return [];
	return [
		{
			ruleId: "agent-limits/cursor-lines",
			severity: "info",
			message: `Cursor rule is ${lines} lines. Cursor recommends keeping rules under ${CURSOR_RECOMMENDED_LINES}.`,
			filePath: file.path,
			meta: { lines, limit: CURSOR_RECOMMENDED_LINES },
		},
	];
}

function claudeIgnoresAgentsMd(ctx: LintContext): Diagnostic[] {
	const atRoot = (name: string) =>
		ctx.files.find((f) => resolve(ctx.cwd, f.path) === resolve(ctx.cwd, name));
	const claude = atRoot("CLAUDE.md");
	const agents = atRoot("AGENTS.md");
	if (!claude || !agents) return [];
	if (extractImports(claude.content).some((r) => basename(r.path) === "AGENTS.md")) return [];
	return [
		{
			ruleId: "agent-limits/claude-ignores-agents-md",
			severity: "info",
			message:
				"Claude Code reads AGENTS.md only when no CLAUDE.md exists, so it never sees this AGENTS.md.",
			filePath: agents.path,
			suggestion: "Add @AGENTS.md to CLAUDE.md, or keep shared rules in one file",
		},
	];
}
