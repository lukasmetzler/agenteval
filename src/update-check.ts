import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import chalk from "chalk";
import { version } from "./version.js";

const REPO = "lukasmetzler/agenteval";
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

/** Skip the network check in CI and when the user opts out with AGENTEVAL_NO_UPDATE_CHECK=1. */
export function updateCheckDisabled(
	env: Record<string, string | undefined> = process.env,
): boolean {
	const truthy = (v: string | undefined) =>
		v !== undefined && v !== "" && v !== "0" && v !== "false";
	return truthy(env.AGENTEVAL_NO_UPDATE_CHECK) || truthy(env.CI);
}

export async function checkForUpdate(): Promise<void> {
	if (updateCheckDisabled()) return;
	try {
		const dir = join(homedir(), ".agenteval");
		const checkFile = join(dir, "last-update-check");
		const notifyFile = join(dir, "update-available");

		// Show pending notification (from a previous check)
		if (existsSync(notifyFile)) {
			const newVersion = readFileSync(notifyFile, "utf-8").trim();
			if (newVersion !== version) {
				process.stderr.write(
					chalk.dim(
						`  Update available: ${chalk.white(newVersion)} (current: ${version}). Run: agenteval update\n`,
					),
				);
			}
			rmSync(notifyFile);
			return;
		}

		// Check if we already checked today
		if (existsSync(checkFile)) {
			const lastCheck = statSync(checkFile).mtimeMs;
			if (Date.now() - lastCheck < CHECK_INTERVAL_MS) return;
		}

		// Do the check (with timeout)
		mkdirSync(dir, { recursive: true });
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 2000);

		const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
			signal: controller.signal,
		});
		clearTimeout(timeout);

		if (res.ok) {
			const data = (await res.json()) as { tag_name: string };
			const latest = data.tag_name.replace(/^v/, "");
			writeFileSync(checkFile, new Date().toISOString());

			if (latest !== version) {
				writeFileSync(notifyFile, latest);
			}
		}
	} catch {
		// Silently ignore all errors — update check must never affect the main command
	}
}
