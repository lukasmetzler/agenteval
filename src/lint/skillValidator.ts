import { readdirSync } from "node:fs";
import { basename, dirname } from "node:path";
import type { Diagnostic, LintContext, LintRule, ParsedFile } from "./types.js";

const NAME_MAX_LENGTH = 64;
const NAME_PATTERN = /^[a-z0-9-]+$/;
const NAME_HYPHEN_PATTERN = /^-|-$|--/;
const RESERVED_WORDS = ["anthropic", "claude"];
const DESCRIPTION_MAX_LENGTH = 1024;
const DESCRIPTION_TRUNCATION_LENGTH = 250;
// Claude Code truncates description + when_to_use in the skill listing at this length.
const LISTING_MAX_LENGTH = 1536;
const COMPATIBILITY_MAX_LENGTH = 500;
const XML_TAG_PATTERN = /<\/?[a-zA-Z][^>]*>/;
const FIRST_PERSON_PATTERN = /\b(I can|I will|I help|I am|I'll|I'm)\b/i;
const BODY_FIRST_PERSON_PATTERN =
	/\bI\s+(will|can|should|would|deploy|run|create|generate|analyze|check|build|test|fix)\b/i;
const TRIGGER_PREFIXES =
	/^(use when|use this when|use after|use before|trigger when|run when|activate when|use for)\b/i;
const SUPPORTING_FILES_LINE_THRESHOLD = 300;
const SECOND_PERSON_PATTERN = /\b(You can|You will|You should|You'll|You're)\b/i;
const MAX_BODY_LINES = 500;

// Open Agent Skills spec fields (agentskills.io/specification).
const SPEC_SKILL_FIELDS = new Set([
	"name",
	"description",
	"license",
	"compatibility",
	"metadata",
	"allowed-tools",
]);

// Claude Code extensions (code.claude.com/docs/en/skills), plus fields used by common skill packs.
const VALID_SKILL_FIELDS = new Set([
	...SPEC_SKILL_FIELDS,
	"when_to_use",
	"argument-hint",
	"arguments",
	"disable-model-invocation",
	"user-invocable",
	"disallowed-tools",
	"model",
	"effort",
	"context",
	"agent",
	"background",
	"hooks",
	"paths",
	"shell",
	"preamble-tier",
	"version",
]);

const VALID_EFFORT_VALUES = new Set(["low", "medium", "high", "xhigh", "max"]);
const VALID_CONTEXT_VALUES = new Set(["fork"]);
const VALID_SHELL_VALUES = new Set(["bash", "powershell"]);

export class SkillValidatorRule implements LintRule {
	id = "skill";

	async run(ctx: LintContext): Promise<Diagnostic[]> {
		const diagnostics: Diagnostic[] = [];

		for (const file of ctx.files) {
			if (file.kind !== "skill") continue;

			const fm = file.frontmatter;
			if (!fm) {
				diagnostics.push(this.missingFrontmatter(file));
				continue;
			}

			diagnostics.push(...this.validateName(fm, file.path));
			diagnostics.push(...this.validateDescription(fm, file.path));
			diagnostics.push(...this.validateListingLength(fm, file.path));
			diagnostics.push(...this.validateCompatibility(fm, file.path));
			diagnostics.push(...this.validateUnknownFields(fm, file.path));
			diagnostics.push(...this.validateEffort(fm, file.path));
			diagnostics.push(...this.validateContext(fm, file.path));
			diagnostics.push(...this.validateShell(fm, file.path));
			diagnostics.push(...this.validateUnreachable(fm, file.path));
			diagnostics.push(...this.validateBodyLength(file.body, file.path));
			diagnostics.push(...this.validateDescriptionTrigger(fm, file.path));
			diagnostics.push(...this.validateSupportingFiles(file.body, file.path));
			diagnostics.push(...this.validateOverviewSection(file.body, file.path));
			diagnostics.push(...this.validateBodyFirstPerson(file.body, file.path));
		}

		return diagnostics;
	}

