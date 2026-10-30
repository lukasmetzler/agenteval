import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { $ } from "bun";
import { isNewerVersion, updateCheckDisabled } from "../../src/update-check.js";

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

describe("updateCheckDisabled", () => {
	test("honours CI and AGENTEVAL_NO_UPDATE_CHECK", () => {
		expect(updateCheckDisabled({})).toBe(false);
		expect(updateCheckDisabled({ CI: "true" })).toBe(true);
		expect(updateCheckDisabled({ AGENTEVAL_NO_UPDATE_CHECK: "1" })).toBe(true);
		expect(updateCheckDisabled({ AGENTEVAL_NO_UPDATE_CHECK: "0", CI: "false" })).toBe(false);
	});
});

describe("isNewerVersion", () => {
	test("compares semver numerically and never nags about older releases", () => {
		expect(isNewerVersion("0.9.1", "0.9.0")).toBe(true);
		expect(isNewerVersion("v0.10.0", "0.9.9")).toBe(true);
		expect(isNewerVersion("0.8.14", "0.9.0")).toBe(false);
		expect(isNewerVersion("0.9.0", "0.9.0")).toBe(false);
		expect(isNewerVersion("garbage", "0.9.0")).toBe(false);
	});
});
