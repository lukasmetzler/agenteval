import type { Root } from "mdast";
import type { Config } from "../config/schema.js";
import type { Section, SuppressionComment } from "../markdown/sections.js";

export type Severity = "error" | "warning" | "info";

export interface Diagnostic {
	ruleId: string;
	severity: Severity;
	message: string;
	filePath: string;
	line?: number;
	section?: string;
	meta?: Record<string, unknown>;
}

export interface LintResult {
	diagnostics: Diagnostic[];
	stats: {
		filesAnalyzed: number;
		totalTokens: number;
		duration: number;
	};
}

export interface LintRule {
	id: string;
	run(ctx: LintContext): Promise<Diagnostic[]>;
}

export interface LintContext {
	config: Config;
	files: ParsedFile[];
	cwd: string;
}

export interface ParsedFile {
	path: string;
	content: string;
	tree: Root;
	sections: Section[];
	suppressions: SuppressionComment[];
	tokens: number;
	frontmatter: Record<string, unknown> | null;
}