	private missingFrontmatter(file: ParsedFile): Diagnostic {
		return {
			ruleId: "skill/frontmatter-invalid",
			severity: "error",
			message:
				"SKILL.md has no parseable YAML frontmatter. Agents load such skills with empty metadata, so they never trigger.",
			filePath: file.path,
			suggestion: "Start the file with a --- block containing at least name and description",
		};
	}

	private validateName(fm: Record<string, unknown>, filePath: string): Diagnostic[] {
		const diagnostics: Diagnostic[] = [];
		const name = fm.name;

		if (typeof name !== "string") return diagnostics;

		if (name.length > NAME_MAX_LENGTH) {
			diagnostics.push({
				ruleId: "skill/name-too-long",
				severity: "error",
				message: `Skill name "${name}" exceeds ${NAME_MAX_LENGTH} character limit (${name.length} chars)`,
				filePath,
				meta: { length: name.length, limit: NAME_MAX_LENGTH },
				suggestion: "Shorten to under 64 characters",
			});
		}

		if (!NAME_PATTERN.test(name)) {
			diagnostics.push({
				ruleId: "skill/name-invalid-chars",
				severity: "error",
				message: `Skill name "${name}" must contain only lowercase letters, numbers, and hyphens`,
				filePath,
				suggestion: "Use only lowercase letters, numbers, and hyphens",
			});
		}

		if (NAME_HYPHEN_PATTERN.test(name)) {
			diagnostics.push({
				ruleId: "skill/name-invalid-hyphens",
				severity: "error",
				message: `Skill name "${name}" must not start or end with a hyphen or contain "--"`,
				filePath,
			});
		}

		const dir = basename(dirname(filePath));
		if (basename(dirname(dirname(filePath))) === "skills" && dir !== name) {
			diagnostics.push({
				ruleId: "skill/name-directory-mismatch",
				severity: "error",
				message: `Skill name "${name}" does not match its directory "${dir}". The Agent Skills spec requires them to be equal.`,
				filePath,
				suggestion: `Rename the directory to "${name}" or set name: ${dir}`,
			});
		}

		for (const reserved of RESERVED_WORDS) {
			if (name.includes(reserved)) {
				diagnostics.push({
					ruleId: "skill/name-reserved-word",
					severity: "error",
					message: `Skill name "${name}" contains reserved word "${reserved}"`,
					filePath,
					suggestion: "Choose a name that doesn't contain 'anthropic' or 'claude'",
				});
			}
		}

		if (XML_TAG_PATTERN.test(name)) {
			diagnostics.push({
				ruleId: "skill/name-xml-tags",
				severity: "error",
				message: "Skill name must not contain XML tags",
				filePath,
			});
		}

		return diagnostics;
	}

	private validateDescription(fm: Record<string, unknown>, filePath: string): Diagnostic[] {
		const diagnostics: Diagnostic[] = [];
		const desc = fm.description;

		if (typeof desc !== "string" || desc.trim().length === 0) {
			diagnostics.push({
				ruleId: "skill/description-missing",
				severity: "error",
				message: "Skill must have a non-empty description",
				filePath,
				suggestion: "Add a description field to the YAML frontmatter",
			});
			return diagnostics;
		}

		if (desc.length > DESCRIPTION_MAX_LENGTH) {
			diagnostics.push({
				ruleId: "skill/description-too-long",
				severity: "error",
				message: `Description exceeds ${DESCRIPTION_MAX_LENGTH} character limit (${desc.length} chars)`,
				filePath,
				meta: { length: desc.length, limit: DESCRIPTION_MAX_LENGTH },
			});
		}

		if (desc.length > DESCRIPTION_TRUNCATION_LENGTH) {
			diagnostics.push({
				ruleId: "skill/description-truncation",
				severity: "info",
				message: "Description exceeds 250 characters and will be truncated in skill listings.",
				filePath,
				meta: { length: desc.length, limit: DESCRIPTION_TRUNCATION_LENGTH },
			});
		}

		if (XML_TAG_PATTERN.test(desc)) {
			diagnostics.push({
				ruleId: "skill/description-xml-tags",
				severity: "error",
				message: "Description must not contain XML tags",
				filePath,
			});
		}

		if (FIRST_PERSON_PATTERN.test(desc)) {
			diagnostics.push({
				ruleId: "skill/description-first-person",
				severity: "warning",
				message:
					'Description should use third person (e.g., "Processes files") not first person (e.g., "I can process files")',
				filePath,
				suggestion: "Rewrite as 'Generates...' instead of 'I generate...'",
			});
		}

		if (SECOND_PERSON_PATTERN.test(desc)) {
			diagnostics.push({
				ruleId: "skill/description-second-person",
				severity: "warning",
				message:
					'Description should use third person (e.g., "Processes files") not second person (e.g., "You can process files")',
				filePath,
				suggestion: "Rewrite as 'Generates...' instead of 'You can...'",
			});
		}

		return diagnostics;
	}

