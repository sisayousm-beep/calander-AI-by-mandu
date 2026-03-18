import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

type LogLevel = "info" | "warn" | "error";

export class Logger {
  private readonly logFilePath: string;

  constructor(private readonly userDataPath: string) {
    const logsDir = join(userDataPath, "logs");
    mkdirSync(logsDir, { recursive: true });
    this.logFilePath = join(logsDir, "app.log");
  }

  info(message: string, meta?: unknown): void {
    this.write("info", message, meta);
  }

  warn(message: string, meta?: unknown): void {
    this.write("warn", message, meta);
  }

  error(message: string, meta?: unknown): void {
    this.write("error", message, meta);
  }

  private write(level: LogLevel, message: string, meta?: unknown): void {
    const payload = meta ? ` ${JSON.stringify(meta)}` : "";
    appendFileSync(this.logFilePath, `[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}${payload}\n`, "utf8");
  }
}
