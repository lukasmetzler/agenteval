import { basename } from "node:path";
import chalk from "chalk";
import type { Command } from "commander";
import { findConfigFile, loadConfig } from "../config/loader.js";
import { header, rule } from "../output/terminal.js";
import { resolveInstructionFiles } from "../utils/glob.js";

interface CheckResult {
	label: string;
	status: "pass" | "warn" | "fail";
	message: string;
}

async function spawnCheck(cmd: string, args: string[]): Promise<{ ok: boolean; stdout: string }> {
	try {
		const proc = Bun.spawn([cmd, ...args], {
			stdout: "pipe",
			stderr: "pipe",
		});
		const exitCode = await proc.exited;
		const stdout = await new Response(proc.stdout).text();
		return { ok: exitCode === 0, stdout: stdout.trim() };
	} catch {
		return { ok: false, stdout: "" };
	}
}

async function checkGit(): Promise<CheckResult> {
	const { ok, stdout } = await spawnCheck("git", ["--version"]);
	if (ok) {
		const version = stdout.replace("git version ", "");
		return { label: "git", status: "pass", message: `git found (${version})` };
	}
	return {
		label: "git",
		status: "fail",
		message: "git not found — install git from https://git-scm.com",
	};
}

async function checkRepository(): Promise<CheckResult> {
	const { ok } = await spawnCheck("git", ["rev-parse", "--show-toplevel"]);
	if (ok) {
		return { label: "repository", status: "pass", message: "git repository detected" };
	}
	return {
		label: "repository",
		status: "fail",
		message: "not a git repository — run from inside a project",
	};
}

function checkConfig(): CheckResult {
	const configPath = findConfigFile(process.cwd());
	if (configPath) {
		return { label: "config", status: "pass", message: "agenteval.yaml found" };
	}
	return {
		label: "config",
		status: "warn",
		message: "no agenteval.yaml — using defaults (run agenteval init to create one)",
	};
}

async function checkInstructions(): Promise<CheckResult> {
	const config = loadConfig();
	const files = await resolveInstructionFiles(config.instructionGlobs, process.cwd());
	if (files.length > 0) {
		const names = files.map((f) => basename(f)).join(", ");
		return {
			label: "instructions",
			status: "pass",
			message: `${files.length} instruction file${files.length === 1 ? "" : "s"} (${names})`,
		};
	}
	return {
		label: "instructions",
		status: "warn",
		message: "no instruction files found — create a CLAUDE.md in your project root",
	};
}

async function checkClaudeCli(): Promise<CheckResult> {
	const { ok } = await spawnCheck("claude", ["--version"]);
	if (ok) {
		return {
			label: "claude CLI",
			status: "pass",
			message: "claude CLI found (for eval runs and --analyze)",
		};
	}
	return {
		label: "claude CLI",
		status: "warn",
		message: "not found — needed for agenteval run and harvest --live --analyze",
	};
}

async function checkGhCli(): Promise<CheckResult> {
	const { ok } = await spawnCheck("gh", ["auth", "status"]);
	if (ok) {
		return {
			label: "gh CLI",
			status: "pass",
			message: "gh CLI authenticated (for harvest --github)",
		};
	}
	return {
		label: "gh CLI",
		status: "warn",
		message: "not available — needed for harvest --github enrichment",
	};
}

function formatCheck(result: CheckResult): string {
	const icon =
		result.status === "pass"
			? chalk.green("✓")
			: result.status === "warn"
				? chalk.yellow("○")
				: chalk.red("✗");
	const label = result.label.padEnd(20);
	const message = result.status === "fail" ? chalk.red(result.message) : chalk.dim(result.message);
	return `  ${icon}  ${label} ${message}`;
}

export function registerDoctorCommand(program: Command): void {
	program
		.command("doctor")
		.description("Check environment health and prerequisites")
		.action(async () => {
			console.log(header("agenteval doctor"));

			const results: CheckResult[] = [];
			results.push(await checkGit());
			results.push(await checkRepository());
			results.push(checkConfig());
			results.push(await checkInstructions());
			results.push(await checkClaudeCli());
			results.push(await checkGhCli());

			for (const result of results) {
				console.log(formatCheck(result));
			}

			const passed = results.filter((r) => r.status === "pass").length;
			const optional = results.filter((r) => r.status === "warn").length;
			const failed = results.filter((r) => r.status === "fail").length;

			console.log();
			console.log(rule());

			const parts: string[] = [];
			if (passed > 0) parts.push(`${passed} passed`);
			if (optional > 0) parts.push(`${optional} optional`);
			if (failed > 0) parts.push(`${failed} failed`);
			console.log(`  ${parts.join(" · ")}`);

			if (failed > 0) {
				console.log(chalk.red("  Fix the issues above before running agenteval."));
			} else {
				console.log(
					chalk.green("  Everything required is in place. You're ready to lint and harvest."),
				);
			}
			console.log();
		});
}