	private validateListingLength(fm: Record<string, unknown>, filePath: string): Diagnostic[] {
		const desc = typeof fm.description === "string" ? fm.description : "";
		const whenToUse = typeof fm.when_to_use === "string" ? fm.when_to_use : "";
		const length = desc.length + whenToUse.length;
		if (length <= LISTING_MAX_LENGTH) return [];
		return [
			{
				ruleId: "skill/listing-truncated",
				severity: "info",
				message: `description + when_to_use is ${length} characters. Claude Code truncates the skill listing entry at ${LISTING_MAX_LENGTH}.`,
				filePath,
				meta: { length, limit: LISTING_MAX_LENGTH },
			},
		];
	}

	private validateCompatibility(fm: Record<string, unknown>, filePath: string): Diagnostic[] {
		if (typeof fm.compatibility !== "string") return [];
		if (fm.compatibility.length <= COMPATIBILITY_MAX_LENGTH) return [];
		return [
			{
				ruleId: "skill/compatibility-too-long",
				severity: "error",
				message: `compatibility exceeds ${COMPATIBILITY_MAX_LENGTH} characters (${fm.compatibility.length})`,
				filePath,
				meta: { length: fm.compatibility.length, limit: COMPATIBILITY_MAX_LENGTH },
			},
		];
	}

	private validateUnknownFields(fm: Record<string, unknown>, filePath: string): Diagnostic[] {
		const diagnostics: Diagnostic[] = [];
		for (const key of Object.keys(fm)) {
			if (!VALID_SKILL_FIELDS.has(key)) {
				diagnostics.push({
					ruleId: "skill/unknown-field",
					severity: "warning",
					message: `Unknown frontmatter field '${key}'. This may be a typo.`,
					filePath,
				});
			}
		}
		return diagnostics;
	}

	private validateEffort(fm: Record<string, unknown>, filePath: string): Diagnostic[] {
		if (fm.effort === undefined) return [];
		if (typeof fm.effort !== "string" || !VALID_EFFORT_VALUES.has(fm.effort)) {
			return [
				{
					ruleId: "skill/invalid-effort",
					severity: "error",
					message: `Invalid effort value '${String(fm.effort)}'. Must be one of: low, medium, high, xhigh, max.`,
					filePath,
				},
			];
		}
		return [];
	}

	private validateContext(fm: Record<string, unknown>, filePath: string): Diagnostic[] {
		if (fm.context === undefined) return [];
		if (typeof fm.context !== "string" || !VALID_CONTEXT_VALUES.has(fm.context)) {
			return [
				{
					ruleId: "skill/invalid-context",
					severity: "error",
					message: `Invalid context value '${String(fm.context)}'. Only 'fork' is supported.`,
					filePath,
				},
			];
		}
		return [];
	}

