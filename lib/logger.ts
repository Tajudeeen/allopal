/**
 * Structured JSON Logger with request ID correlation.
 * Formatted for standard log ingestion (Pino, Datadog, GCP Cloud Logging).
 */

export interface LogContext {
  requestId?: string;
  workspaceId?: string;
  mandateId?: string;
  cartId?: string;
  orderId?: string;
  durationMs?: number;
  [key: string]: unknown;
}

function formatLog(level: string, message: string, context?: LogContext) {
  return JSON.stringify({
    level,
    time: new Date().toISOString(),
    msg: message,
    ...context,
  });
}

export const logger = {
  info(message: string, context?: LogContext): void {
    console.log(formatLog("info", message, context));
  },
  warn(message: string, context?: LogContext): void {
    console.warn(formatLog("warn", message, context));
  },
  error(message: string, error?: unknown, context?: LogContext): void {
    console.error(
      formatLog("error", message, {
        error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
        ...context,
      }),
    );
  },
};
