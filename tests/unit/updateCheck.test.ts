import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { $ } from "bun";

describe("update command", () => {
	test("update subcommand appears in help", async () => {
		const result = await $`bun run src/cli.ts --help`.text();
		expect(result).toContain("update");
	});

	test("update --help shows description", async () => {
		const result = await $`bun run src/cli.ts update --help`.text();
		expect(result).toContain("Self-update to the latest release");
	});
});

describe("update-check", () => {
	test("exports checkForUpdate function", async () => {
		const mod = await import(join(import.meta.dir, "../../src/update-check.ts"));
		expect(typeof mod.checkForUpdate).toBe("function");
	});

	test("checkForUpdate does not throw", async () => {
		const { checkForUpdate } = await import(join(import.meta.dir, "../../src/update-check.ts"));
		// Should complete without error regardless of network state
		await expect(checkForUpdate()).resolves.toBeUndefined();
	});
});
