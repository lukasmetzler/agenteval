import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
	isJsPackageManager,
	type JsPackageManager,
	LOCKFILES,
	type PackageManager,
	TOOLS,
	type ToolId,
	type ToolRole,
	type ToolSpec,
} from "./tools.js";

export type DetectionSource =
	| { kind: "config"; file: string }
	| { kind: "package-json"; key: string }
	| { kind: "pyproject"; table: string }
	| { kind: "dependency"; name: string; version: string };

export interface DetectedTool {
	id: ToolId;
	spec: ToolSpec;
	source: DetectionSource;
}

export interface Toolchain {
	root: string;
	/** Package managers with a lockfile present, in priority order. */
	packageManagers: PackageManager[];
	/** The JS package manager the repo uses: packageManager field, else lockfile. */
	jsPackageManager: JsPackageManager | null;
	hasPackageJson: boolean;
	hasPyproject: boolean;
	scripts: Record<string, string>;
	tools: DetectedTool[];
	/** Major version of the typescript dependency (7 = native compiler). */
	typescriptMajor: number | null;
}

interface PackageJson {
	scripts: Record<string, string>;
	deps: Record<string, string>;
	keys: Set<string>;
	packageManager: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringRecord(value: unknown): Record<string, string> {
	if (!isRecord(value)) return {};
	const out: Record<string, string> = {};
	for (const [k, v] of Object.entries(value)) {
		if (typeof v === "string") out[k] = v;
	}
	return out;
}

function readPackageJson(root: string): PackageJson | null {
	const path = join(root, "package.json");
	if (!existsSync(path)) return null;
	let parsed: unknown;
	try {
		parsed = JSON.parse(readFileSync(path, "utf-8"));
	} catch {
		return null;
	}
	if (!isRecord(parsed)) return null;
	return {
		scripts: stringRecord(parsed.scripts),
		deps: {
			...stringRecord(parsed.dependencies),
			...stringRecord(parsed.devDependencies),
			...stringRecord(parsed.optionalDependencies),
		},
		keys: new Set(Object.keys(parsed)),
		packageManager: typeof parsed.packageManager === "string" ? parsed.packageManager : null,
	};
}

function readPyprojectTables(root: string): Set<string> {
	const path = join(root, "pyproject.toml");
	if (!existsSync(path)) return new Set();
	const tables = new Set<string>();
	for (const match of readFileSync(path, "utf-8").matchAll(/^\s*\[([\w.-]+)\]/gm)) {
		if (match[1]) tables.add(match[1]);
	}
	return tables;
}

function majorVersion(range: string): number | null {
	const match = /(\d+)/.exec(range);
	return match?.[1] ? Number(match[1]) : null;
}

function detectTool(
	spec: ToolSpec,
	root: string,
	pkg: PackageJson | null,
	pyTables: Set<string>,
): DetectionSource | null {
	const config = spec.configFiles.find((f) => existsSync(join(root, f)));
	if (config) return { kind: "config", file: config };
	if (spec.packageJsonKey && pkg?.keys.has(spec.packageJsonKey)) {
		return { kind: "package-json", key: spec.packageJsonKey };
	}
	const table = spec.pyprojectTable;
	if (table && [...pyTables].some((t) => t === table || t.startsWith(`${table}.`))) {
		return { kind: "pyproject", table };
	}
	const dep = spec.packages.find((name) => pkg?.deps[name] !== undefined);
	if (dep) return { kind: "dependency", name: dep, version: pkg?.deps[dep] ?? "" };
	return null;
}

/** Inspect a repo root and report its package manager, scripts, and lint/format/type tools. */
export function detectToolchain(root: string): Toolchain {
	const pkg = readPackageJson(root);
	const pyTables = readPyprojectTables(root);

	const packageManagers = [
		...new Set(LOCKFILES.filter((l) => existsSync(join(root, l.file))).map((l) => l.manager)),
	];
	const declared = pkg?.packageManager?.split("@")[0] ?? "";
	const jsPackageManager = isJsPackageManager(declared)
		? declared
		: (packageManagers.find(isJsPackageManager) ?? (pkg ? "npm" : null));

	const tools: DetectedTool[] = [];
	for (const spec of TOOLS) {
		const source = detectTool(spec, root, pkg, pyTables);
		if (source) tools.push({ id: spec.id, spec, source });
	}

	const tsRange = pkg?.deps.typescript;
	return {
		root,
		packageManagers,
		jsPackageManager,
		hasPackageJson: pkg !== null,
		hasPyproject: existsSync(join(root, "pyproject.toml")),
		scripts: pkg?.scripts ?? {},
		tools,
		typescriptMajor: tsRange ? majorVersion(tsRange) : null,
	};
}

export function hasTool(toolchain: Toolchain, id: ToolId): boolean {
	return toolchain.tools.some((t) => t.id === id);
}

export function toolsWithRole(toolchain: Toolchain, role: ToolRole): DetectedTool[] {
	return toolchain.tools.filter((t) => t.spec.roles.includes(role));
}

/** Command that runs a package.json script with the repo's package manager. */
export function scriptCommand(toolchain: Toolchain, script: string): string {
	const pm = toolchain.jsPackageManager ?? "npm";
	return `${pm} run ${script}`;
}
