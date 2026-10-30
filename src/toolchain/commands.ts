import type { Root, RootContent } from "mdast";
import {
	isJsPackageManager,
	type JsPackageManager,
	type ToolSpec,
	toolForBinary,
} from "./tools.js";

/** A shell command an instruction file tells the agent to run. */
export type CommandRef =
	| { kind: "script"; pm: JsPackageManager; script: string; line: number; text: string }
	| { kind: "pm"; pm: JsPackageManager; subcommand: string; line: number; text: string }
	| { kind: "tool"; tool: ToolSpec; line: number; text: string };

const SHELL_LANGS = new Set(["", "bash", "sh", "shell", "zsh", "console", "terminal", "fish"]);

// Subcommands that are not script names when used as `pnpm <x>` / `yarn <x>`.
const PM_BUILTINS = new Set([
	"install",
	"i",
	"add",
	"remove",
	"rm",
	"uninstall",
	"update",
	"up",
	"upgrade",
	"exec",
	"dlx",
	"x",
	"create",
	"init",
	"why",
	"list",
	"ls",
	"outdated",
	"audit",
	"publish",
	"pack",
	"link",
	"unlink",
	"store",
	"config",
	"dedupe",
	"import",
	"rebuild",
	"prune",
	"patch",
	"bin",
	"root",
	"env",
	"setup",
	"info",
	"global",
	"cache",
	"workspace",
	"workspaces",
	"ci",
	"login",
	"logout",
	"version",
	"help",
	"set",
]);
// npm lifecycle shortcuts that run the script of the same name.
const NPM_SCRIPT_ALIASES = new Set(["test", "t", "start", "stop", "restart"]);
const RUNNERS: Record<string, JsPackageManager> = { npx: "npm", bunx: "bun", pnpx: "pnpm" };

function collectCodeNodes(nodes: RootContent[], out: { value: string; line: number }[]): void {
	for (const node of nodes) {
		if (node.type === "code" && SHELL_LANGS.has((node.lang ?? "").toLowerCase())) {
			out.push({ value: node.value, line: (node.position?.start.line ?? 0) + 1 });
		} else if (node.type === "inlineCode") {
			out.push({ value: node.value, line: node.position?.start.line ?? 0 });
		} else if ("children" in node) {
			collectCodeNodes(node.children, out);
		}
	}
}

function firstNonFlag(tokens: string[], from: number): string | undefined {
	return tokens.slice(from).find((t) => !t.startsWith("-"));
}

function looksLikeFile(token: string): boolean {
	return token.includes("/") || /\.(c|m)?[jt]sx?$/.test(token);
}

function toolRef(binary: string | undefined, line: number, text: string): CommandRef | null {
	const tool = toolForBinary(binary ?? "");
	return tool ? { kind: "tool", tool, line, text } : null;
}

/** The script a `<pm> <sub> ...` invocation runs, or null if it is not a script run. */
function scriptName(pm: JsPackageManager, sub: string, tokens: string[]): string | null {
	if (sub === "run") {
		const script = firstNonFlag(tokens, 2);
		return script && !looksLikeFile(script) ? script : null;
	}
	if (pm === "npm") {
		if (!NPM_SCRIPT_ALIASES.has(sub)) return null;
		return sub === "t" ? "test" : sub;
	}
	// pnpm and yarn run scripts without `run`.
	const implicit = pm === "pnpm" || pm === "yarn";
	if (!implicit || PM_BUILTINS.has(sub) || sub.startsWith("-") || looksLikeFile(sub)) return null;
	return sub;
}

function parsePackageManager(
	pm: JsPackageManager,
	tokens: string[],
	line: number,
	text: string,
): CommandRef | null {
	const sub = tokens[1];
	if (sub === undefined) {
		return pm === "yarn" ? { kind: "pm", pm, subcommand: "install", line, text } : null;
	}
	if (sub === "exec" || sub === "dlx" || sub === "x")
		return toolRef(firstNonFlag(tokens, 2), line, text);
	const script = scriptName(pm, sub, tokens);
	if (script) return { kind: "script", pm, script, line, text };
	if (sub === "run") return null;
	// `bun test` and `bun <file>` are built-in runners, not scripts.
	if (pm === "bun" && (sub === "test" || looksLikeFile(sub))) return null;
	return { kind: "pm", pm, subcommand: sub, line, text };
}

export function parseCommand(segment: string, line: number): CommandRef | null {
	const text = segment.trim().replace(/^\$\s+/, "");
	const tokens = text.split(/\s+/).filter((t) => t.length > 0 && !/^\w+=/.test(t));
	const head = tokens[0];
	if (!head) return null;
	if (tokens.includes("-g") || tokens.includes("--global")) return null;
	if (RUNNERS[head]) return toolRef(firstNonFlag(tokens, 1), line, text);
	if (isJsPackageManager(head)) return parsePackageManager(head, tokens, line, text);
	return toolRef(head, line, text);
}

/** Shell commands from fenced shell blocks and inline code spans, with source lines. */
export function extractCommands(tree: Root): CommandRef[] {
	const blocks: { value: string; line: number }[] = [];
	collectCodeNodes(tree.children, blocks);
	const commands: CommandRef[] = [];
	for (const block of blocks) {
		for (const [offset, rawLine] of block.value.split("\n").entries()) {
			const withoutComment = rawLine.replace(/(^|\s)#.*$/, "");
			for (const segment of withoutComment.split(/&&|\|\||;|\|/)) {
				const cmd = parseCommand(segment, block.line + offset);
				if (cmd) commands.push(cmd);
			}
		}
	}
	return commands;
}
