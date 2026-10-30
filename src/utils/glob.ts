import { resolve } from "node:path";
import { glob } from "glob";

/** Never lint vendored code, build output, or agenteval's own worktree copies. */
export const DEFAULT_IGNORE = [
	"**/node_modules/**",
	"**/.git/**",
	"**/dist/**",
	"**/.agenteval/**",
];

export async function resolveInstructionFiles(
	patterns: string[],
	cwd: string,
	ignore?: string[],
): Promise<string[]> {
	const results = new Set<string>();

	for (const pattern of patterns) {
		const matches = await glob(pattern, {
			cwd,
			absolute: true,
			ignore: [...DEFAULT_IGNORE, ...(ignore ?? [])],
			nodir: true,
		});
		for (const match of matches) {
			results.add(resolve(match));
		}
	}

	return [...results].sort();
}
