export type LogLevel = "debug" | "info" | "warn" | "error";

const levels: Record<LogLevel, number> = {
	debug: 0,
	info: 1,
	warn: 2,
	error: 3,
};

class Logger {
	level: LogLevel = "info";

	private shouldLog(level: LogLevel): boolean {
		return levels[level] >= levels[this.level];
	}

	debug(msg: string, ...args: unknown[]): void {
		if (this.shouldLog("debug")) {
			console.debug(`[debug] ${msg}`, ...args);
		}
	}

	info(msg: string, ...args: unknown[]): void {
		if (this.shouldLog("info")) {
			console.info(msg, ...args);
		}
	}

	warn(msg: string, ...args: unknown[]): void {
		if (this.shouldLog("warn")) {
			console.warn(`[warn] ${msg}`, ...args);
		}
	}

	error(msg: string, ...args: unknown[]): void {
		if (this.shouldLog("error")) {
			console.error(`[error] ${msg}`, ...args);
		}
	}
}

export const logger = new Logger();
