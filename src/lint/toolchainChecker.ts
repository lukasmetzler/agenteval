import { basename } from "node:path";
import { type CommandRef, extractCommands } from "../toolchain/commands.js";
import {
	type DetectedTool,
	detectToolchain,
	hasTool,
	scriptCommand,
	type Toolchain,
} from "../toolchain/detect.js";
import { isJsPackageManager, type ToolSpec } from "../toolchain/tools.js";
import type { Diagnostic, LintContext, LintRule, ParsedFile } from "./types.js";

interface FileCommands {
	file: ParsedFile;
	commands: CommandRef[];
}

function describeSource(tool: DetectedTool): string {
	switch (tool.source.kind) {
		case "config":
			return tool.source.file;
		case "package-json":
			return `package.json "${tool.source.key}"`;
		case "pyproject":
			return `pyproject.toml [${tool.source.table}]`;
		case "dependency":
			return `${tool.source.name} dependency`;
		default: {
			const _exhaustive: never = tool.source;
			return _exhaustive;
		}
	}
}

/** Whether the repo's ecosystem is visible, so an absent tool means something. */
function ecosystemPresent(toolchain: Toolchain, spec: ToolSpec): boolean {
	return spec.ecosystem === "js" ? toolchain.hasPackageJson : toolchain.hasPyproject;
}

/** Whether a command runs the given tool, directly or through a package.json script. */
function commandRunsTool(cmd: CommandRef, tool: DetectedTool, toolchain: Toolchain): boolean {
	if (cmd.kind === "tool") return cmd.tool.id === tool.id;
	if (cmd.kind !== "script") return false;
	const body = toolchain.scripts[cmd.script] ?? "";
	return tool.spec.binaries.some((b) => new RegExp(`(^|[\\s/])${b}(\\s|$)`).test(body));
}

function missingScript(cmd: CommandRef, toolchain: Toolchain, filePath: string): Diagnostic[] {
	if (cmd.kind !== "script" || !toolchain.hasPackageJson) return [];
	if (toolchain.scripts[cmd.script] !== undefined) return [];
	const available = Object.keys(toolchain.scripts);
	return [
		{
			ruleId: "toolchain/missing-script",
			severity: "error",
			message: `\`${cmd.text}\` runs script "${cmd.script}", which package.json does not define`,
			filePath,
			line: cmd.line,
			meta: { script: cmd.script, available },
			suggestion:
				available.length > 0
					? `Available scripts: ${available.join(", ")}`
					: "Add the script to package.json or remove the command",
		},
	];
}

function wrongPackageManager(
	cmd: CommandRef,
	toolchain: Toolchain,
	filePath: string,
): Diagnostic[] {
	if (cmd.kind === "tool") return [];
	const expected = toolchain.jsPackageManager;
	const certain = toolchain.packageManagers.some(isJsPackageManager);
	if (!expected || !certain || cmd.pm === expected) return [];
	const fix =
		cmd.kind === "script" ? scriptCommand(toolchain, cmd.script) : `${expected} ${cmd.subcommand}`;
	return [
		{
			ruleId: "toolchain/wrong-package-manager",
			severity: "warning",
			message: `\`${cmd.text}\` uses ${cmd.pm}, but this repo uses ${expected} (lockfile)`,
			filePath,
			line: cmd.line,
			meta: { used: cmd.pm, expected },
			suggestion: `Use \`${fix}\``,
		},
	];
}

function absentTool(cmd: CommandRef, toolchain: Toolchain, filePath: string): Diagnostic[] {
	if (cmd.kind !== "tool") return [];
	const spec = cmd.tool;
	if (hasTool(toolchain, spec.id) || !ecosystemPresent(toolchain, spec)) return [];
	const alternatives = toolchain.tools.filter(
		(t) => t.spec.ecosystem === spec.ecosystem && t.spec.roles.some((r) => spec.roles.includes(r)),
	);
	const alt = alternatives[0];
	return [
		{
			ruleId: "toolchain/absent-tool",
			severity: "warning",
			message: alt
				? `\`${cmd.text}\` runs ${spec.label}, but this repo uses ${alt.spec.label} (${describeSource(alt)})`
				: `\`${cmd.text}\` runs ${spec.label}, which this repo does not install or configure`,
			filePath,
			line: cmd.line,
			meta: { tool: spec.id, alternatives: alternatives.map((t) => t.id) },
			suggestion: alt ? `Replace with the ${alt.spec.label} command` : "Remove or fix the command",
		},
	];
}

function primaryFile(files: ParsedFile[]): ParsedFile | undefined {
	const instructions = files.filter((f) => f.kind === "instruction");
	return (
		instructions.find((f) => basename(f.path) === "CLAUDE.md") ??
		instructions.find((f) => basename(f.path) === "AGENTS.md") ??
		instructions[0]
	);
}

function undocumented(
	perFile: FileCommands[],
	toolchain: Toolchain,
	files: ParsedFile[],
): Diagnostic[] {
	const target = primaryFile(files);
	if (!target) return [];
	const all = perFile.flatMap((f) => f.commands);
	const diagnostics: Diagnostic[] = [];

	for (const tool of toolchain.tools) {
		if (all.some((cmd) => commandRunsTool(cmd, tool, toolchain))) continue;
		const wrapper = Object.entries(toolchain.scripts).find(([, body]) =>
			tool.spec.binaries.some((b) => body.includes(b)),
		);
		// A bare dependency with no config and no script is weak evidence the
		// repo's workflow uses the tool (it may be a test fixture or transitive tool).
		if (tool.source.kind === "dependency" && !wrapper) continue;
		diagnostics.push({
			ruleId: "toolchain/undocumented",
			severity: "info",
			message: `Repo uses ${tool.spec.label} (${describeSource(tool)}), but no instruction file says how to run it`,
			filePath: target.path,
			meta: { tool: tool.id },
			suggestion: wrapper
				? `Add \`${scriptCommand(toolchain, wrapper[0])}\` to the commands section`
				: `Add the ${tool.spec.label} command to the commands section`,
		});
	}

	const testScript = toolchain.scripts.test;
	const testsDocumented = all.some(
		(cmd) => cmd.kind === "script" && (cmd.script === "test" || cmd.script.startsWith("test:")),
	);
	const bunTest = perFile.some((f) => /\bbun test\b/.test(f.file.content));
	if (testScript !== undefined && !testsDocumented && !bunTest) {
		diagnostics.push({
			ruleId: "toolchain/undocumented",
			severity: "info",
			message: "package.json has a test script, but no instruction file says how to run the tests",
			filePath: target.path,
			meta: { script: "test" },
			suggestion: `Add \`${scriptCommand(toolchain, "test")}\` to the commands section`,
		});
	}
	return diagnostics;
}

/**
 * Cross-checks commands in instruction files against the repo's real
 * toolchain: package manager, package.json scripts, and lint/format/type tools.
 */
export class ToolchainCheckerRule implements LintRule {
	id = "toolchain";

	async run(ctx: LintContext): Promise<Diagnostic[]> {
		const toolchain = detectToolchain(ctx.cwd);
		const perFile = ctx.files.map((file) => ({ file, commands: extractCommands(file.tree) }));
		const diagnostics: Diagnostic[] = [];
		for (const { file, commands } of perFile) {
			for (const cmd of commands) {
				diagnostics.push(
					...missingScript(cmd, toolchain, file.path),
					...wrongPackageManager(cmd, toolchain, file.path),
					...absentTool(cmd, toolchain, file.path),
				);
			}
		}
		diagnostics.push(...undocumented(perFile, toolchain, ctx.files));
		return diagnostics;
	}
}
