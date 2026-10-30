import type { RunMetrics } from "../run/types.js";

// Parsers for agent CLIs' machine-readable output. Each returns what the agent
// reported and leaves everything else null. Output schemas come from each
// vendor's headless docs (docs/research/2026-10-30-agent-ecosystem.md §3).

type Json = Record<string, unknown>;

function isRecord(value: unknown): value is Json {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function num(value: unknown): number | null {
	return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function rec(value: unknown): Json {
	return isRecord(value) ? value : {};
}

/** Parse stdout as one JSON document, or as JSON Lines when it isn't one. */
export function parseJsonEvents(stdout: string): Json[] {
	const trimmed = stdout.trim();
	if (trimmed.length === 0) return [];
	try {
		const doc: unknown = JSON.parse(trimmed);
		if (Array.isArray(doc)) return doc.filter(isRecord);
		return isRecord(doc) ? [doc] : [];
	} catch {
		const events: Json[] = [];
		for (const line of trimmed.split("\n")) {
			try {
				const value: unknown = JSON.parse(line);
				if (isRecord(value)) events.push(value);
			} catch {
				// Non-JSON lines (progress output, warnings) are skipped.
			}
		}
		return events;
	}
}

export function unavailableMetrics(): RunMetrics {
	return {
		tokensInput: null,
		tokensOutput: null,
		tokensTotal: null,
		tokenSource: "unavailable",
		tokensCacheRead: null,
		costUsd: null,
		model: null,
		turns: null,
	};
}

function fromCounts(counts: {
	input: number | null;
	output: number | null;
	cacheRead?: number | null;
	total?: number | null;
	costUsd?: number | null;
	model?: string | null;
	turns?: number | null;
}): RunMetrics {
	const total =
		counts.total ??
		(counts.input !== null || counts.output !== null
			? (counts.input ?? 0) + (counts.output ?? 0)
			: null);
	return {
		tokensInput: counts.input,
		tokensOutput: counts.output,
		tokensTotal: total,
		tokenSource: total === null ? "unavailable" : "api",
		tokensCacheRead: counts.cacheRead ?? null,
		costUsd: counts.costUsd ?? null,
		model: counts.model ?? null,
		turns: counts.turns ?? null,
	};
}

/**
 * Claude Code `-p --output-format json` (and Amp's Claude-compatible
 * `--stream-json`): a `result` event with usage, total_cost_usd, num_turns,
 * and a per-model modelUsage map.
 */
export function parseClaudeResult(stdout: string): RunMetrics {
	const result = parseJsonEvents(stdout).findLast((e) => e.type === "result");
	if (!result) return unavailableMetrics();
	const usage = rec(result.usage);
	const cacheRead = num(usage.cache_read_input_tokens) ?? 0;
	const cached = cacheRead + (num(usage.cache_creation_input_tokens) ?? 0);
	const input = num(usage.input_tokens);
	const models = Object.keys(rec(result.modelUsage));
	return fromCounts({
		input: input === null ? null : input + cached,
		output: num(usage.output_tokens),
		cacheRead: input === null ? null : cacheRead,
		costUsd: num(result.total_cost_usd),
		model: models[0] ?? null,
		turns: num(result.num_turns),
	});
}

/**
 * Codex `exec --json`: sum `turn.completed.usage` across turns. As in the
 * OpenAI API, input_tokens includes cached_input_tokens and output_tokens
 * includes reasoning_output_tokens.
 */
export function parseCodexEvents(stdout: string): RunMetrics {
	const turns = parseJsonEvents(stdout).filter((e) => e.type === "turn.completed");
	if (turns.length === 0) return unavailableMetrics();
	let input = 0;
	let output = 0;
	let cacheRead = 0;
	for (const turn of turns) {
		const usage = rec(turn.usage);
		input += num(usage.input_tokens) ?? 0;
		cacheRead += num(usage.cached_input_tokens) ?? 0;
		// reasoning_output_tokens is a breakdown of output_tokens, not an addition.
		output += num(usage.output_tokens) ?? 0;
	}
	return fromCounts({ input, output, cacheRead, turns: turns.length });
}

/** Gemini CLI `-o json`: `stats.models.<name>.tokens.{prompt,candidates,total}`. */
export function parseGeminiJson(stdout: string): RunMetrics {
	const doc = parseJsonEvents(stdout).findLast((e) => isRecord(e.stats));
	if (!doc) return unavailableMetrics();
	const models = rec(rec(doc.stats).models);
	let input = 0;
	let output = 0;
	let total = 0;
	for (const model of Object.values(models)) {
		const tokens = rec(rec(model).tokens);
		input += num(tokens.prompt) ?? 0;
		output += num(tokens.candidates) ?? 0;
		total += num(tokens.total) ?? 0;
	}
	if (total === 0 && input === 0) return unavailableMetrics();
	return fromCounts({ input, output, total: total || null, model: Object.keys(models)[0] ?? null });
}

/** Antigravity `agy -p --output-format json`: `usage.*_tokens`, `num_turns`. */
export function parseAntigravityJson(stdout: string): RunMetrics {
	const doc = parseJsonEvents(stdout).findLast((e) => isRecord(e.usage));
	if (!doc) return unavailableMetrics();
	const usage = rec(doc.usage);
	return fromCounts({
		input: num(usage.input_tokens),
		output: (num(usage.output_tokens) ?? 0) + (num(usage.thinking_tokens) ?? 0),
		total: num(usage.total_tokens),
		turns: num(doc.num_turns),
	});
}

/**
 * OpenCode `run --format json`: raw session events. The schema is not
 * documented, so sum any `tokens` / `cost` found on step-finish parts.
 */
export function parseOpenCodeEvents(stdout: string): RunMetrics {
	let input = 0;
	let output = 0;
	let cost = 0;
	let steps = 0;
	for (const event of parseJsonEvents(stdout)) {
		const part = isRecord(event.part) ? event.part : event;
		const tokens = rec(part.tokens);
		if (num(tokens.input) === null && num(tokens.output) === null) continue;
		steps++;
		input += num(tokens.input) ?? 0;
		output += (num(tokens.output) ?? 0) + (num(tokens.reasoning) ?? 0);
		cost += num(part.cost) ?? 0;
	}
	if (steps === 0) return unavailableMetrics();
	return fromCounts({ input, output, costUsd: cost || null, turns: steps });
}

function errorText(value: unknown): string | null {
	if (typeof value === "string") {
		// Codex nests the API error as a JSON string; surface its message.
		try {
			const inner: unknown = JSON.parse(value);
			const message = rec(rec(inner).error).message;
			if (typeof message === "string") return message;
		} catch {
			// not JSON
		}
		return value;
	}
	const message = rec(value).message;
	return typeof message === "string" ? errorText(message) : null;
}

/**
 * The failure an agent CLI reported in its JSON output, if any: a Claude-style
 * result with is_error, a Codex turn.failed, or a top-level error event.
 */
export function extractAgentError(stdout: string): string | null {
	for (const event of parseJsonEvents(stdout).reverse()) {
		if (event.type === "result" && event.is_error === true) {
			return errorText(event.result) ?? `agent reported ${String(event.subtype ?? "an error")}`;
		}
		if (event.type === "turn.failed") return errorText(event.error) ?? "turn failed";
		if (event.type === "error")
			return errorText(event.message) ?? errorText(event.error) ?? "error";
	}
	return null;
}
