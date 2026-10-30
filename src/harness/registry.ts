import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Config } from "../config/schema.js";
import { logger } from "../utils/logger.js";
import { BUILTIN_SPECS, HARNESS_ALIASES } from "./builtin.js";
import { CliAdapter } from "./cli.js";
import { GenericAdapter } from "./generic.js";
import { MockAdapter } from "./mock.js";
import type { HarnessAdapter } from "./types.js";

const SPECS = new Map(BUILTIN_SPECS.map((s) => [s.name, s]));

/** Every name `--harness` accepts: built-ins, aliases, mock, and config.harnesses keys. */
export function knownHarnesses(config: Config): string[] {
	return [
		...SPECS.keys(),
		...Object.keys(HARNESS_ALIASES),
		"mock",
		...Object.keys(config.harnesses),
	];
}

export function isKnownHarness(name: string, config: Config): boolean {
	return name === "auto" || knownHarnesses(config).includes(name);
}

/**
 * Get a harness adapter by name. A config.harnesses entry overrides a built-in
 * of the same name.
 */
export function getAdapter(name: string, config: Config): HarnessAdapter {
	const custom = config.harnesses[name];
	if (custom) {
		return new GenericAdapter({
			command: custom.command,
			args: custom.args,
			instructionPath: custom.instructionPath ?? "AGENTS.md",
		});
	}

	const alias = HARNESS_ALIASES[name];
	if (alias) logger.warn(`Harness "${name}" is deprecated, using "${alias}"`);
	const spec = SPECS.get(alias ?? name);
	if (spec) return new CliAdapter(spec);

	if (name === "mock") {
		return new MockAdapter({ filesToChange: {}, exitCode: 0, stdout: "", durationMs: 100 });
	}

	throw new Error(
		`Unknown harness: "${name}". Built-in: ${[...SPECS.keys()].join(", ")}, mock. Or define a custom one in agenteval.yaml:\n\n  harnesses:\n    ${name}:\n      command: "your-tool"\n      args: ["--run"]`,
	);
}

/**
 * Pick a harness for `harness: auto`: the first installed agent CLI whose
 * instruction file exists in the repo, else the first installed agent CLI.
 * Order follows BUILTIN_SPECS.
 */
export async function detectHarness(cwd: string, config: Config): Promise<string> {
	const installed: string[] = [];
	for (const spec of BUILTIN_SPECS) {
		if (await new CliAdapter(spec).isAvailable()) installed.push(spec.name);
	}
	if (installed.length === 0) {
		throw new Error(
			`No supported agent CLI found on PATH (${BUILTIN_SPECS.map((s) => s.binary).join(", ")}). Install one or use --harness.`,
		);
	}
	const matching = installed.find((name) => {
		const target = getAdapter(name, config).instructionTarget;
		return existsSync(join(cwd, target));
	});
	return matching ?? installed[0] ?? "claude-code";
}
