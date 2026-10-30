import { existsSync } from "node:fs";
import { isAbsolute, join, relative } from "node:path";
import type { Toolchain } from "./detect.js";
import type { ToolId } from "./tools.js";

/** One finding from a linter or type checker, normalized across tools. */
export interface ToolDiagnostic {
	tool: ToolId;
	/** Path relative to the repo root, posix separators. */
	file: string;
	line: number;
	rule: string;
	severity: "error" | "warning" | "info";
	message: string;
}

export type ToolRunResult =
	| { status: "ok"; tool: ToolId; diagnostics: ToolDiagnostic[]; durationMs: number }
	| { status: "unavailable"; tool: ToolId; reason: string }
	| { status: "failed"; tool: ToolId; reason: string };

export type ParseResult = ToolDiagnostic[] | { error: string };

interface Runner {
	id: ToolId;
	binary: string;
	/** File extensions this tool checks. */
	extensions: readonly string[];
	/** Whether to pass changed files as arguments (false = whole project, filter after). */
	perFile: boolean;
	args: (files: string[]) => string[];
	parse: (stdout: string, root: string) => ParseResult;
}

const JS_EXTENSIONS = [".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".mts", ".cts"] as const;
const TS_EXTENSIONS = [".ts", ".tsx", ".mts", ".cts"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toRepoPath(file: string, root: string): string {
	const rel = isAbsolute(file) ? relative(root, file) : file;
	return rel.split("\\").join("/").replace(/^\.\//, "");
}

function parseJson(stdout: string, opener: "{" | "["): unknown {
	// Some tools print a notice before the JSON document (oxlint: "No files found to lint.").
	const start = stdout.indexOf(opener);
	if (start === -1) throw new Error("no JSON document in output");
	return JSON.parse(stdout.slice(start));
}

function guard(parse: (stdout: string, root: string) => ToolDiagnostic[]) {
	return (stdout: string, root: string): ParseResult => {
		try {
			return parse(stdout, root);
		} catch (err) {
			return { error: err instanceof Error ? err.message : String(err) };
		}
	};
}

function asSeverity(value: unknown): ToolDiagnostic["severity"] {
	if (value === "error" || value === 2) return "error";
	if (value === "warning" || value === 1) return "warning";
	return "info";
}

// oxlint --format=json: { diagnostics: [{ message, code, severity, filename, labels[{ span{ line } }] }] }
export const parseOxlint = guard((stdout, root) => {
	const doc = parseJson(stdout, "{");
	if (!isRecord(doc) || !Array.isArray(doc.diagnostics)) throw new Error("missing diagnostics");
	return doc.diagnostics.filter(isRecord).map((d) => {
		const label = Array.isArray(d.labels) ? d.labels.find(isRecord) : undefined;
		const span = isRecord(label?.span) ? label.span : {};
		return {
			tool: "oxlint",
			file: toRepoPath(String(d.filename ?? ""), root),
			line: typeof span.line === "number" ? span.line : 0,
			rule: String(d.code ?? ""),
			severity: asSeverity(d.severity),
			message: String(d.message ?? ""),
		};
	});
});

// eslint -f json: [{ filePath, messages[{ ruleId, severity 1|2, message, line }] }]
export const parseEslint = guard((stdout, root) => {
	const doc = parseJson(stdout, "[");
	if (!Array.isArray(doc)) throw new Error("expected an array of file results");
	return doc.filter(isRecord).flatMap((file) =>
		(Array.isArray(file.messages) ? file.messages.filter(isRecord) : []).map((m) => ({
			tool: "eslint" as const,
			file: toRepoPath(String(file.filePath ?? ""), root),
			line: typeof m.line === "number" ? m.line : 0,
			rule: typeof m.ruleId === "string" ? m.ruleId : "fatal",
			severity: asSeverity(m.severity),
			message: String(m.message ?? ""),
		})),
	);
});

function record(value: unknown): Record<string, unknown> {
	return isRecord(value) ? value : {};
}

function sarifSeverity(level: unknown): ToolDiagnostic["severity"] {
	if (level === "error") return "error";
	if (level === "warning") return "warning";
	return "info";
}

function sarifResult(r: Record<string, unknown>, root: string): ToolDiagnostic {
	const loc = Array.isArray(r.locations) ? r.locations.find(isRecord) : undefined;
	const physical = record(loc?.physicalLocation);
	const uri = String(record(physical.artifactLocation).uri ?? "");
	const startLine = record(physical.region).startLine;
	return {
		tool: "biome",
		file: toRepoPath(uri.replace(/^file:\/\//, ""), root),
		line: typeof startLine === "number" ? startLine : 0,
		rule: String(r.ruleId ?? ""),
		severity: sarifSeverity(r.level),
		message: String(record(r.message).text ?? ""),
	};
}

// biome lint --reporter=sarif: SARIF 2.1.0 (Biome's JSON reporter is experimental).
export const parseBiomeSarif = guard((stdout, root) => {
	const doc = parseJson(stdout, "{");
	if (!isRecord(doc) || !Array.isArray(doc.runs)) throw new Error("not a SARIF document");
	return doc.runs
		.filter(isRecord)
		.flatMap((run) => (Array.isArray(run.results) ? run.results.filter(isRecord) : []))
		.map((r) => sarifResult(r, root));
});

// ruff check --output-format=json: [{ code, message, filename, location{ row } }]
export const parseRuff = guard((stdout, root) => {
	const doc = parseJson(stdout, "[");
	if (!Array.isArray(doc)) throw new Error("expected an array of violations");
	return doc.filter(isRecord).map((v) => {
		const location = isRecord(v.location) ? v.location : {};
		return {
			tool: "ruff",
			file: toRepoPath(String(v.filename ?? ""), root),
			line: typeof location.row === "number" ? location.row : 0,
			rule: String(v.code ?? "syntax"),
			severity: "error",
			message: String(v.message ?? ""),
		};
	});
});

// tsc --noEmit --pretty false: "path(line,col): error TS1234: message"
const TSC_LINE = /^(.+?)\((\d+),\d+\): (error|warning) (TS\d+): (.*)$/;

export function parseTsc(stdout: string, root: string): ParseResult {
	const diagnostics: ToolDiagnostic[] = [];
	for (const line of stdout.split("\n")) {
		const m = TSC_LINE.exec(line.trim());
		if (!m) continue;
		diagnostics.push({
			tool: "tsc",
			file: toRepoPath(m[1] ?? "", root),
			line: Number(m[2]),
			rule: m[4] ?? "",
			severity: m[3] === "warning" ? "warning" : "error",
			message: m[5] ?? "",
		});
	}
	return diagnostics;
}

/** Tools agenteval can run on a diff, with explicit machine-readable output flags. */
export const RUNNERS: Partial<Record<ToolId, Runner>> = {
	// Always pass --format: oxlint switches to an "agent" text format when it
	// sees agent env vars (CLAUDECODE, CODEX_SANDBOX, ...).
	oxlint: {
		id: "oxlint",
		binary: "oxlint",
		extensions: JS_EXTENSIONS,
		perFile: true,
		args: (files) => ["--format=json", ...files],
		parse: parseOxlint,
	},
	eslint: {
		id: "eslint",
		binary: "eslint",
		extensions: JS_EXTENSIONS,
		perFile: true,
		args: (files) => ["-f", "json", ...files],
		parse: parseEslint,
	},
	biome: {
		id: "biome",
		binary: "biome",
		extensions: [...JS_EXTENSIONS, ".json", ".jsonc", ".css"],
		perFile: true,
		args: (files) => ["lint", "--reporter=sarif", "--colors=off", ...files],
		parse: parseBiomeSarif,
	},
	ruff: {
		id: "ruff",
		binary: "ruff",
		extensions: [".py", ".pyi"],
		perFile: true,
		args: (files) => ["check", "--output-format=json", "--no-fix", ...files],
		parse: parseRuff,
	},
	tsc: {
		id: "tsc",
		binary: "tsc",
		extensions: TS_EXTENSIONS,
		perFile: false,
		args: () => ["--noEmit", "--pretty", "false"],
		parse: parseTsc,
	},
};

export function runnerFor(id: ToolId): Runner | undefined {
	return RUNNERS[id];
}

/**
 * Local node_modules binary first (the worktree, then any extra roots such as
 * the source repo, since worktrees lack gitignored node_modules), then PATH,
 * then `uv run` for Python tools.
 */
function resolveBinary(runner: Runner, roots: string[], toolchain: Toolchain): string[] | null {
	for (const root of roots) {
		const local = join(root, "node_modules", ".bin", runner.binary);
		if (existsSync(local)) return [local];
	}
	if (Bun.which(runner.binary)) return [runner.binary];
	if (runner.id === "ruff" && toolchain.packageManagers.includes("uv") && Bun.which("uv")) {
		return ["uv", "run", "--no-sync", "ruff"];
	}
	return null;
}

export async function runTool(options: {
	id: ToolId;
	root: string;
	files: string[];
	toolchain: Toolchain;
	timeoutMs: number;
	/** Extra directories whose node_modules/.bin may hold the tool. */
	binRoots?: string[];
}): Promise<ToolRunResult> {
	const { id, root, toolchain, timeoutMs } = options;
	const runner = runnerFor(id);
	if (!runner) return { status: "unavailable", tool: id, reason: "no runner for this tool" };

	const command = resolveBinary(runner, [root, ...(options.binRoots ?? [])], toolchain);
	if (!command)
		return { status: "unavailable", tool: id, reason: `${runner.binary} not installed` };

	const files = options.files.filter((f) => runner.extensions.some((ext) => f.endsWith(ext)));
	if (files.length === 0) return { status: "ok", tool: id, diagnostics: [], durationMs: 0 };

	const start = performance.now();
	const proc = Bun.spawn([...command, ...runner.args(runner.perFile ? files : [])], {
		cwd: root,
		stdout: "pipe",
		stderr: "pipe",
		env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0" },
	});
	const timer = setTimeout(() => proc.kill("SIGKILL"), timeoutMs);
	const [stdout, stderr, exitCode] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
		proc.exited,
	]);
	clearTimeout(timer);
	const durationMs = performance.now() - start;

	if (proc.signalCode === "SIGKILL") {
		return { status: "failed", tool: id, reason: `timed out after ${timeoutMs} ms` };
	}

	const parsed = runner.parse(stdout, root);
	if ("error" in parsed) {
		return {
			status: "failed",
			tool: id,
			reason: `exit ${exitCode}: ${parsed.error}. ${stderr.trim().slice(0, 200)}`,
		};
	}
	const wanted = new Set(files);
	const diagnostics = runner.perFile ? parsed : parsed.filter((d) => wanted.has(d.file));
	return { status: "ok", tool: id, diagnostics, durationMs };
}
