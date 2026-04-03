import { describe, expect, test } from "bun:test";
import {
	buildConventionCompliancePrompt,
	buildProgressiveDisclosurePrompt,
	extractJSON,
	parseConventionComplianceResponse,
	parseProgressiveDisclosureResponse,
} from "../../src/harvest/llm-rubrics.js";

const sampleDiff = `diff --git a/src/foo.ts b/src/foo.ts
--- a/src/foo.ts
+++ b/src/foo.ts
@@ -1,3 +1,4 @@
 import { bar } from './bar';
+import { baz } from './baz';

 export function foo() {`;

const sampleInstructions = "Use tabs for indentation. Follow Biome linting rules.";

// ──────────────────────────────────────────────
// Prompt construction
// ──────────────────────────────────────────────

describe("buildConventionCompliancePrompt", () => {
	test("includes both instructions and diff", () => {
		const prompt = buildConventionCompliancePrompt(sampleDiff, sampleInstructions);
		expect(prompt).toContain(sampleInstructions);
		expect(prompt).toContain(sampleDiff);
		expect(prompt).toContain("CONVENTIONS:");
		expect(prompt).toContain("DIFF:");
		expect(prompt).toContain("compliance");
	});
});

describe("buildProgressiveDisclosurePrompt", () => {
	test("includes both instructions and diff", () => {
		const prompt = buildProgressiveDisclosurePrompt(sampleDiff, sampleInstructions);
		expect(prompt).toContain(sampleInstructions);
		expect(prompt).toContain(sampleDiff);
		expect(prompt).toContain("CONVENTIONS:");
		expect(prompt).toContain("DIFF:");
		expect(prompt).toContain("scope-appropriateness");
	});
});

// ──────────────────────────────────────────────
// extractJSON
// ──────────────────────────────────────────────

describe("extractJSON", () => {
	test("parses raw JSON", () => {
		const result = extractJSON('{"score": 8, "violations": ["Missing tests"]}');
		expect(result).toEqual({ score: 8, violations: ["Missing tests"] });
	});

	test("extracts JSON from markdown code block", () => {
		const text = 'Here\'s my analysis:\n```json\n{"score": 7, "violations": []}\n```';
		const result = extractJSON(text);
		expect(result).toEqual({ score: 7, violations: [] });
	});

	test("extracts JSON object embedded in prose", () => {
		const text =
			'Based on my review, I would rate this: {"score": 9, "violations": ["Minor issue"]}. Overall good.';
		const result = extractJSON(text);
		expect(result).toEqual({ score: 9, violations: ["Minor issue"] });
	});

	test("returns null for garbled text", () => {
		const result = extractJSON("This is not JSON at all, just plain text.");
		expect(result).toBeNull();
	});
});

// ──────────────────────────────────────────────
// parseConventionComplianceResponse
// ──────────────────────────────────────────────

describe("parseConventionComplianceResponse", () => {
	test("valid JSON — score and violations extracted", () => {
		const response = '{"score": 8, "violations": ["Missing tests"]}';
		const result = parseConventionComplianceResponse(response);
		expect(result.name).toBe("convention-compliance");
		expect(result.score).toBe(8);
		expect(result.maxScore).toBe(10);
		expect(result.details).toContain("Missing tests");
	});

	test("valid JSON with empty violations", () => {
		const response = '{"score": 10, "violations": []}';
		const result = parseConventionComplianceResponse(response);
		expect(result.score).toBe(10);
		expect(result.details).toContain("No violations found");
	});

	test("invalid JSON — fallback to score 5", () => {
		const response = "This response is garbled and has no JSON.";
		const result = parseConventionComplianceResponse(response);
		expect(result.name).toBe("convention-compliance");
		expect(result.score).toBe(5);
		expect(result.details).toContain("LLM response could not be parsed");
	});

	test("JSON embedded in text — extracts correctly", () => {
		const response = 'Here\'s my analysis:\n```json\n{"score": 7, "violations": []}\n```';
		const result = parseConventionComplianceResponse(response);
		expect(result.score).toBe(7);
	});

	test("score out of range — fallback to score 5", () => {
		const response = '{"score": 15, "violations": []}';
		const result = parseConventionComplianceResponse(response);
		expect(result.score).toBe(5);
		expect(result.details).toContain("LLM response could not be parsed");
	});
});

// ──────────────────────────────────────────────
// parseProgressiveDisclosureResponse
// ──────────────────────────────────────────────

describe("parseProgressiveDisclosureResponse", () => {
	test("valid JSON — score and issues extracted", () => {
		const response = '{"score": 6, "issues": ["Too many changes at once"]}';
		const result = parseProgressiveDisclosureResponse(response);
		expect(result.name).toBe("progressive-disclosure");
		expect(result.score).toBe(6);
		expect(result.maxScore).toBe(10);
		expect(result.details).toContain("Too many changes at once");
	});

	test("valid JSON with empty issues", () => {
		const response = '{"score": 9, "issues": []}';
		const result = parseProgressiveDisclosureResponse(response);
		expect(result.score).toBe(9);
		expect(result.details).toContain("No issues found");
	});

	test("invalid JSON — fallback to score 5", () => {
		const response = "Not parseable";
		const result = parseProgressiveDisclosureResponse(response);
		expect(result.score).toBe(5);
		expect(result.details).toContain("LLM response could not be parsed");
	});
});
