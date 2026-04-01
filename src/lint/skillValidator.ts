import { parse as parseYaml } from "yaml";
import type { Diagnostic, LintContext, LintRule } from "./types.js";

const NAME_MAX_LENGTH = 64;
const NAME_PATTERN = /^[a-z0-9-]+$/;
const RESERVED_WORDS = ["anthropic", "claude"];
const DESCRIPTION_MAX_LENGTH = 1024;
const XML_TAG_PATTERN = /<\/?[a-zA-Z][^>]*>/;
const FIRST_PERSON_PATTERN = /\b(I can|I will|I help|I am|I'll|I'm)\b/i;
const SECOND_PERSON_PATTERN = /\b(You can|You will|You should|You'll|You're)\b/i;
const MAX_BODY_LINES = 500;

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
			});
		}

		if (!NAME_PATTERN.test(name)) {
			diagnostics.push({
				ruleId: "skill/name-invalid-chars",
				severity: "error",
				message: `Skill name "${name}" must contain only lowercase letters, numbers, and hyphens`,
				filePath,
			});
		}

		for (const reserved of RESERVED_WORDS) {
			if (name.includes(reserved)) {
				diagnostics.push({
					ruleId: "skill/name-reserved-word",
					severity: "error",
					message: `Skill name "${name}" contains reserved word "${reserved}"`,
					filePath,
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
			});
		}

		if (SECOND_PERSON_PATTERN.test(desc)) {
			diagnostics.push({
				ruleId: "skill/description-second-person",
				severity: "warning",
				message:
					'Description should use third person (e.g., "Processes files") not second person (e.g., "You can process files")',
				filePath,
			});
		}

		return diagnostics;
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
				},
			];
		}

		return [];
	}
}
