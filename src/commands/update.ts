import chalk from "chalk";
import type { Command } from "commander";
import { version } from "../version.js";

const REPO = "lukasmetzler/agenteval";
const API_URL = `https://api.github.com/repos/${REPO}/releases/latest`;

function detectBinaryName(): string {
	if (process.platform === "win32") {
		throw new Error("Windows is not supported. Install via npm: npm install -g agenteval-cli");
	}

	const platform = process.platform === "darwin" ? "darwin" : "linux";
	const arch = process.arch === "arm64" ? "arm64" : "x64";

	if (platform === "linux" && arch !== "x64") {
		throw new Error(`Unsupported platform: ${platform}-${arch}. Only linux-x64 is available.`);
	}
	if (platform === "darwin" && arch !== "arm64" && arch !== "x64") {
		throw new Error(
			`Unsupported platform: ${platform}-${arch}. Only darwin-arm64 and darwin-x64 are available.`,
		);
	}

	return `agenteval-${platform}-${arch}`;
}

async function fetchLatestTag(): Promise<string> {
	const res = await fetch(API_URL);

	if (res.status === 403 || res.status === 429) {
		throw new Error("GitHub API rate limited. Try again later.");
	}
	if (!res.ok) {
		throw new Error("Failed to check for updates. Check your connection.");
	}

	const data = (await res.json()) as { tag_name: string };
	return data.tag_name;
}

function formatError(err: unknown): string {
	return err instanceof Error ? err.message : String(err);
}

async function downloadBinary(url: string, targetPath: string): Promise<void> {
	// Download to temp file first (can't overwrite a running binary directly on Linux)
	const tmpPath = `${targetPath}.tmp.${Date.now()}`;

	const download = Bun.spawn(["curl", "-fsSL", url, "-o", tmpPath], {
		stdout: "pipe",
		stderr: "pipe",
	});
	const downloadExit = await download.exited;

	if (downloadExit !== 0) {
		const stderr = await new Response(download.stderr).text();
		// Clean up temp file on failure
		Bun.spawn(["rm", "-f", tmpPath], { stdout: "pipe", stderr: "pipe" });
		if (stderr.includes("Permission denied") || stderr.includes("permission denied")) {
			throw new Error("Permission denied. Try: sudo agenteval update");
		}
		throw new Error("download-failed");
	}

	// Replace the old binary: remove then move (avoids "text file busy" on Linux)
	const rm = Bun.spawn(["rm", "-f", targetPath], { stdout: "pipe", stderr: "pipe" });
	const rmExit = await rm.exited;
	if (rmExit !== 0) {
		Bun.spawn(["rm", "-f", tmpPath], { stdout: "pipe", stderr: "pipe" });
		throw new Error("Permission denied. Try: sudo agenteval update");
	}

	const mv = Bun.spawn(["mv", tmpPath, targetPath], { stdout: "pipe", stderr: "pipe" });
	const mvExit = await mv.exited;
	if (mvExit !== 0) {
		throw new Error("Failed to replace binary. Try running the install script manually.");
	}

	const chmod = Bun.spawn(["chmod", "+x", targetPath], {
		stdout: "pipe",
		stderr: "pipe",
	});
	await chmod.exited;
}

async function runUpdate(): Promise<void> {
	let tag: string;
	try {
		tag = await fetchLatestTag();
	} catch (err) {
		console.error(chalk.red(`  ${formatError(err)}`));
		process.exit(1);
		return;
	}

	const latest = tag.replace(/^v/, "");
	if (latest === version) {
		console.log(chalk.green(`  You're on the latest version (v${version})`));
		return;
	}

	let binary: string;
	try {
		binary = detectBinaryName();
	} catch (err) {
		console.error(chalk.red(`  ${formatError(err)}`));
		process.exit(1);
		return;
	}

	const url = `https://github.com/${REPO}/releases/download/${tag}/${binary}`;
	const targetPath = process.execPath;

	console.log(chalk.dim(`  Downloading ${binary} ${tag}...`));

	try {
		await downloadBinary(url, targetPath);
	} catch (err) {
		if (formatError(err) === "download-failed") {
			console.error(chalk.red("  Download failed. Try running the install script manually:"));
			console.error(
				chalk.dim(`  curl -fsSL https://raw.githubusercontent.com/${REPO}/main/install.sh | bash`),
			);
		} else {
			console.error(chalk.red(`  ${formatError(err)}`));
		}
		process.exit(1);
		return;
	}

	console.log(chalk.green(`  Updated agenteval from v${version} to ${tag}`));
}

export function registerUpdateCommand(program: Command): void {
	program.command("update").description("Self-update to the latest release").action(runUpdate);
}
