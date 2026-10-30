import type { CliHarnessSpec } from "./cli.js";
import {
	parseAntigravityJson,
	parseClaudeResult,
	parseCodexEvents,
	parseGeminiJson,
	parseOpenCodeEvents,
	unavailableMetrics,
} from "./jsonl.js";

const model = (flag: string, value: string | undefined) => (value ? [flag, value] : []);

// Headless invocations per vendor docs, checked 2026-10 (see
// docs/research/2026-10-30-agent-ecosystem.md §3). claude, codex and opencode
// flags were also verified against `--help` of the installed CLIs.
export const BUILTIN_SPECS: readonly CliHarnessSpec[] = [
	{
		name: "claude-code",
		binary: "claude",
		instructionTarget: "CLAUDE.md",
		// Not --bare: it skips CLAUDE.md, which is what we are evaluating.
		// Since v2.1.302 -p starts in manual mode, so the mode is explicit.
		args: (o) => [
			"-p",
			"--output-format",
			"json",
			"--permission-mode",
			"bypassPermissions",
			"--no-session-persistence",
			...model("--model", o.model),
		],
		prompt: "stdin",
		parseMetrics: (raw) => parseClaudeResult(raw.stdout),
	},
	{
		name: "codex",
		binary: "codex",
		instructionTarget: "AGENTS.md",
		args: (o) => [
			"exec",
			"--json",
			"-s",
			"workspace-write",
			"--skip-git-repo-check",
			"--ephemeral",
			...model("-m", o.model),
			"-",
		],
		prompt: "stdin",
		parseMetrics: (raw) => parseCodexEvents(raw.stdout),
	},
	{
		name: "gemini",
		binary: "gemini",
		instructionTarget: "GEMINI.md",
		args: (o) => ["-o", "json", "--approval-mode", "yolo", ...model("-m", o.model), "-p"],
		prompt: "last-arg",
		parseMetrics: (raw) => parseGeminiJson(raw.stdout),
	},
	{
		name: "antigravity",
		binary: "agy",
		instructionTarget: "GEMINI.md",
		args: (o) => [
			"--output-format",
			"json",
			"--dangerously-skip-permissions",
			...model("--model", o.model),
			"-p",
		],
		prompt: "last-arg",
		parseMetrics: (raw) => parseAntigravityJson(raw.stdout),
	},
	{
		name: "copilot",
		binary: "copilot",
		instructionTarget: ".github/copilot-instructions.md",
		// Copilot CLI's JSON output is undocumented, so no metrics.
		args: (o) => ["--allow-all-tools", "--no-ask-user", ...model("--model", o.model), "-p"],
		prompt: "last-arg",
		parseMetrics: () => unavailableMetrics(),
	},
	{
		name: "cursor",
		binary: "agent",
		instructionTarget: "AGENTS.md",
		// Without --force the agent only proposes changes.
		args: (o) => ["--output-format", "json", "--force", ...model("--model", o.model), "-p"],
		prompt: "last-arg",
		parseMetrics: () => unavailableMetrics(),
	},
	{
		name: "opencode",
		binary: "opencode",
		instructionTarget: "AGENTS.md",
		args: (o) => ["run", "--format", "json", "--auto", ...model("-m", o.model)],
		prompt: "last-arg",
		parseMetrics: (raw) => parseOpenCodeEvents(raw.stdout),
	},
	{
		name: "devin",
		binary: "devin",
		instructionTarget: "AGENTS.md",
		args: (o) => ["--permission-mode", "dangerous", ...model("--model", o.model), "-p"],
		prompt: "last-arg",
		parseMetrics: () => unavailableMetrics(),
	},
	{
		name: "amp",
		binary: "amp",
		instructionTarget: "AGENTS.md",
		// Amp's --stream-json mirrors Claude Code's result event.
		args: () => ["--stream-json", "-x"],
		prompt: "last-arg",
		parseMetrics: (raw) => parseClaudeResult(raw.stdout),
	},
];

/** Old names that still resolve, with the name they map to. */
export const HARNESS_ALIASES: Readonly<Record<string, string>> = { windsurf: "devin" };
