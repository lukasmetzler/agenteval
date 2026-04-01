import { describe, expect, test } from "bun:test";
import { parseMarkdown } from "../../src/markdown/parser.js";

describe("parseMarkdown", () => {
	test("parses headings", () => {
		const tree = parseMarkdown("# Title\n\n## Subtitle\n\nContent here.");
		const headings = tree.children.filter((n) => n.type === "heading");
		expect(headings).toHaveLength(2);
	});

	test("parses YAML frontmatter", () => {
		const tree = parseMarkdown("---\nname: test\ndescription: a test file\n---\n\n# Title\n");
		const yamlNodes = tree.children.filter((n) => n.type === "yaml");
		expect(yamlNodes).toHaveLength(1);
		expect((yamlNodes[0] as { value: string }).value).toContain("name: test");
	});

	test("parses code blocks", () => {
		const tree = parseMarkdown("# Code\n\n```typescript\nconst x = 1;\n```\n");
		const codeBlocks = tree.children.filter((n) => n.type === "code");
		expect(codeBlocks).toHaveLength(1);
	});

	test("handles empty input", () => {
		const tree = parseMarkdown("");
		expect(tree.type).toBe("root");
		expect(tree.children).toHaveLength(0);
	});

	test("handles input with only frontmatter", () => {
		const tree = parseMarkdown("---\nname: test\n---\n");
		expect(tree.children).toHaveLength(1);
		expect(tree.children[0].type).toBe("yaml");
	});

	test("parses skill frontmatter with allowed-tools", () => {
		const tree = parseMarkdown(
			[
				"---",
				"name: my-skill",
				"version: 1.0.0",
				"description: |",
				"  A test skill for evaluation.",
				"allowed-tools:",
				"  - Bash",
				"  - Read",
				"---",
				"",
				"# Skill Content",
			].join("\n"),
		);
		const yamlNodes = tree.children.filter((n) => n.type === "yaml");
		expect(yamlNodes).toHaveLength(1);
		expect((yamlNodes[0] as { value: string }).value).toContain("allowed-tools");
	});
});
