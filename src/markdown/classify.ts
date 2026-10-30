import { basename, relative, resolve, sep } from "node:path";

/**
 * What kind of agent configuration file a path is. Each kind has its own
 * frontmatter contract and loading semantics, so validators route on this.
 */
export type FileKind =
	| "instruction"
	| "skill"
	| "skill-resource"
	| "subagent"
	| "command"
	| "claude-rule"
	| "copilot-path-instruction"
	| "cursor-rule"
	| "devin-rule"
	| "kiro-steering";

function toPosix(path: string): string {
	return path.split(sep).join("/");
}

/** Path relative to cwd, posix separators. Accepts absolute or cwd-relative input. */
export function relativePosix(path: string, cwd: string): string {
	return toPosix(relative(cwd, resolve(cwd, path)));
}

export function classifyFile(path: string, cwd: string): FileKind {
	const rel = relativePosix(path, cwd);
	const name = basename(rel);
	const segments = rel.split("/");
	const has = (dir: string) => `/${rel}`.includes(`/${dir}/`);

	if (name === "SKILL.md") return "skill";
	if (segments.includes("skills") && (has(".claude/skills") || has(".agents/skills"))) {
		return "skill-resource";
	}
	if (has(".claude/agents")) return "subagent";
	if (has(".claude/commands")) return "command";
	if (has(".claude/rules")) return "claude-rule";
	if (has(".github/instructions") && name.endsWith(".instructions.md")) {
		return "copilot-path-instruction";
	}
	if (has(".cursor/rules")) return "cursor-rule";
	if (has(".devin/rules") || has(".windsurf/rules")) return "devin-rule";
	if (has(".kiro/steering")) return "kiro-steering";
	return "instruction";
}

/**
 * Whether an agent loads this file at session start. Nested instruction files
 * load lazily when the agent touches their directory, and path-scoped rules
 * load only for matching files, so neither counts toward the startup budget.
 */
export function isLoadedAtStartup(
	file: { path: string; kind: FileKind; frontmatter: Record<string, unknown> | null },
	cwd: string,
): boolean {
	if (file.kind === "claude-rule") return file.frontmatter?.paths === undefined;
	if (file.kind !== "instruction") return false;
	const dir = relativePosix(file.path, cwd).split("/").slice(0, -1);
	return (
		dir.length === 0 ||
		(dir.length === 1 && [".claude", ".github", ".junie"].includes(dir[0] ?? ""))
	);
}
