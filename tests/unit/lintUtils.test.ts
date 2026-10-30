import { describe, expect, test } from "bun:test";
import { stripCodeBlocks } from "../../src/lint/utils.js";

describe("stripCodeBlocks", () => {
	test("blanks fenced blocks but keeps line numbers", () => {
		const input = "line 1\n```\ncode a\ncode b\n```\nline 6 src/x.ts";
		const out = stripCodeBlocks(input);
		expect(out).not.toContain("code a");
		expect(out.split("\n")).toHaveLength(6);
		expect(out.split("\n")[5]).toBe("line 6 src/x.ts");
	});
});
