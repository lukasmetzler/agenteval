import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { ConfigSchema } from "../../src/config/schema.js";
import { runLint } from "../../src/lint/index.js";

const ROOT = resolve(import.meta.dir, "../..");

describe("skills/agenteval/SKILL.md", () => {
	test("passes agenteval's own lint with no errors or warnings", async () => {
		const config = ConfigSchema.parse({ version: 1, instructionGlobs: ["skills/**/SKILL.md"] });
		const result = await runLint(config, ROOT);
		expect(result.stats.filesAnalyzed).toBe(1);
		const blocking = result.diagnostics.filter((d) => d.severity !== "info");
		expect(blocking).toEqual([]);
	});
});
