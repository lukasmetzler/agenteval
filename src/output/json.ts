import type { LintResult } from "../lint/types.js";
import type { OutputFormatter } from "./formatter.js";

export class JsonFormatter implements OutputFormatter {
	format(result: LintResult): string {
		return JSON.stringify(result, null, 2);
	}
}
