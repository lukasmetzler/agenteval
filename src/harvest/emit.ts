import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { stringify as yamlStringify } from "yaml";
import type { TaskDefinition } from "../run/types.js";
import type { PRInfo } from "./github.js";
import type { AICommit, HarvestOptions } from "./types.js";

/** Conventional commit prefixes to strip from prompts. */
const COMMIT_PREFIX =
	/^(feat|fix|chore|refactor|docs|test|ci|style|perf|build|revert)(\(.+?\))?:\s*/i;

/** Simple past-tense to imperative conversions. */
const PAST_TO_IMPERATIVE: [RegExp, string][] = [
	[/^added\b/i, "Add"],
	[/^fixed\b/i, "Fix"],
	[/^updated\b/i, "Update"],
	[/^removed\b/i, "Remove"],
	[/^changed\b/i, "Change"],
	[/^implemented\b/i, "Implement"],
	[/^refactored\b/i, "Refactor"],
	[/^created\b/i, "Create"],
	[/^improved\b/i, "Improve"],
	[/^moved\b/i, "Move"],
	[/^renamed\b/i, "Rename"],
	[/^extracted\b/i, "Extract"],
	[/^replaced\b/i, "Replace"],
	[/^enabled\b/i, "Enable"],
	[/^disabled\b/i, "Disable"],
	[/^wired\b/i, "Wire"],
];

/**
 * Infer a task prompt from a commit message.
 * Strips conventional-commit prefix, converts past-tense to imperative,
 * and appends diff summary if the result is too terse.
 */
function inferPrompt(commit: AICommit): string {
	let prompt = commit.message.replace(COMMIT_PREFIX, "").trim();

	// Convert past-tense to imperative
	for (const [pattern, replacement] of PAST_TO_IMPERATIVE) {
		if (pattern.test(prompt)) {
			prompt = prompt.replace(pattern, replacement);
			break;
		}
	}

	// Capitalize first letter
	if (prompt.length > 0) {
		prompt = prompt.charAt(0).toUpperCase() + prompt.slice(1);
	}

	// If terse, append diff summary for context
	if (prompt.length < 20) {
		const { additions, deletions, filesChanged } = commit.diffStat;
		prompt += `\n\nFiles changed: ${filesChanged}. +${additions}/-${deletions} lines.`;
	}

	return prompt;
}

/** Test file detection pattern: matches test, spec, or __tests__ in the path. */
const TEST_FILE_PATTERN = /(?:test|spec|__tests__)/;

/**
 * Detect the appropriate test command for a repository.
 * Reads package.json scripts.test and checks for bun indicators.
 * Falls back to "bun test" if detection fails.
 */
export function detectTestCommand(repoPath?: string): string {
	const fallback = "bun test";
	if (!repoPath) return fallback;

	try {
		const pkgPath = join(repoPath, "package.json");
		if (!existsSync(pkgPath)) return fallback;

		const raw = readFileSync(pkgPath, "utf-8");
		const pkg = JSON.parse(raw) as {
			scripts?: Record<string, string>;
		};
		const testScript = pkg.scripts?.test;

		if (testScript) {
			return testScript;
		}

		// No test script — check for bun indicators
		const hasBun =
			existsSync(join(repoPath, "bunfig.toml")) ||
			existsSync(join(repoPath, "bun.lockb")) ||
			existsSync(join(repoPath, "bun.lock"));
		if (hasBun) return "bun test";

		return "npm test";
	} catch {
		return fallback;
	}
}

export interface EmitMetadata {
	snapshot?: Record<string, string>;
	prInfo?: PRInfo;
}

/**
 * Convert an AICommit into a TaskDefinition object.
 */
export function emitTaskYaml(
	commit: AICommit,
	options: Pick<HarvestOptions, "harness" | "timeout">,
	metadata?: EmitMetadata,
	repoPath?: string,
): TaskDefinition {
	const assertions: TaskDefinition["assertions"] = commit.filesChanged.map((file) => ({
		type: "files-changed" as const,
		pattern: file,
	}));

	// Detect test files in the diff and add a test-pass assertion
	const hasTestFiles = commit.filesChanged.some((f) => TEST_FILE_PATTERN.test(f));
	if (hasTestFiles) {
		assertions.push({
			type: "test-pass" as const,
			command: detectTestCommand(repoPath),
		});
	}

	let prompt = inferPrompt(commit);

	// Enrich terse prompts with PR body context
	const strippedPrompt = commit.message.replace(COMMIT_PREFIX, "").trim();
	if (metadata?.prInfo?.body && strippedPrompt.length < 20 && metadata.prInfo.body.length > 0) {
		prompt += `\n\nPR context:\n${metadata.prInfo.body}`;
	}

	const task: TaskDefinition = {
		name: `harvest-${commit.shortHash}`,
		description: commit.message,
		prompt,
		harness: options.harness ?? "auto",
		timeout: options.timeout ?? 300,
		assertions,
		scoring: {
			correctness: 0.5,
			precision: 0.3,
			efficiency: 0.1,
			conventions: 0.1,
		},
	};

	if (metadata?.prInfo) {
		task.prUrl = metadata.prInfo.url;
		task.prBody = metadata.prInfo.body;
	}

	if (metadata?.snapshot) {
		task.instructionSnapshot = metadata.snapshot;
		task.sourceCommit = commit.hash;
		task.detectionConfidence = commit.confidence;
		task.harvestDate = new Date().toISOString();
	}

	return task;
}

/**
 * Write a TaskDefinition to a YAML file.
 * Returns the file path on success, null if skipped (file exists + no force).
 */
export function writeTaskFile(
	task: TaskDefinition,
	outputDir: string,
	force: boolean,
): string | null {
	mkdirSync(outputDir, { recursive: true });

	const filePath = join(outputDir, `${task.name}.yaml`);

	if (existsSync(filePath) && !force) {
		return null;
	}

	try {
		writeFileSync(filePath, yamlStringify(task), "utf-8");
		return filePath;
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		process.stderr.write(`Warning: failed to write ${filePath}: ${msg}\n`);
		return null;
	}
}
