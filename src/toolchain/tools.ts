// What agenteval knows about each toolchain component, and how to spot it in a
// repo. Sources: docs/research/2026-10-30-agent-ecosystem.md §5.

export type JsPackageManager = "bun" | "pnpm" | "yarn" | "npm";
export type PackageManager = JsPackageManager | "uv" | "poetry" | "cargo" | "go";

export const JS_PACKAGE_MANAGERS: readonly JsPackageManager[] = ["bun", "pnpm", "yarn", "npm"];

export function isJsPackageManager(pm: string): pm is JsPackageManager {
	return (JS_PACKAGE_MANAGERS as readonly string[]).includes(pm);
}

/** Lockfiles in priority order: the first one present decides the primary package manager. */
export const LOCKFILES: readonly { file: string; manager: PackageManager }[] = [
	{ file: "bun.lock", manager: "bun" },
	{ file: "bun.lockb", manager: "bun" },
	{ file: "pnpm-lock.yaml", manager: "pnpm" },
	{ file: "yarn.lock", manager: "yarn" },
	{ file: "package-lock.json", manager: "npm" },
	{ file: "uv.lock", manager: "uv" },
	{ file: "poetry.lock", manager: "poetry" },
	{ file: "Cargo.lock", manager: "cargo" },
	{ file: "go.mod", manager: "go" },
];

export type ToolId =
	| "oxlint"
	| "oxfmt"
	| "biome"
	| "eslint"
	| "prettier"
	| "tsc"
	| "ruff"
	| "ty"
	| "black"
	| "mypy";
export type ToolRole = "linter" | "formatter" | "typechecker";
export type Ecosystem = "js" | "python";

export interface ToolSpec {
	id: ToolId;
	label: string;
	roles: readonly ToolRole[];
	ecosystem: Ecosystem;
	/** Config files at the repo root that prove the tool is set up. */
	configFiles: readonly string[];
	/** package.json dependency names. */
	packages: readonly string[];
	/** pyproject.toml table, e.g. "tool.ruff". */
	pyprojectTable?: string;
	/** package.json top-level key that holds inline config. */
	packageJsonKey?: string;
	/** Executable names used on the command line. */
	binaries: readonly string[];
}

export const TOOLS: readonly ToolSpec[] = [
	{
		id: "oxlint",
		label: "oxlint",
		roles: ["linter"],
		ecosystem: "js",
		configFiles: [".oxlintrc.json", ".oxlintrc.jsonc", "oxlint.config.ts", "oxlint.config.mts"],
		packages: ["oxlint", "oxlint-tsgolint"],
		binaries: ["oxlint"],
	},
	{
		id: "oxfmt",
		label: "oxfmt",
		roles: ["formatter"],
		ecosystem: "js",
		configFiles: [".oxfmtrc.json", ".oxfmtrc.jsonc", "oxfmt.config.ts", "oxfmt.config.mts"],
		packages: ["oxfmt"],
		binaries: ["oxfmt"],
	},
	{
		id: "biome",
		label: "Biome",
		roles: ["linter", "formatter"],
		ecosystem: "js",
		configFiles: ["biome.json", "biome.jsonc", ".biome.json", ".biome.jsonc"],
		packages: ["@biomejs/biome"],
		binaries: ["biome"],
	},
	{
		id: "eslint",
		label: "ESLint",
		roles: ["linter"],
		ecosystem: "js",
		configFiles: [
			"eslint.config.js",
			"eslint.config.mjs",
			"eslint.config.cjs",
			"eslint.config.ts",
			"eslint.config.mts",
			"eslint.config.cts",
			".eslintrc",
			".eslintrc.js",
			".eslintrc.cjs",
			".eslintrc.json",
			".eslintrc.yml",
			".eslintrc.yaml",
		],
		packages: ["eslint"],
		packageJsonKey: "eslintConfig",
		binaries: ["eslint"],
	},
	{
		id: "prettier",
		label: "Prettier",
		roles: ["formatter"],
		ecosystem: "js",
		configFiles: [
			".prettierrc",
			".prettierrc.json",
			".prettierrc.yml",
			".prettierrc.yaml",
			".prettierrc.json5",
			".prettierrc.js",
			".prettierrc.mjs",
			".prettierrc.cjs",
			".prettierrc.ts",
			".prettierrc.mts",
			".prettierrc.cts",
			".prettierrc.toml",
			"prettier.config.js",
			"prettier.config.ts",
			"prettier.config.mjs",
			"prettier.config.mts",
			"prettier.config.cjs",
			"prettier.config.cts",
		],
		packages: ["prettier"],
		packageJsonKey: "prettier",
		binaries: ["prettier"],
	},
	{
		id: "tsc",
		label: "TypeScript",
		roles: ["typechecker"],
		ecosystem: "js",
		configFiles: ["tsconfig.json"],
		packages: ["typescript", "@typescript/native-preview"],
		binaries: ["tsc", "tsc6", "tsgo"],
	},
	{
		id: "ruff",
		label: "Ruff",
		roles: ["linter", "formatter"],
		ecosystem: "python",
		configFiles: ["ruff.toml", ".ruff.toml"],
		packages: [],
		pyprojectTable: "tool.ruff",
		binaries: ["ruff"],
	},
	{
		id: "ty",
		label: "ty",
		roles: ["typechecker"],
		ecosystem: "python",
		configFiles: ["ty.toml"],
		packages: [],
		pyprojectTable: "tool.ty",
		binaries: ["ty"],
	},
	{
		id: "black",
		label: "Black",
		roles: ["formatter"],
		ecosystem: "python",
		configFiles: [],
		packages: [],
		pyprojectTable: "tool.black",
		binaries: ["black"],
	},
	{
		id: "mypy",
		label: "mypy",
		roles: ["typechecker"],
		ecosystem: "python",
		configFiles: ["mypy.ini", ".mypy.ini"],
		packages: [],
		pyprojectTable: "tool.mypy",
		binaries: ["mypy"],
	},
];

const BINARY_INDEX = new Map(TOOLS.flatMap((t) => t.binaries.map((b) => [b, t] as const)));

export function toolForBinary(binary: string): ToolSpec | undefined {
	return BINARY_INDEX.get(binary);
}
