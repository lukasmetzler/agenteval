import { describe, expect, test } from "bun:test";
import { withoutBaselineArm } from "../../src/commands/trends.js";
import { AntiPatternCheckerRule } from "../../src/lint/antiPatternChecker.js";
import { extractFileReferences, headingToAnchor } from "../../src/lint/deadSectionAnalyzer.js";
import { SkillValidatorRule } from "../../src/lint/skillValidator.js";
import type { StoredResult } from "../../src/run/types.js";
import { makeContext, makeParsedFile } from "../../tests/helpers.js";

describe("fixes from the v0.9 docs audit", () => {
	test("anchors keep repeated hyphens like GitHub", () => {
		expect(headingToAnchor("LLM-Assisted Rubrics (--analyze)")).toBe(
			"llm-assisted-rubrics---analyze",
		);
		expect(headingToAnchor("  Trials and the baseline arm ")).toBe("trials-and-the-baseline-arm");
	});

	test("a path at the end of a sentence loses its period", () => {
		expect(extractFileReferences("Edit src/auth/refresh.ts.").map((r) => r.path)).toEqual([
			"src/auth/refresh.ts",
		]);
	});

	test("anti-patterns report the matching line, not the section start", async () => {
		const file = makeParsedFile("# Intro\n\nSome context.\n\nYou are an expert engineer.\n");
		const diags = await new AntiPatternCheckerRule().run(makeContext([file]));
		expect(diags.find((d) => d.ruleId === "anti-pattern/role-play")?.line).toBe(5);
	});

	test("first-person skill descriptions with action verbs are flagged", async () => {
		const file = makeParsedFile(
			"---\nname: x\ndescription: I deploy the app to production.\n---\n\n## Overview\n",
			"SKILL.md",
		);
		const diags = await new SkillValidatorRule().run(makeContext([file]));
		expect(diags.some((d) => d.ruleId === "skill/description-first-person")).toBe(true);
	});

	test("trends leave out baseline-arm runs", () => {
		const run = (arm?: "instructions" | "baseline") =>
			({
				id: arm ?? "plain",
				trial: arm ? { group: "g", index: 1, of: 1, arm } : undefined,
			}) as StoredResult;
		expect(
			withoutBaselineArm([run(), run("instructions"), run("baseline")]).map((r) => r.id),
		).toEqual(["plain", "instructions"]);
	});
});
