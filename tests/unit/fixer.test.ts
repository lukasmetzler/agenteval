import { describe, expect, test } from "bun:test";
import { fixFillerPhrases } from "../../src/lint/fixer.js";

describe("fixFillerPhrases", () => {
	test("removes filler in prose and tidies only the changed line", () => {
		const input = "Run tests in order to  catch bugs.\n|  a  |  b  |\n";
		const { content, fixes } = fixFillerPhrases(input);
		expect(fixes).toBe(1);
		expect(content).toBe("Run tests to catch bugs.\n|  a  |  b  |\n");
	});

	test("keeps nested list indentation and leaves code blocks untouched", () => {
		const input = [
			"- Top",
			"    - Nested: keep in mind that  spacing matters",
			"```ts",
			"const  x = 1; // in order to align",
			"```",
		].join("\n");
		const { content } = fixFillerPhrases(input);
		expect(content.split("\n")).toEqual([
			"- Top",
			"    - Nested: spacing matters",
			"```ts",
			"const  x = 1; // in order to align",
			"```",
		]);
	});

	test("drops a line that only held filler", () => {
		const { content } = fixFillerPhrases("Intro\nIt is important to note that\nNext\n\nEnd");
		expect(content).toBe("Intro\nNext\n\nEnd");
	});
});
