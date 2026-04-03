import chalk from "chalk";

// biome-ignore lint/suspicious/noControlCharactersInRegex: stripping ANSI escape codes requires matching ESC character
const ANSI_RE = /\x1B\[[0-9;]*m/g;

/** Strip ANSI escape codes for accurate width calculation */
export function stripAnsi(s: string): string {
	return s.replace(ANSI_RE, "");
}

/** Pad string to width, accounting for ANSI codes */
export function padEnd(s: string, width: number): string {
	const visible = stripAnsi(s).length;
	return s + " ".repeat(Math.max(0, width - visible));
}

/** Standard section header */
export function header(text: string): string {
	return `\n  ${chalk.bold(text)}\n  ${chalk.dim("\u2500".repeat(stripAnsi(text).length))}\n`;
}

/** Dim horizontal rule */
export function rule(width = 60): string {
	return chalk.dim(`  ${"\u2500".repeat(width)}`);
}

/** Key-value line with aligned values */
export function kvLine(key: string, value: string, keyWidth = 20): string {
	return `  ${chalk.dim(key.padEnd(keyWidth))} ${value}`;
}

/** Colorize a score 0-10 or 0-1 */
export function scoreColor(score: number, max = 10): string {
	const normalized = max === 1 ? score * 10 : score;
	const display = max === 1 ? score.toFixed(2) : String(score);
	if (normalized >= 8) return chalk.green(display);
	if (normalized >= 5) return chalk.yellow(display);
	return chalk.red(display);
}
