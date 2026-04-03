import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { logger } from "../utils/logger.js";
import { type Config, ConfigSchema } from "./schema.js";

const CONFIG_FILENAME = "agenteval.yaml";
const MAX_WALK_DEPTH = 10;

export function findConfigFile(startDir: string): string | null {
	let current = resolve(startDir);
	let depth = 0;

	while (depth < MAX_WALK_DEPTH) {
		const candidate = join(current, CONFIG_FILENAME);
		if (existsSync(candidate)) {
			return candidate;
		}

		const parent = dirname(current);
		if (parent === current) {
			break;
		}
		current = parent;
		depth++;
	}

	return null;
}

export function parseConfigFile(filePath: string): Config {
	const raw = readFileSync(filePath, "utf-8");
	const parsed = parseYaml(raw);
	return ConfigSchema.parse(parsed);
}

export function loadConfig(cwd?: string): Config {
	const startDir = cwd ?? process.cwd();
	const configPath = findConfigFile(startDir);

	if (!configPath) {
		logger.debug("No agenteval.yaml found, using defaults. Run 'agenteval init' to create one.");
		return ConfigSchema.parse({ version: 1 });
	}

	return parseConfigFile(configPath);
}
