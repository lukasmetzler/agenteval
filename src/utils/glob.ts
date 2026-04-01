import { resolve } from "node:path";
import { glob } from "glob";

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
			ignore: ignore ?? [],
			nodir: true,
		});
		for (const match of matches) {
			results.add(resolve(match));
		}
	}

	return [...results].sort();
}
