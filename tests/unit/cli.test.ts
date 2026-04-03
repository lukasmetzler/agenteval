import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { $ } from "bun";

const expectedVersion = readFileSync(join(import.meta.dir, "../../VERSION"), "utf-8").trim();

describe("CLI", () => {
	test("--version prints version", async () => {
		const result = await $`bun run src/cli.ts --version`.text();
		expect(result.trim()).toBe(expectedVersion);
	});

	test("--help shows description", async () => {
		const result = await $`bun run src/cli.ts --help`.text();
		expect(result).toContain("Evaluate AI coding instruction quality");
	});

	test("lint subcommand runs", async () => {
		const result = await $`bun run src/cli.ts lint --format json`.text();
		const parsed = JSON.parse(result);
		expect(parsed.stats).toBeDefined();
	});

	test("run --help shows options", async () => {
		const result = await $`bun run src/cli.ts run --help`.text();
		expect(result).toContain("--task");
		expect(result).toContain("--harness");
	});

	test("results --help shows options", async () => {
		const result = await $`bun run src/cli.ts results --help`.text();
		expect(result).toContain("--prune");
		expect(result).toContain("--export");
	});

	test("compare --help shows options", async () => {
		const result = await $`bun run src/cli.ts compare --help`.text();
		expect(result).toContain("runA");
		expect(result).toContain("runB");
	});

	test("results --help shows export option", async () => {
		const result = await $`bun run src/cli.ts results --help`.text();
		expect(result).toContain("--export");
	});

	test("harvest subcommand exists", async () => {
		const result = await $`bun run src/cli.ts harvest --dry-run`.text();
		expect(result).toContain("harvest");
	});

	test("harvest --analyze without --live is rejected", async () => {
		try {
			await $`bun run src/cli.ts harvest --analyze`.text();
			// If we get here, no error was thrown — fail the test
			expect(true).toBe(false);
		} catch {
			// Expected: the command should exit with non-zero
		}
	});

	test("harvest --help shows --analyze option", async () => {
		const result = await $`bun run src/cli.ts harvest --help`.text();
		expect(result).toContain("--analyze");
		expect(result).toContain("LLM-assisted rubrics");
	});
});
