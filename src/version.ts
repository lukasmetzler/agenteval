import { readFileSync } from "node:fs";
import { join } from "node:path";

function loadVersion(): string {
	// Try reading the VERSION file (works in dev mode)
	try {
		return readFileSync(join(import.meta.dir, "../VERSION"), "utf-8").trim();
	} catch {
		// Fallback: read from package.json (bundled into compiled binary)
		try {
			const pkg = readFileSync(join(import.meta.dir, "../package.json"), "utf-8");
			const parsed = JSON.parse(pkg) as { version: string };
			return parsed.version;
		} catch {
			return "unknown";
		}
	}
}

export const version = loadVersion();
