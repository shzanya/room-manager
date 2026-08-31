import { loadEnv } from "@room-manager/config";
import pino from "pino";

let rootLogger: pino.Logger | null = null;

export function createStructuredLogger(): pino.Logger {
  if (rootLogger) {
    return rootLogger;
  }

  const env = loadEnv();

  rootLogger = pino({
    level: env.LOG_LEVEL,
    transport:
      env.NODE_ENV === "development"
        ? { target: "pino-pretty", options: { colorize: true } }
        : undefined,
    base: { service: "room-manager" },
    timestamp: pino.stdTimeFunctions.isoTime,
  });

  return rootLogger;
}

export function getLogger(): pino.Logger {
  if (!rootLogger) {
    throw new Error("Logger not initialized. Call createStructuredLogger first.");
  }
  return rootLogger;
}

export function createChildLogger(name: string): pino.Logger {
  return getLogger().child({ module: name });
}
