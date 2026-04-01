import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { $ } from "bun";

const fixturesDir = join(import.meta.dir, "../fixtures");
const cli = join(import.meta.dir, "../../src/cli.ts");

async function runLint(
	cwd: string,
	args: string[] = [],
): Promise<{ stdout: string; exitCode: number }> {
	try {
		const result = await $`bun run ${cli} lint ${args}`.cwd(cwd).text();
		return { stdout: result, exitCode: 0 };
	} catch (err: unknown) {
		const shellErr = err as { stdout: Buffer; exitCode: number };
		return { stdout: shellErr.stdout?.toString() ?? "", exitCode: shellErr.exitCode };
	}
}

describe("agenteval lint (integration)", () => {
	test("clean fixture produces exit code 0", async () => {
		const { exitCode } = await runLint(join(fixturesDir, "simple"));
		expect(exitCode).toBe(0);
	});

	test("bloated fixture produces diagnostics", async () => {
		const { stdout } = await runLint(join(fixturesDir, "bloated"), ["CLAUDE.md"]);
		expect(stdout).toContain("anti-pattern");
	});

	test("--format json produces valid JSON", async () => {
		const { stdout, exitCode } = await runLint(join(fixturesDir, "simple"), ["--format", "json"]);
		expect(exitCode).toBe(0);
		const parsed = JSON.parse(stdout);
		expect(parsed.stats).toBeDefined();
		expect(parsed.diagnostics).toBeInstanceOf(Array);
	});

	test("--format markdown produces markdown", async () => {
		const { stdout, exitCode } = await runLint(join(fixturesDir, "simple"), [
			"--format",
			"markdown",
		]);
		expect(exitCode).toBe(0);
		expect(stdout).toContain("# agenteval Lint Report");
	});

	test("--severity error filters lower severities", async () => {
		const { stdout } = await runLint(join(fixturesDir, "bloated"), [
			"CLAUDE.md",
			"--severity",
			"error",
			"--format",
			"json",
		]);
		const parsed = JSON.parse(stdout);
		for (const d of parsed.diagnostics) {
			expect(d.severity).toBe("error");
		}
	});

	test("no matching files produces warning", async () => {
		const { stdout } = await runLint("/tmp", ["nonexistent-*.md", "--format", "json"]);
		const parsed = JSON.parse(stdout);
		expect(parsed.diagnostics.some((d: { ruleId: string }) => d.ruleId === "lint/no-files")).toBe(
			true,
		);
	});

	test("overlapping fixture detects overlap", async () => {
		const { stdout } = await runLint(join(fixturesDir, "overlapping"), [
			"*.md",
			"--format",
			"json",
		]);
		const parsed = JSON.parse(stdout);
		expect(
			parsed.diagnostics.some((d: { ruleId: string }) => d.ruleId === "overlap/high-similarity"),
		).toBe(true);
	});

	test("dead-refs fixture detects missing files", async () => {
		const { stdout } = await runLint(join(fixturesDir, "dead-refs"), [
			"CLAUDE.md",
			"--format",
			"json",
		]);
		const parsed = JSON.parse(stdout);
		expect(
			parsed.diagnostics.some((d: { ruleId: string }) => d.ruleId === "dead-ref/missing-file"),
		).toBe(true);
	});
});
