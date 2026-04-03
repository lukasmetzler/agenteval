import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	DeadSectionAnalyzerRule,
	extractFileReferences,
	extractImageLinks,
	extractMarkdownLinks,
	extractReferenceLinks,
	headingToAnchor,
} from "../../src/lint/deadSectionAnalyzer.js";
import type { LintContext } from "../../src/lint/types.js";
import { defaultConfig, makeParsedFile } from "../../tests/helpers.js";

const fixturesDir = join(import.meta.dir, "../fixtures");

describe("headingToAnchor", () => {
	test("lowercases and replaces spaces with hyphens", () => {
		expect(headingToAnchor("My Cool Section")).toBe("my-cool-section");
	});

	test("strips non-alphanumeric except hyphens", () => {
		expect(headingToAnchor("What's New?")).toBe("whats-new");
	});

	test("collapses multiple hyphens", () => {
		expect(headingToAnchor("Foo  &  Bar")).toBe("foo-bar");
	});

	test("trims leading/trailing hyphens", () => {
		expect(headingToAnchor("!Hello!")).toBe("hello");
	});
});

describe("extractMarkdownLinks", () => {
	test("extracts relative links", () => {
		const links = extractMarkdownLinks("See [guide](./guide.md) for details.");
		expect(links).toHaveLength(1);
		expect(links[0].href).toBe("./guide.md");
	});

	test("ignores absolute URLs", () => {
		const links = extractMarkdownLinks("See [docs](https://example.com) for details.");
		expect(links).toHaveLength(0);
	});

	test("extracts anchor links", () => {
		const links = extractMarkdownLinks("See [section](#overview) below.");
		expect(links).toHaveLength(1);
		expect(links[0].href).toBe("#overview");
	});

	test("extracts links with anchors to other files", () => {
		const links = extractMarkdownLinks("See [section](./docs/foo.md#bar) below.");
		expect(links).toHaveLength(1);
		expect(links[0].href).toBe("./docs/foo.md#bar");
	});

	test("skips image links", () => {
		const links = extractMarkdownLinks("![alt](./image.png)");
		expect(links).toHaveLength(0);
	});

	test("reports correct line numbers", () => {
		const links = extractMarkdownLinks("Line 1\n\nSee [link](./target.md) here.\n\nLine 4");
		expect(links).toHaveLength(1);
		expect(links[0].line).toBe(3);
	});
});

describe("extractImageLinks", () => {
	test("extracts image references", () => {
		const images = extractImageLinks("![alt text](./img/screenshot.png)");
		expect(images).toHaveLength(1);
		expect(images[0].src).toBe("./img/screenshot.png");
		expect(images[0].alt).toBe("alt text");
	});

	test("ignores http image URLs", () => {
		const images = extractImageLinks("![logo](https://example.com/logo.png)");
		expect(images).toHaveLength(0);
	});

	test("reports correct line numbers", () => {
		const images = extractImageLinks("Line 1\n\n![img](./a.png)\n\nLine 4");
		expect(images).toHaveLength(1);
		expect(images[0].line).toBe(3);
	});
});

describe("extractReferenceLinks", () => {
	test("extracts usages and definitions", () => {
		const content = "See [guide][my-ref] for details.\n\n[my-ref]: ./guide.md";
		const { usages, definitions } = extractReferenceLinks(content);
		expect(usages).toHaveLength(1);
		expect(usages[0].ref).toBe("my-ref");
		expect(definitions.has("my-ref")).toBe(true);
		expect(definitions.get("my-ref")?.url).toBe("./guide.md");
	});

	test("handles implicit reference (empty brackets)", () => {
		const content = "See [my-ref][] for details.\n\n[my-ref]: ./guide.md";
		const { usages } = extractReferenceLinks(content);
		expect(usages).toHaveLength(1);
		expect(usages[0].ref).toBe("my-ref");
	});

	test("detects undefined references", () => {
		const content = "See [guide][missing-ref] for details.";
		const { usages, definitions } = extractReferenceLinks(content);
		expect(usages).toHaveLength(1);
		expect(definitions.has("missing-ref")).toBe(false);
	});
});