	private validateShell(fm: Record<string, unknown>, filePath: string): Diagnostic[] {
		if (fm.shell === undefined) return [];
		if (typeof fm.shell !== "string" || !VALID_SHELL_VALUES.has(fm.shell)) {
			return [
				{
					ruleId: "skill/invalid-shell",
					severity: "error",
					message: `Invalid shell value '${String(fm.shell)}'. Must be 'bash' or 'powershell'.`,
					filePath,
				},
			];
		}
		return [];
	}

	private validateUnreachable(fm: Record<string, unknown>, filePath: string): Diagnostic[] {
		if (fm["disable-model-invocation"] === true && fm["user-invocable"] === false) {
			return [
				{
					ruleId: "skill/unreachable",
					severity: "warning",
					message:
						"Skill has both disable-model-invocation and user-invocable: false. It cannot be triggered.",
					filePath,
				},
			];
		}
		return [];
	}

	private validateBodyLength(body: string, filePath: string): Diagnostic[] {
		const bodyLines = body.split("\n").length;
		if (bodyLines > MAX_BODY_LINES) {
			return [
				{
					ruleId: "skill/body-too-long",
					severity: "warning",
					message: `SKILL.md body is ${bodyLines} lines (recommended max: ${MAX_BODY_LINES}). Consider splitting into separate files.`,
					filePath,
					meta: { lines: bodyLines, limit: MAX_BODY_LINES },
					suggestion: "Move detailed content to linked files or reduce verbosity",
				},
			];
		}

		return [];
	}

	private validateDescriptionTrigger(fm: Record<string, unknown>, filePath: string): Diagnostic[] {
		const desc = fm.description;
		if (typeof desc !== "string" || desc.trim().length === 0) return [];

		if (!TRIGGER_PREFIXES.test(desc.trim())) {
			return [
				{
					ruleId: "skill/description-not-trigger",
					severity: "info",
					message:
						"Skill description should start with trigger conditions (e.g., 'Use when...'). Descriptions that summarize the workflow cause Claude to skip reading the body.",
					filePath,
					suggestion: "Rewrite as 'Use when [specific triggering condition]'",
				},
			];
		}
		return [];
	}

	private validateSupportingFiles(body: string, filePath: string): Diagnostic[] {
		const bodyLines = body.split("\n").length;
		if (bodyLines <= SUPPORTING_FILES_LINE_THRESHOLD) return [];

		try {
			const dir = dirname(filePath);
			const files = readdirSync(dir);
			const supportingMd = files.filter((f) => f.endsWith(".md") && f.toLowerCase() !== "skill.md");
			if (supportingMd.length > 0) return [];
		} catch {
			return [];
		}

		return [
			{
				ruleId: "skill/too-long-no-supporting-files",
				severity: "info",
				message: `SKILL.md is ${bodyLines} lines. Skills over ${SUPPORTING_FILES_LINE_THRESHOLD} lines should extract heavy reference material into supporting files in the same directory.`,
				filePath,
				meta: { lines: bodyLines, threshold: SUPPORTING_FILES_LINE_THRESHOLD },
				suggestion:
					"Move reference content, examples, or templates to separate .md files alongside SKILL.md",
			},
		];
	}

	private validateOverviewSection(body: string, filePath: string): Diagnostic[] {
		if (/^##\s+overview\s*$/im.test(body)) return [];

		return [
			{
				ruleId: "skill/missing-overview-section",
				severity: "info",
				message:
					"SKILL.md is missing an '## Overview' section. Good skills start with a concise overview of their purpose.",
				filePath,
				suggestion:
					"Add a '## Overview' section after the frontmatter with 1-2 sentences explaining what this skill does",
			},
		];
	}

	private validateBodyFirstPerson(body: string, filePath: string): Diagnostic[] {
		const match = BODY_FIRST_PERSON_PATTERN.exec(body);
		if (!match) return [];

		return [
			{
				ruleId: "skill/first-person-body",
				severity: "info",
				message: `Skill body uses first-person ('${match[0]}'). Use imperative or third-person voice instead.`,
				filePath,
				suggestion: "Rewrite 'I deploy...' as 'Deploy...' or 'The skill deploys...'",
			},
		];
	}
}
