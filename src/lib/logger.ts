import { Effect, Context, Layer } from 'effect';
import { info, warn, error, debug, trace } from '@tauri-apps/plugin-log';

export interface LoggerService {
  readonly info: (message: string, context?: Record<string, unknown>) => Effect.Effect<void>;
  readonly warn: (message: string, context?: Record<string, unknown>) => Effect.Effect<void>;
  readonly error: (message: string, context?: Record<string, unknown>, error?: unknown) => Effect.Effect<void>;
  readonly debug: (message: string, context?: Record<string, unknown>) => Effect.Effect<void>;
  readonly notify: (level: 'info' | 'warn' | 'error', message: string, detail?: string) => Effect.Effect<void>;
}

export const LoggerService = Context.GenericTag<LoggerService>('LoggerService');

// Global event bus for UI logs (Simple approach for React consumption)
export type UILogEntry = { level: 'info' | 'warn' | 'error', message: string, detail?: string, timestamp: number };
export const uiLogListeners: Set<(entry: UILogEntry) => void> = new Set();

const formatMessage = (message: string, context?: Record<string, unknown>) => 
  context ? `${message} | CONTEXT: ${JSON.stringify(context)}` : message;

const emitToUI = (level: 'info' | 'warn' | 'error', message: string, detail?: string) => {
  const entry: UILogEntry = { level, message, detail, timestamp: Date.now() };
  uiLogListeners.forEach(listener => listener(entry));
};

export const LoggerServiceLive = Layer.succeed(
  LoggerService,
  {
    info: (message, context) => 
      Effect.sync(() => {
        info(formatMessage(message, context));
        emitToUI('info', message);
      }),
    warn: (message, context) => 
      Effect.sync(() => {
        warn(formatMessage(message, context));
        emitToUI('warn', message);
      }),
    error: (message, context, err) => 
      Effect.sync(() => {
        const detail = err ? String(err) : undefined;
        error(formatMessage(`${message}${detail ? ` | ERROR: ${detail}` : ''}`, context));
        emitToUI('error', message, detail);
      }),
    debug: (message, context) => 
      Effect.sync(() => debug(formatMessage(message, context))),
    notify: (level, message, detail) =>
      Effect.sync(() => emitToUI(level, message, detail)),
  }
);

// Helper for functional pipelines
export const logInfo = (message: string, context?: Record<string, unknown>) =>
  Effect.flatMap(LoggerService, (logger) => logger.info(message, context));

export const logError = (message: string, context?: Record<string, unknown>, error?: unknown) =>
  Effect.flatMap(LoggerService, (logger) => logger.error(message, context, error));