describe("extractFileReferences", () => {
	test("finds src/ paths", () => {
		const refs = extractFileReferences("Check the code in src/services/auth.ts for details.");
		expect(refs.length).toBeGreaterThan(0);
		expect(refs[0].path).toContain("src/");
	});

	test("finds ./ relative paths", () => {
		const refs = extractFileReferences("See ./config/settings.yaml for config.");
		expect(refs.length).toBeGreaterThan(0);
	});

	test("skips glob patterns", () => {
		const refs = extractFileReferences("Run against src/**/*.ts files.");
		expect(refs).toHaveLength(0);
	});
});

describe("DeadSectionAnalyzerRule", () => {
	const rule = new DeadSectionAnalyzerRule();

	test("flags broken markdown links", async () => {
		const file = makeParsedFile(
			"# Guide\n\nSee [missing guide](./nonexistent.md) for details.",
			join(fixturesDir, "dead-refs/test.md"),
		);
		const ctx: LintContext = { config: defaultConfig, files: [file], cwd: fixturesDir };
		const diags = await rule.run(ctx);
		expect(diags.some((d) => d.ruleId === "dead-ref/broken-link")).toBe(true);
	});

	test("flags missing file references", async () => {
		const file = makeParsedFile(
			"# Architecture\n\nSee the implementation in src/services/nonexistent.ts for details.",
			join(fixturesDir, "dead-refs/CLAUDE.md"),
		);
		const ctx: LintContext = { config: defaultConfig, files: [file], cwd: fixturesDir };
		const diags = await rule.run(ctx);
		expect(diags.some((d) => d.ruleId === "dead-ref/missing-file")).toBe(true);
	});

	test("passes when referenced files exist", async () => {
		const file = makeParsedFile(
			"# Fixtures\n\nSee [simple config](./simple/agenteval.yaml) for an example.",
			join(fixturesDir, "test.md"),
		);
		const ctx: LintContext = { config: defaultConfig, files: [file], cwd: fixturesDir };
		const diags = await rule.run(ctx);
		const brokenLinks = diags.filter((d) => d.ruleId === "dead-ref/broken-link");
		expect(brokenLinks).toHaveLength(0);
	});

	// Heading anchor tests
	test("valid heading anchor produces no diagnostic", async () => {
		const file = makeParsedFile(
			"# Guide\n\n## My Section\n\nSee [this](#my-section) above.",
			"/tmp/test-anchor.md",
		);
		const ctx: LintContext = { config: defaultConfig, files: [file], cwd: "/tmp" };
		const diags = await rule.run(ctx);
		const anchorDiags = diags.filter((d) => d.ruleId === "dead-ref/broken-anchor");
		expect(anchorDiags).toHaveLength(0);
	});

	test("broken heading anchor produces diagnostic", async () => {
		const file = makeParsedFile(
			"# Guide\n\n## My Section\n\nSee [this](#nonexistent) below.",
			"/tmp/test-anchor.md",
		);
		const ctx: LintContext = { config: defaultConfig, files: [file], cwd: "/tmp" };
		const diags = await rule.run(ctx);
		const anchorDiags = diags.filter((d) => d.ruleId === "dead-ref/broken-anchor");
		expect(anchorDiags).toHaveLength(1);
		expect(anchorDiags[0].message).toContain("#nonexistent");
	});

	test("heading anchor handles case and spaces correctly", async () => {
		const file = makeParsedFile(
			"# Guide\n\n## My Cool Section\n\nSee [this](#my-cool-section) above.",
			"/tmp/test-anchor.md",
		);
		const ctx: LintContext = { config: defaultConfig, files: [file], cwd: "/tmp" };
		const diags = await rule.run(ctx);
		const anchorDiags = diags.filter((d) => d.ruleId === "dead-ref/broken-anchor");
		expect(anchorDiags).toHaveLength(0);
	});

	// Image reference tests
	test("valid image reference produces no diagnostic", async () => {
		const tmpDir = mkdtempSync(join(tmpdir(), "agenteval-test-"));
		writeFileSync(join(tmpDir, "screenshot.png"), "fake-image-data");
		const file = makeParsedFile(
			"# Guide\n\n![screenshot](./screenshot.png)",
			join(tmpDir, "test.md"),
		);
		const ctx: LintContext = { config: defaultConfig, files: [file], cwd: tmpDir };
		const diags = await rule.run(ctx);
		const imgDiags = diags.filter(
			(d) => d.ruleId === "dead-ref/missing-file" && d.message.includes("image"),
		);
		expect(imgDiags).toHaveLength(0);
	});

	test("broken image reference produces diagnostic", async () => {
		const tmpDir = mkdtempSync(join(tmpdir(), "agenteval-test-"));
		const file = makeParsedFile("# Guide\n\n![screenshot](./missing.png)", join(tmpDir, "test.md"));
		const ctx: LintContext = { config: defaultConfig, files: [file], cwd: tmpDir };
		const diags = await rule.run(ctx);
		const imgDiags = diags.filter(
			(d) => d.ruleId === "dead-ref/missing-file" && d.message.includes("image"),
		);
		expect(imgDiags).toHaveLength(1);
	});

	test("image URL is skipped", async () => {
		const file = makeParsedFile("# Guide\n\n![logo](https://example.com/logo.png)", "/tmp/test.md");
		const ctx: LintContext = { config: defaultConfig, files: [file], cwd: "/tmp" };
		const diags = await rule.run(ctx);
		const imgDiags = diags.filter(
			(d) => d.ruleId === "dead-ref/missing-file" && d.message.includes("image"),
		);
		expect(imgDiags).toHaveLength(0);
	});

	// Cross-file heading anchor tests
	test("cross-file heading anchor validates both file and heading", async () => {
		const tmpDir = mkdtempSync(join(tmpdir(), "agenteval-test-"));
		writeFileSync(join(tmpDir, "other.md"), "# Title\n\n## Real Heading\n\nContent here.");
		const file = makeParsedFile(
			"# Guide\n\nSee [details](./other.md#real-heading) for more.",
			join(tmpDir, "test.md"),
		);
		const ctx: LintContext = { config: defaultConfig, files: [file], cwd: tmpDir };
		const diags = await rule.run(ctx);
		const anchorDiags = diags.filter((d) => d.ruleId === "dead-ref/broken-anchor");
		expect(anchorDiags).toHaveLength(0);
	});

	test("cross-file heading anchor flags missing heading", async () => {
		const tmpDir = mkdtempSync(join(tmpdir(), "agenteval-test-"));
		writeFileSync(join(tmpDir, "other.md"), "# Title\n\n## Real Heading\n\nContent here.");
		const file = makeParsedFile(
			"# Guide\n\nSee [details](./other.md#nonexistent) for more.",
			join(tmpDir, "test.md"),
		);
		const ctx: LintContext = { config: defaultConfig, files: [file], cwd: tmpDir };
		const diags = await rule.run(ctx);
		const anchorDiags = diags.filter((d) => d.ruleId === "dead-ref/broken-anchor");
		expect(anchorDiags).toHaveLength(1);
		expect(anchorDiags[0].message).toContain("#nonexistent");
		expect(anchorDiags[0].message).toContain("other.md");
	});

	// Reference-style link tests
	test("undefined reference-style link produces diagnostic", async () => {
		const file = makeParsedFile(
			"# Guide\n\nSee [the guide][missing-ref] for details.",
			"/tmp/test.md",
		);
		const ctx: LintContext = { config: defaultConfig, files: [file], cwd: "/tmp" };
		const diags = await rule.run(ctx);
		const refDiags = diags.filter((d) => d.ruleId === "dead-ref/undefined-reference");
		expect(refDiags).toHaveLength(1);
		expect(refDiags[0].message).toContain("missing-ref");
	});

	test("defined reference-style link produces no diagnostic", async () => {
		const tmpDir = mkdtempSync(join(tmpdir(), "agenteval-test-"));
		writeFileSync(join(tmpDir, "guide.md"), "# Guide\n\nContent.");
		const file = makeParsedFile(
			"# Guide\n\nSee [the guide][my-ref] for details.\n\n[my-ref]: ./guide.md",
			join(tmpDir, "test.md"),
		);
		const ctx: LintContext = { config: defaultConfig, files: [file], cwd: tmpDir };
		const diags = await rule.run(ctx);
		const refDiags = diags.filter((d) => d.ruleId === "dead-ref/undefined-reference");
		expect(refDiags).toHaveLength(0);
	});
});
