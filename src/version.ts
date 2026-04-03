import { readFileSync } from "node:fs";
import { join } from "node:path";

function loadVersion(): string {
	// In dev mode, read from VERSION file (always fresh)
	try {
		return readFileSync(join(import.meta.dir, "../VERSION"), "utf-8").trim();
	} catch {
		// In compiled binary, import.meta.dir doesn't work.
		// Fall through to the embedded version below.
	}

	// Embedded at build time by the build script (see package.json "build" scripts)
	// This value is replaced by a sed command before compilation.
	return "__AGENTEVAL_VERSION__";
}

export const version = loadVersion();
