import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { z } from "zod";
import type { TaskDefinition } from "./types.js";

const TaskAssertionSchema = z.object({
	type: z.enum(["files-changed", "files-unchanged", "test-pass", "no-new-warnings", "convention"]),
	pattern: z.string().optional(),
	command: z.string().optional(),
	expect: z.string().optional(),
});

const ScoringWeightsSchema = z.object({
	correctness: z.number().min(0).max(1).default(0.4),
	precision: z.number().min(0).max(1).default(0.3),
	efficiency: z.number().min(0).max(1).default(0.2),
	conventions: z.number().min(0).max(1).default(0.1),
});

const TaskDefinitionSchema = z.object({
	name: z.string(),
	description: z.string(),
	prompt: z.string().optional(),
	harness: z
		.enum(["claude-code", "cursor", "opencode", "copilot", "generic", "auto"])
		.default("auto"),
	timeout: z.number().min(1).default(300),
	assertions: z.array(TaskAssertionSchema).default([]),
	scoring: ScoringWeightsSchema.default(ScoringWeightsSchema.parse({})),
	sourceCommit: z.string().optional(),
	instructionSnapshot: z.record(z.string(), z.string()).optional(),
	prUrl: z.string().optional(),
	prBody: z.string().optional(),
	detectionConfidence: z.number().min(0).max(1).optional(),
	harvestDate: z.string().optional(),
});

/**
 * Load a task definition from a YAML file path, task name, or inline description.
 *
 * Resolution order:
 * 1. If taskRef is a path to an existing YAML file -> parse it
 * 2. If taskRef matches a file in the tasks/ directory -> parse it
 * 3. Otherwise treat taskRef as an inline task description (ad-hoc, no assertions)
 */
export function loadTask(taskRef: string, cwd: string): TaskDefinition {
	const asPath = resolve(cwd, taskRef);
	if (existsSync(asPath) && (asPath.endsWith(".yaml") || asPath.endsWith(".yml"))) {
		return parseTaskFile(asPath);
	}

	const tasksDir = join(cwd, "tasks");
	for (const ext of [".yaml", ".yml"]) {
		const candidate = join(tasksDir, `${taskRef}${ext}`);
		if (existsSync(candidate)) {
			return parseTaskFile(candidate);
		}
	}

	// If it looks like a file reference, it's probably a typo — don't silently create ad-hoc
	if (taskRef.endsWith(".yaml") || taskRef.endsWith(".yml") || taskRef.includes("/")) {
		throw new Error(
			`Task file not found: "${taskRef}". Check the path or list harvested tasks in tasks/harvested/`,
		);
	}

	return createAdHocTask(taskRef);
}

function parseTaskFile(filePath: string): TaskDefinition {
	const raw = readFileSync(filePath, "utf-8");
	const parsed = parseYaml(raw);
	const validated = TaskDefinitionSchema.parse(parsed);

	return {
		...validated,
		prompt: validated.prompt ?? validated.description,
	};
}

function createAdHocTask(description: string): TaskDefinition {
	return {
		name: "ad-hoc",
		description,
		prompt: description,
		harness: "auto",
		timeout: 300,
		assertions: [],
		scoring: {
			correctness: 0.4,
			precision: 0.3,
			efficiency: 0.2,
			conventions: 0.1,
		},
	};
}
