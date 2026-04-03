import type { RubricResult } from "./types.js";

/**
 * Build the prompt for convention compliance scoring.
 */
export function buildConventionCompliancePrompt(diff: string, instructions: string): string {
	return `You are evaluating whether a code diff follows the coding conventions described below.

CONVENTIONS:
${instructions}

DIFF:
${diff}

Rate compliance 0-10 and list any violations. Respond in this exact JSON format:
{"score": <number>, "violations": ["<violation 1>", "<violation 2>"]}`;
}

/**
 * Build the prompt for progressive disclosure scoring.
 */
export function buildProgressiveDisclosurePrompt(diff: string, instructions: string): string {
	return `You are evaluating whether code changes are appropriately scoped and layered.

CONVENTIONS:
${instructions}

DIFF:
${diff}

Rate scope-appropriateness 0-10. Are changes focused? Is complexity introduced gradually?
Respond in this exact JSON format:
{"score": <number>, "issues": ["<issue 1>", "<issue 2>"]}`;
}

/**
 * Try to extract a JSON object from a string that may contain surrounding text.
 * Handles raw JSON, JSON in markdown code blocks, and JSON embedded in prose.
 */
export function extractJSON(text: string): Record<string, unknown> | null {
	// Try direct parse first
	try {
		return JSON.parse(text) as Record<string, unknown>;
	} catch {
		// continue to fallback strategies
	}

	// Try to find JSON in a code block
	const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
	if (codeBlockMatch) {
		try {
			return JSON.parse(codeBlockMatch[1].trim()) as Record<string, unknown>;
		} catch {
			// continue
		}
	}

	// Try to find a JSON object in the text
	const objectMatch = text.match(/\{[\s\S]*\}/);
	if (objectMatch) {
		try {
			return JSON.parse(objectMatch[0]) as Record<string, unknown>;
		} catch {
			// give up
		}
	}

	return null;
}

/**
 * Parse a convention compliance response into a RubricResult.
 */
export function parseConventionComplianceResponse(response: string): RubricResult {
	const parsed = extractJSON(response);

	if (
		parsed !== null &&
		typeof parsed.score === "number" &&
		parsed.score >= 0 &&
		parsed.score <= 10
	) {
		const violations = Array.isArray(parsed.violations)
			? parsed.violations.filter((v): v is string => typeof v === "string")
			: [];
		return {
			name: "convention-compliance",
			score: parsed.score,
			maxScore: 10,
			details: violations.length > 0 ? violations : ["No violations found"],
		};
	}

	return {
		name: "convention-compliance",
		score: 5,
		maxScore: 10,
		details: ["LLM response could not be parsed"],
	};
}

/**
 * Parse a progressive disclosure response into a RubricResult.
 */
export function parseProgressiveDisclosureResponse(response: string): RubricResult {
	const parsed = extractJSON(response);

	if (
		parsed !== null &&
		typeof parsed.score === "number" &&
		parsed.score >= 0 &&
		parsed.score <= 10
	) {
		const issues = Array.isArray(parsed.issues)
			? parsed.issues.filter((v): v is string => typeof v === "string")
			: [];
		return {
			name: "progressive-disclosure",
			score: parsed.score,
			maxScore: 10,
			details: issues.length > 0 ? issues : ["No issues found"],
		};
	}

	return {
		name: "progressive-disclosure",
		score: 5,
		maxScore: 10,
		details: ["LLM response could not be parsed"],
	};
}

/**
 * Call the claude CLI with a prompt and return the response text.
 * Returns empty string on failure or timeout.
 */
export async function callLLMForRubric(prompt: string, timeoutMs = 30_000): Promise<string> {
	const proc = Bun.spawn(["claude", "--print", "--dangerously-skip-permissions", prompt], {
		stdout: "pipe",
		stderr: "pipe",
	});

	const timer = setTimeout(() => proc.kill(), timeoutMs);
	const exitCode = await proc.exited;
	clearTimeout(timer);

	if (exitCode !== 0) {
		return "";
	}
	return (await new Response(proc.stdout).text()).trim();
}

/**
 * Score convention compliance by sending the diff and instructions to an LLM.
 */
export async function scoreConventionCompliance(
	diff: string,
	instructions: string,
): Promise<RubricResult> {
	const prompt = buildConventionCompliancePrompt(diff, instructions);
	const response = await callLLMForRubric(prompt);

	if (!response) {
		return {
			name: "convention-compliance",
			score: 5,
			maxScore: 10,
			details: ["LLM call failed or timed out"],
		};
	}

	return parseConventionComplianceResponse(response);
}

/**
 * Score progressive disclosure by sending the diff and instructions to an LLM.
 */
export async function scoreProgressiveDisclosure(
	diff: string,
	instructions: string,
): Promise<RubricResult> {
	const prompt = buildProgressiveDisclosurePrompt(diff, instructions);
	const response = await callLLMForRubric(prompt);

	if (!response) {
		return {
			name: "progressive-disclosure",
			score: 5,
			maxScore: 10,
			details: ["LLM call failed or timed out"],
		};
	}

	return parseProgressiveDisclosureResponse(response);
}
