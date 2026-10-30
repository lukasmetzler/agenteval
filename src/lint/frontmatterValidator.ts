import { z } from "zod";
import type { FileKind } from "../markdown/classify.js";
import { extractFrontmatter } from "../markdown/sections.js";
import type { Diagnostic, LintContext, LintRule, ParsedFile } from "./types.js";

const globList = z.union([z.string(), z.array(z.string())]);

type ValidatedKind = Exclude<FileKind, "instruction" | "skill" | "skill-resource">;

interface KindSpec {
	label: string;
	schema: z.ZodObject;
	/** Cross-field checks that a flat schema can't express. */
	check?: (fm: Record<string, unknown>) => Omit<Diagnostic, "filePath">[];
}

const SUBAGENT_FIELDS = {
	name: z
		.string()
		.min(1)
		.max(256)
		.refine((v) => !v.includes(":"), "must not contain ':'"),
	description: z.string().min(1),
	tools: globList.optional(),
	disallowedTools: globList.optional(),
	model: z.string().optional(),
	permissionMode: z.string().optional(),
	maxTurns: z.number().int().positive().optional(),
	autoCompactWindow: z.number().optional(),
	skills: z.array(z.string()).max(32).optional(),
	mcpServers: z.unknown().optional(),
	hooks: z.unknown().optional(),
	memory: z.unknown().optional(),
	background: z.boolean().optional(),
	omitClaudeMd: z.boolean().optional(),
	effort: z.enum(["low", "medium", "high", "xhigh", "max"]).optional(),
	isolation: z.enum(["worktree"]).optional(),
	color: z.string().optional(),
	initialPrompt: z.string().optional(),
	experimental: z.unknown().optional(),
};

const SPECS: Record<ValidatedKind, KindSpec> = {
	"claude-rule": {
		label: "Claude Code rule",
		schema: z.object({ paths: globList.optional(), description: z.string().optional() }),
	},
	"copilot-path-instruction": {
		label: "Copilot path instruction",
		schema: z.object({
			applyTo: z.string().optional(),
			excludeAgent: z.enum(["code-review", "cloud-agent"]).optional(),
			name: z.string().optional(),
			description: z.string().optional(),
		}),
		check: (fm) =>
			fm.applyTo === undefined
				? [
						{
							ruleId: "frontmatter/never-applied",
							severity: "warning",
							message:
								"*.instructions.md has no applyTo glob, so Copilot never attaches it automatically.",
							suggestion: 'Add applyTo: "**/*.ts" (comma-separate multiple globs)',
						},
					]
				: [],
	},
	"cursor-rule": {
		label: "Cursor rule",
		schema: z.object({
			description: z.string().optional(),
			globs: globList.optional(),
			alwaysApply: z.boolean().optional(),
		}),
	},
	"devin-rule": {
		label: "Devin/Windsurf rule",
		schema: z.object({
			trigger: z.enum(["always_on", "glob", "model_decision", "manual"]).optional(),
			globs: globList.optional(),
			description: z.string().optional(),
		}),
		check: (fm) =>
			fm.trigger === "glob" && fm.globs === undefined
				? [
						{
							ruleId: "frontmatter/never-applied",
							severity: "warning",
							message: "trigger: glob without globs never activates.",
							suggestion: "Add globs: or change the trigger",
						},
					]
				: [],
	},
	"kiro-steering": {
		label: "Kiro steering file",
		schema: z.object({
			inclusion: z.enum(["always", "fileMatch", "manual", "auto"]).optional(),
			fileMatchPattern: globList.optional(),
			name: z.string().optional(),
			description: z.string().optional(),
		}),
		check: (fm) => {
			if (fm.inclusion === "fileMatch" && fm.fileMatchPattern === undefined) {
				return [
					{
						ruleId: "frontmatter/never-applied",
						severity: "error",
						message: "inclusion: fileMatch requires fileMatchPattern.",
					},
				];
			}
			if (fm.inclusion === "auto" && (fm.name === undefined || fm.description === undefined)) {
				return [
					{
						ruleId: "frontmatter/never-applied",
						severity: "error",
						message: "inclusion: auto requires both name and description.",
					},
				];
			}
			return [];
		},
	},
	subagent: {
		label: "subagent",
		schema: z.object(SUBAGENT_FIELDS),
	},
	command: {
		label: "slash command",
		schema: z.object({
			description: z.string().optional(),
			"argument-hint": z.string().optional(),
			"allowed-tools": globList.optional(),
			model: z.string().optional(),
			"disable-model-invocation": z.boolean().optional(),
		}),
	},
};

function isValidatedKind(kind: FileKind): kind is ValidatedKind {
	return kind in SPECS;
}

export class FrontmatterValidatorRule implements LintRule {
	id = "frontmatter";

	async run(ctx: LintContext): Promise<Diagnostic[]> {
		const diagnostics: Diagnostic[] = [];
		for (const file of ctx.files) {
			if (!isValidatedKind(file.kind)) continue;
			diagnostics.push(...validateFile(file, SPECS[file.kind]));
		}
		return diagnostics;
	}
}

function validateFile(file: ParsedFile, spec: KindSpec): Diagnostic[] {
	const fm = file.frontmatter;
	if (fm === null) return missingFrontmatter(file, spec);
	return [
		...unknownFields(fm, spec, file.path),
		...schemaIssues(fm, spec, file.path),
		...(spec.check?.(fm) ?? []).map((d) => ({ ...d, filePath: file.path })),
	];
}

function missingFrontmatter(file: ParsedFile, spec: KindSpec): Diagnostic[] {
	if (extractFrontmatter(file.tree) !== null) {
		return [
			{
				ruleId: "frontmatter/malformed",
				severity: "error",
				message: `${spec.label} frontmatter is not a valid YAML mapping, so it is ignored.`,
				filePath: file.path,
			},
		];
	}
	if (file.kind !== "subagent") return [];
	return [
		{
			ruleId: "frontmatter/missing-required",
			severity: "error",
			message: "Subagent file has no frontmatter. name and description are required.",
			filePath: file.path,
		},
	];
}

function unknownFields(
	fm: Record<string, unknown>,
	spec: KindSpec,
	filePath: string,
): Diagnostic[] {
	const known = Object.keys(spec.schema.shape);
	return Object.keys(fm)
		.filter((key) => !known.includes(key))
		.map((key) => ({
			ruleId: "frontmatter/unknown-field",
			severity: "warning",
			message: `Unknown ${spec.label} frontmatter field '${key}'. Known: ${known.join(", ")}.`,
			filePath,
		}));
}

function schemaIssues(fm: Record<string, unknown>, spec: KindSpec, filePath: string): Diagnostic[] {
	const result = spec.schema.safeParse(fm);
	if (result.success) return [];
	return result.error.issues.map((issue) => {
		const field = issue.path.join(".");
		const missing = issue.code === "invalid_type" && fm[field] === undefined;
		return {
			ruleId: missing ? "frontmatter/missing-required" : "frontmatter/invalid-value",
			severity: "error",
			message: missing
				? `${spec.label} requires '${field}'.`
				: `Invalid ${spec.label} field '${field}': ${issue.message}`,
			filePath,
		};
	});
}
