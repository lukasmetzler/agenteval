import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { ConfigSchema } from "../../src/config/schema.js";
import { runLint } from "../../src/lint/index.js";

const FIXTURE = resolve(import.meta.dir, "../fixtures/formats");

describe("lint across every supported file format", () => {
	test("discovers each kind and reports no frontmatter or skill errors on valid files", async () => {
		const result = await runLint(ConfigSchema.parse({ version: 1 }), FIXTURE);
		expect(result.stats.filesAnalyzed).toBe(11);
		const structural = result.diagnostics.filter((d) =>
			/^(skill|frontmatter|import|dead-ref)\//.test(d.ruleId),
		);
		expect(structural).toEqual([]);
	});
});
