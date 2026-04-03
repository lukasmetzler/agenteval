import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { findConfigFile, loadConfig, parseConfigFile } from "../../src/config/loader.js";

const fixturesDir = join(import.meta.dir, "../fixtures");

describe("findConfigFile", () => {
	test("finds agenteval.yaml in the given directory", () => {
		const result = findConfigFile(join(fixturesDir, "simple"));
		expect(result).not.toBeNull();
		expect(result).toContain("agenteval.yaml");
	});

	test("returns null when no config file exists", () => {
		const result = findConfigFile("/tmp");
		expect(result).toBeNull();
	});
});

describe("parseConfigFile", () => {
	test("parses valid YAML config", () => {
		const configPath = join(fixturesDir, "simple", "agenteval.yaml");
		const config = parseConfigFile(configPath);
		expect(config.version).toBe(1);
		expect(config.model).toBe("claude-sonnet-4-6");
		expect(config.instructionGlobs).toEqual(["CLAUDE.md"]);
	});
});

describe("loadConfig", () => {
	test("loads config from fixture directory", () => {
		const config = loadConfig(join(fixturesDir, "simple"));
		expect(config.version).toBe(1);
		expect(config.lint.overlapThreshold).toBe(0.3);
	});

	test("returns defaults when no config file exists", () => {
		const config = loadConfig("/tmp");
		expect(config.version).toBe(1);
		expect(config.instructionGlobs).toContain("CLAUDE.md");
		expect(config.model).toBe("claude-sonnet-4-6");
		expect(config.contextBudget).toBe(0.3);
	});
});
