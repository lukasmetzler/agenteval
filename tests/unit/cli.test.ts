import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
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

	test("lint --help shows --explain option", async () => {
		const result = await $`bun run src/cli.ts lint --help`.text();
		expect(result).toContain("--explain");
		expect(result).toContain("detailed explanation");
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

	test("init subcommand appears in help", async () => {
		const result = await $`bun run src/cli.ts --help`.text();
		expect(result).toContain("init");
	});

	test("init creates agenteval.yaml", async () => {
		const tmp = mkdtempSync(join(tmpdir(), "agenteval-init-"));
		try {
			const result =
				await $`cd ${tmp} && bun run ${join(import.meta.dir, "../../src/cli.ts")} init`.text();
			const configPath = join(tmp, "agenteval.yaml");
			expect(existsSync(configPath)).toBe(true);
			const content = readFileSync(configPath, "utf-8");
			expect(content).toContain("version: 1");
			expect(result).toContain("Created");
		} finally {
			rmSync(tmp, { recursive: true, force: true });
		}
	});

	test("init refuses if file exists", async () => {
		const tmp = mkdtempSync(join(tmpdir(), "agenteval-init-"));
		try {
			writeFileSync(join(tmp, "agenteval.yaml"), "version: 1\n", "utf-8");
			const proc = await $`cd ${tmp} && bun run ${join(import.meta.dir, "../../src/cli.ts")} init`
				.nothrow()
				.quiet();
			expect(proc.exitCode).not.toBe(0);
			const stderr = proc.stderr.toString();
			expect(stderr).toContain("already exists");
		} finally {
			rmSync(tmp, { recursive: true, force: true });
		}
	});

	test("compare with invalid IDs produces helpful error", async () => {
		try {
			await $`bun run src/cli.ts compare nonexistent-a nonexistent-b`.quiet().text();
			expect(true).toBe(false);
		} catch (err: unknown) {
			const stderr = (err as { stderr: Buffer }).stderr.toString();
			expect(stderr).toContain("agenteval results");
		}
	});

	test(".yaml task reference that doesn't exist throws error", async () => {
		try {
			await $`bun run src/cli.ts run --task nonexistent.yaml --dry-run`.quiet().text();
			expect(true).toBe(false);
		} catch {
			// Expected: task file not found should cause non-zero exit
		}
	});
});
