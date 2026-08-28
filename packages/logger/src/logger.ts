export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export interface LoggerOptions {
  level?: LogLevel;
  prefix?: string;
}

export class Logger {
  private readonly level: LogLevel;
  private readonly prefix: string;

  public constructor(options: LoggerOptions = {}) {
    this.level = options.level ?? "info";
    this.prefix = options.prefix ?? "room-manager";
  }

  public debug(message: string, data?: unknown): void {
    this.write("debug", message, data);
  }

  public info(message: string, data?: unknown): void {
    this.write("info", message, data);
  }

  public warn(message: string, data?: unknown): void {
    this.write("warn", message, data);
  }

  public error(message: string, data?: unknown): void {
    this.write("error", message, data);
  }

  private write(level: LogLevel, message: string, data?: unknown): void {
    if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[this.level]) {
      return;
    }

    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${this.prefix}] [${level.toUpperCase()}]`;

    if (data === undefined) {
      console.log(`${prefix} ${message}`);
      return;
    }

    console.log(`${prefix} ${message}`, data);
  }
}

export function createLogger(options: LoggerOptions = {}): Logger {
  return new Logger(options);
}
