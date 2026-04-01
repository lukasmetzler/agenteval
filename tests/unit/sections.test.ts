import { describe, expect, test } from "bun:test";
import { parseMarkdown } from "../../src/markdown/parser.js";
import {
	extractFrontmatter,
	extractSections,
	extractSuppressions,
} from "../../src/markdown/sections.js";

describe("extractSections", () => {
	test("splits on H1 and H2 headings", () => {
		const content =
			"# Title\n\nIntro text.\n\n## Section A\n\nContent A.\n\n## Section B\n\nContent B.";
		const tree = parseMarkdown(content);
		const sections = extractSections(tree, content);

		expect(sections).toHaveLength(3);
		expect(sections[0].heading).toBe("Title");
		expect(sections[0].depth).toBe(1);
		expect(sections[1].heading).toBe("Section A");
		expect(sections[1].depth).toBe(2);
		expect(sections[2].heading).toBe("Section B");
	});

	test("captures content between headings", () => {
		const content = "# Title\n\nSome intro.\n\n## Details\n\nDetail text here.";
		const tree = parseMarkdown(content);
		const sections = extractSections(tree, content);

		expect(sections[0].content).toContain("Some intro.");
		expect(sections[1].content).toContain("Detail text here.");
	});

	test("handles file with no headings (single blob)", () => {
		const content = "This is just plain text\nwith no headings at all.";
		const tree = parseMarkdown(content);
		const sections = extractSections(tree, content);

		expect(sections).toHaveLength(1);
		expect(sections[0].heading).toBe("(root)");
		expect(sections[0].depth).toBe(0);
		expect(sections[0].content).toBe(content);
	});

	test("line numbers are accurate", () => {
		const content = "# First\n\nParagraph.\n\n## Second\n\nMore text.";
		const tree = parseMarkdown(content);
		const sections = extractSections(tree, content);

		expect(sections[0].startLine).toBe(1);
		expect(sections[1].startLine).toBe(5);
	});

	test("handles frontmatter before first heading", () => {
		const content = "---\nname: test\n---\n\n# Title\n\nContent.";
		const tree = parseMarkdown(content);
		const sections = extractSections(tree, content);

		expect(sections).toHaveLength(1);
		expect(sections[0].heading).toBe("Title");
	});
});

describe("extractSuppressions", () => {
	test("finds agenteval-disable comments", () => {
		const content =
			"# Title\n\n<!-- agenteval-disable token-count -->\n\n## Heavy Section\n\nLots of content.";
		const tree = parseMarkdown(content);
		const suppressions = extractSuppressions(tree);

		expect(suppressions).toHaveLength(1);
		expect(suppressions[0].ruleId).toBe("token-count");
		expect(suppressions[0].line).toBe(3);
	});

	test("finds global disable (no rule id)", () => {
		const content = "# Title\n\n<!-- agenteval-disable -->\n\n## Section\n\nContent.";
		const tree = parseMarkdown(content);
		const suppressions = extractSuppressions(tree);

		expect(suppressions).toHaveLength(1);
		expect(suppressions[0].ruleId).toBeNull();
	});

	test("returns empty for no suppression comments", () => {
		const content = "# Title\n\n<!-- regular comment -->\n\nContent.";
		const tree = parseMarkdown(content);
		const suppressions = extractSuppressions(tree);

		expect(suppressions).toHaveLength(0);
	});
});

describe("extractFrontmatter", () => {
	test("extracts YAML frontmatter", () => {
		const content = "---\nname: my-skill\nversion: 1.0.0\n---\n\n# Content";
		const tree = parseMarkdown(content);
		const fm = extractFrontmatter(tree);

		expect(fm).not.toBeNull();
		expect(fm).toContain("name: my-skill");
		expect(fm).toContain("version: 1.0.0");
	});

	test("returns null when no frontmatter", () => {
		const content = "# Just a heading\n\nNo frontmatter here.";
		const tree = parseMarkdown(content);
		const fm = extractFrontmatter(tree);

		expect(fm).toBeNull();
	});

	test("extracts skill frontmatter with allowed-tools and hooks", () => {
		const content = [
			"---",
			"name: careful",
			"version: 0.1.0",
			"description: |",
			"  Safety guardrails for destructive commands.",
			"allowed-tools:",
			"  - Bash",
			"  - Read",
			"hooks:",
			"  PreToolUse:",
			'    - matcher: "Bash"',
			"---",
			"",
			"# Skill Content",
		].join("\n");
		const tree = parseMarkdown(content);
		const fm = extractFrontmatter(tree);

		expect(fm).not.toBeNull();
		expect(fm).toContain("allowed-tools");
		expect(fm).toContain("hooks");
		expect(fm).toContain("PreToolUse");
	});
});
