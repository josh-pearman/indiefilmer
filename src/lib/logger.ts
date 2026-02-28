/**
 * Structured logger for the indiefilmer application.
 *
 * - JSON output in production (NODE_ENV=production), human-readable in development.
 * - Log levels: debug, info, warn, error.
 * - Context fields (module, action, userId, etc.).
 * - No external dependencies -- uses built-in console under the hood.
 *
 * Usage:
 *   import { createLogger } from "@/lib/logger";
 *   const logger = createLogger("weather");
 *   logger.info("Geocoding address", { address });
 *   logger.error("Geocode failed", { error: err });
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

type LogContext = Record<string, unknown>;

export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
}

function getMinLevel(): LogLevel {
  const env = process.env.LOG_LEVEL?.toLowerCase();
  if (env && env in LOG_LEVEL_PRIORITY) return env as LogLevel;
  return process.env.NODE_ENV === "production" ? "info" : "debug";
}

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

function formatDev(
  level: LogLevel,
  module: string,
  message: string,
  context?: LogContext
): string {
  const timestamp = new Date().toISOString();
  const prefix = `${timestamp} [${level.toUpperCase()}] [${module}]`;
  if (context && Object.keys(context).length > 0) {
    return `${prefix} ${message} ${JSON.stringify(context)}`;
  }
  return `${prefix} ${message}`;
}

function formatJson(
  level: LogLevel,
  module: string,
  message: string,
  context?: LogContext
): string {
  const entry: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    level,
    module,
    message,
    ...context,
  };
  return JSON.stringify(entry);
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[getMinLevel()];
}

function log(
  level: LogLevel,
  module: string,
  message: string,
  context?: LogContext
): void {
  if (!shouldLog(level)) return;

  const formatted = isProduction()
    ? formatJson(level, module, message, context)
    : formatDev(level, module, message, context);

  switch (level) {
    case "debug":
      // eslint-disable-next-line no-console
      console.debug(formatted);
      break;
    case "info":
      // eslint-disable-next-line no-console
      console.info(formatted);
      break;
    case "warn":
      // eslint-disable-next-line no-console
      console.warn(formatted);
      break;
    case "error":
      // eslint-disable-next-line no-console
      console.error(formatted);
      break;
  }
}

/**
 * Create a logger scoped to a specific module.
 *
 * @param module - A short label identifying the source module (e.g. "weather", "chat", "settings").
 */
export function createLogger(module: string): Logger {
  return {
    debug: (message, context) => log("debug", module, message, context),
    info: (message, context) => log("info", module, message, context),
    warn: (message, context) => log("warn", module, message, context),
    error: (message, context) => log("error", module, message, context),
  };
}
