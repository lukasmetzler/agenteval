import { readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";
import type { Config } from "../config/schema.js";
import { parseMarkdown } from "../markdown/parser.js";
import { extractFrontmatter, extractSections, extractSuppressions } from "../markdown/sections.js";
import { resolveInstructionFiles } from "../utils/glob.js";
import { logger } from "../utils/logger.js";
import { AntiPatternCheckerRule } from "./antiPatternChecker.js";
import { BloatScorerRule } from "./bloatScorer.js";
import { ContextBudgetCheckerRule } from "./contextBudgetChecker.js";
import { DeadSectionAnalyzerRule } from "./deadSectionAnalyzer.js";
import { DriftDetectorRule } from "./driftDetector.js";
import { OverlapDetectorRule } from "./overlapDetector.js";
import { SkillValidatorRule } from "./skillValidator.js";
import { TokenCounterRule, countTokens } from "./tokenCounter.js";
import type { Diagnostic, LintContext, LintResult, LintRule, ParsedFile } from "./types.js";

export const ALL_RULES: LintRule[] = [
	new TokenCounterRule(),
	new OverlapDetectorRule(),
	new BloatScorerRule(),
	new AntiPatternCheckerRule(),
	new DeadSectionAnalyzerRule(),
	new ContextBudgetCheckerRule(),
	new SkillValidatorRule(),
	new DriftDetectorRule(),
];

function parseFrontmatterYaml(raw: string | null): Record<string, unknown> | null {
	if (!raw) return null;
	try {
		return parseYaml(raw) as Record<string, unknown>;
	} catch {
		return null;
	}
}

function isSuppressed(diagnostic: Diagnostic, file: ParsedFile): boolean {
	for (const suppression of file.suppressions) {
		if (suppression.ruleId !== null && !diagnostic.ruleId.startsWith(suppression.ruleId)) {
			continue;
		}

		const diagLine = diagnostic.line ?? 0;
		const suppressionLine = suppression.line;

		const nextSection = file.sections.find((s) => s.startLine > suppressionLine);
		if (nextSection) {
			if (diagLine >= nextSection.startLine && diagLine <= nextSection.endLine) {
				return true;
			}
		}
	}
	return false;
}

export async function runLint(config: Config, cwd: string): Promise<LintResult> {
	const start = performance.now();

	const filePaths = await resolveInstructionFiles(config.instructionGlobs, cwd, config.lint.ignore);

	if (filePaths.length === 0) {
		logger.warn(
			`No instruction files found. Checked: ${config.instructionGlobs.join(", ")}. Create a CLAUDE.md in your project root or update instructionGlobs in agenteval.yaml.`,
		);
		return {
			diagnostics: [
				{
					ruleId: "lint/no-files",
					severity: "warning",
					message: `No instruction files found matching: ${config.instructionGlobs.join(", ")}`,
					filePath: "(none)",
				},
			],
			stats: { filesAnalyzed: 0, totalTokens: 0, duration: performance.now() - start },
		};
	}

	const files: ParsedFile[] = filePaths.map((filePath) => {
		const content = readFileSync(filePath, "utf-8");
		const tree = parseMarkdown(content);
		const sections = extractSections(tree, content);
		const suppressions = extractSuppressions(tree);
		const tokens = countTokens(content);
		const fmRaw = extractFrontmatter(tree);
		const frontmatter = parseFrontmatterYaml(fmRaw);

		for (const section of sections) {
			section.tokens = countTokens(section.content);
		}

		logger.debug(`Parsed ${filePath}: ~${tokens} tokens, ${sections.length} sections`);

		return { path: filePath, content, tree, sections, suppressions, tokens, frontmatter };
	});

	const ctx: LintContext = { config, files, cwd };

	const allDiagnostics: Diagnostic[] = [];
	for (const rule of ALL_RULES) {
		const ruleDiags = await rule.run(ctx);
		allDiagnostics.push(...ruleDiags);
	}

	const filtered = allDiagnostics.filter((d) => {
		const file = files.find((f) => f.path === d.filePath);
		if (!file) return true;
		return !isSuppressed(d, file);
	});

	const totalTokens = files.reduce((sum, f) => sum + f.tokens, 0);
	const duration = performance.now() - start;

	return {
		diagnostics: filtered,
		stats: { filesAnalyzed: files.length, totalTokens, duration },
	};
}
