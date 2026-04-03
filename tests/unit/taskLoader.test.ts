import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { loadTask } from "../../src/run/task-loader.js";

const fixturesDir = join(import.meta.dir, "../fixtures");
const tasksDir = join(fixturesDir, "tasks");

describe("loadTask", () => {
	test("loads task from YAML file path", () => {
		const task = loadTask(join(tasksDir, "example.yaml"), fixturesDir);
		expect(task.name).toBe("example-refactor");
		expect(task.description).toContain("structured logger");
		expect(task.prompt).toContain("console.log");
		expect(task.timeout).toBe(120);
		expect(task.assertions).toHaveLength(3);
		expect(task.scoring.correctness).toBe(0.4);
	});

	test("loads minimal task with defaults", () => {
		const task = loadTask(join(tasksDir, "minimal.yaml"), fixturesDir);
		expect(task.name).toBe("minimal-task");
		expect(task.timeout).toBe(300);
		expect(task.harness).toBe("auto");
		expect(task.assertions).toHaveLength(0);
		expect(task.scoring.correctness).toBe(0.4);
		expect(task.prompt).toBe(task.description);
	});

	test("resolves task by name from tasks/ directory", () => {
		const task = loadTask("example", fixturesDir);
		expect(task.name).toBe("example-refactor");
	});

	test("creates ad-hoc task from inline description", () => {
		const task = loadTask("refactor the auth module", fixturesDir);
		expect(task.name).toBe("ad-hoc");
		expect(task.prompt).toBe("refactor the auth module");
		expect(task.assertions).toHaveLength(0);
		expect(task.harness).toBe("auto");
	});

	test("throws on invalid YAML schema", () => {
		expect(() => loadTask(join(tasksDir, "invalid.yaml"), fixturesDir)).toThrow();
	});

	test("prompt defaults to description when omitted", () => {
		const task = loadTask(join(tasksDir, "minimal.yaml"), fixturesDir);
		expect(task.prompt).toBe("A minimal task with only required fields");
	});

	test("loads harvested task with extended fields", () => {
		const task = loadTask(join(tasksDir, "harvested.yaml"), fixturesDir);
		expect(task.name).toBe("harvest-abc123d");
		expect(task.sourceCommit).toBe("abc123def456");
		expect(task.detectionConfidence).toBe(0.9);
		expect(task.harvestDate).toBe("2026-01-15T10:00:00Z");
		expect(task.prUrl).toBe("https://github.com/example/repo/pull/42");
		expect(task.prBody).toContain("JWT-based authentication");
		expect(task.instructionSnapshot).toBeDefined();
		expect(task.instructionSnapshot?.["CLAUDE.md"]).toContain("TypeScript strict mode");
	});

	test("extended fields are optional (existing tasks still load)", () => {
		const task = loadTask(join(tasksDir, "example.yaml"), fixturesDir);
		expect(task.sourceCommit).toBeUndefined();
		expect(task.instructionSnapshot).toBeUndefined();
		expect(task.prUrl).toBeUndefined();
		expect(task.detectionConfidence).toBeUndefined();
	});

	test("assertion types are validated", () => {
		const task = loadTask(join(tasksDir, "example.yaml"), fixturesDir);
		const types = task.assertions.map((a) => a.type);
		expect(types).toContain("files-changed");
		expect(types).toContain("test-pass");
		expect(types).toContain("convention");
	});
});
