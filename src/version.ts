import { readFileSync } from "node:fs";
import { join } from "node:path";

function loadVersion(): string {
	try {
		return readFileSync(join(import.meta.dir, "../VERSION"), "utf-8").trim();
	} catch {
		// Fallback for compiled binary where VERSION file is not on disk.
		// This value is updated by the bump-version script.
		return "0.7.0";
	}
}

export const version = loadVersion();
