import { describe, expect, test } from "bun:test";
import { $ } from "bun";

describe("CLI", () => {
	test("--version prints version", async () => {
		const result = await $`bun run src/cli.ts --version`.text();
		expect(result.trim()).toBe("0.0.1");
	});

	test("--help shows description", async () => {
		const result = await $`bun run src/cli.ts --help`.text();
		expect(result).toContain("Evaluate AI coding instruction quality");
	});

	test("lint subcommand exists", async () => {
		const result = await $`bun run src/cli.ts lint`.text();
		expect(result).toContain("not yet implemented");
	});

	test("run subcommand exists", async () => {
		const result = await $`bun run src/cli.ts run`.text();
		expect(result).toContain("not yet implemented");
	});

	test("results subcommand exists", async () => {
		const result = await $`bun run src/cli.ts results`.text();
		expect(result).toContain("not yet implemented");
	});

	test("compare subcommand exists", async () => {
		const result = await $`bun run src/cli.ts compare`.text();
		expect(result).toContain("not yet implemented");
	});

	test("harvest subcommand exists", async () => {
		const result = await $`bun run src/cli.ts harvest`.text();
		expect(result).toContain("not yet implemented");
	});
});
