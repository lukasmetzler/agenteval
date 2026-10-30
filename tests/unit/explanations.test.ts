import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { RULE_EXPLANATIONS } from "../../src/lint/explanations.js";

const LINT_DIR = join(import.meta.dir, "../../src/lint");
const RULE_ID =
	/"((?:lint|token-count|overlap|bloat|anti-pattern|dead-ref|context-budget|skill|frontmatter|import|agent-limits|toolchain|drift)\/[a-z0-9-]+)"/g;

describe("--explain coverage", () => {
	test("every rule id emitted in src/lint has an explanation", () => {
		const ids = new Set<string>();
		for (const file of readdirSync(LINT_DIR)) {
			if (file === "explanations.ts") continue;
			for (const m of readFileSync(join(LINT_DIR, file), "utf-8").matchAll(RULE_ID)) {
				if (m[1]) ids.add(m[1]);
			}
		}
		expect(ids.size).toBeGreaterThan(50);
		expect([...ids].filter((id) => !RULE_EXPLANATIONS[id])).toEqual([]);
	});
});
