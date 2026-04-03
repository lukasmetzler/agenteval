import { parse as parseYaml } from "yaml";
import type { Diagnostic, LintContext, LintRule } from "./types.js";

const NAME_MAX_LENGTH = 64;
const NAME_PATTERN = /^[a-z0-9-]+$/;
const RESERVED_WORDS = ["anthropic", "claude"];
const DESCRIPTION_MAX_LENGTH = 1024;
const DESCRIPTION_TRUNCATION_LENGTH = 250;
const XML_TAG_PATTERN = /<\/?[a-zA-Z][^>]*>/;
const FIRST_PERSON_PATTERN = /\b(I can|I will|I help|I am|I'll|I'm)\b/i;
const SECOND_PERSON_PATTERN = /\b(You can|You will|You should|You'll|You're)\b/i;
const MAX_BODY_LINES = 500;

const VALID_SKILL_FIELDS = new Set([
	"name",
	"description",
	"argument-hint",
	"disable-model-invocation",
	"user-invocable",
	"allowed-tools",
	"model",
	"effort",
	"context",
	"agent",
	"hooks",
	"paths",
	"shell",
	"preamble-tier",
	"metadata",
	"version",
]);

const VALID_EFFORT_VALUES = new Set(["low", "medium", "high", "max"]);
const VALID_CONTEXT_VALUES = new Set(["fork"]);
const VALID_SHELL_VALUES = new Set(["bash", "powershell"]);

export class SkillValidatorRule implements LintRule {
	id = "skill";

	async run(ctx: LintContext): Promise<Diagnostic[]> {
		const diagnostics: Diagnostic[] = [];

		for (const file of ctx.files) {
			if (!file.frontmatter) continue;

			const fm = this.parseFrontmatter(file.content);
			if (!fm) continue;

			diagnostics.push(...this.validateName(fm, file.path));
			diagnostics.push(...this.validateDescription(fm, file.path));
			diagnostics.push(...this.validateUnknownFields(fm, file.path));
			diagnostics.push(...this.validateEffort(fm, file.path));
			diagnostics.push(...this.validateContext(fm, file.path));
			diagnostics.push(...this.validateShell(fm, file.path));
			diagnostics.push(...this.validateUnreachable(fm, file.path));
			diagnostics.push(...this.validateBodyLength(file.content, file.path));
		}

		return diagnostics;
	}

	private parseFrontmatter(content: string): Record<string, unknown> | null {
		const match = /^---\n([\s\S]*?)\n---/.exec(content);
		if (!match?.[1]) return null;
		try {
			return parseYaml(match[1]) as Record<string, unknown>;
		} catch {
			return null;
		}
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
					message: `Invalid effort value '${String(fm.effort)}'. Must be one of: low, medium, high, max.`,
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

	private validateBodyLength(content: string, filePath: string): Diagnostic[] {
		const bodyMatch = /^---\n[\s\S]*?\n---\n(.*)$/s.exec(content);
		if (!bodyMatch?.[1]) return [];

		const bodyLines = bodyMatch[1].split("\n").length;
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
}
