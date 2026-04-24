import { Effect, Context, Layer } from 'effect';
import * as tauriLog from '@tauri-apps/plugin-log';
import { isTauri } from './env';

export interface LoggerService {
  readonly info: (message: string, context?: Record<string, unknown>) => Effect.Effect<void>;
  readonly warn: (message: string, context?: Record<string, unknown>) => Effect.Effect<void>;
  readonly error: (message: string, context?: Record<string, unknown>, error?: unknown) => Effect.Effect<void>;
  readonly debug: (message: string, context?: Record<string, unknown>) => Effect.Effect<void>;
  readonly notify: (level: 'info' | 'warn' | 'error', message: string, detail?: string) => Effect.Effect<void>;
}

export const LoggerService = Context.GenericTag<LoggerService>('LoggerService');

// Global event bus for UI logs
export type UILogEntry = { level: 'info' | 'warn' | 'error', message: string, detail?: string, timestamp: number };
export const uiLogListeners: Set<(entry: UILogEntry) => void> = new Set();

const formatMessage = (message: string, context?: Record<string, unknown>) => 
  context ? `${message} | CONTEXT: ${JSON.stringify(context)}` : message;

const emitToUI = (level: 'info' | 'warn' | 'error', message: string, detail?: string) => {
  const entry: UILogEntry = { level, message, detail, timestamp: Date.now() };
  uiLogListeners.forEach(listener => listener(entry));
};

// --- TAURI IMPLEMENTATION ---
export const LoggerServiceTauri = Layer.succeed(
  LoggerService,
  {
    info: (message, context) => 
      Effect.sync(() => {
        tauriLog.info(formatMessage(message, context));
        emitToUI('info', message);
      }),
    warn: (message, context) => 
      Effect.sync(() => {
        tauriLog.warn(formatMessage(message, context));
        emitToUI('warn', message);
      }),
    error: (message, context, err) => 
      Effect.sync(() => {
        const detail = err ? String(err) : undefined;
        tauriLog.error(formatMessage(`${message}${detail ? ` | ERROR: ${detail}` : ''}`, context));
        emitToUI('error', message, detail);
      }),
    debug: (message, context) => 
      Effect.sync(() => tauriLog.debug(formatMessage(message, context))),
    notify: (level, message, detail) =>
      Effect.sync(() => emitToUI(level, message, detail)),
  }
);

// --- WEB IMPLEMENTATION ---
export const LoggerServiceWeb = Layer.succeed(
  LoggerService,
  {
    info: (message, context) => 
      Effect.sync(() => {
        console.info(formatMessage(message, context));
        emitToUI('info', message);
      }),
    warn: (message, context) => 
      Effect.sync(() => {
        console.warn(formatMessage(message, context));
        emitToUI('warn', message);
      }),
    error: (message, context, err) => 
      Effect.sync(() => {
        const detail = err ? String(err) : undefined;
        console.error(formatMessage(`${message}${detail ? ` | ERROR: ${detail}` : ''}`, context));
        emitToUI('error', message, detail);
      }),
    debug: (message, context) => 
      Effect.sync(() => console.debug(formatMessage(message, context))),
    notify: (level, message, detail) =>
      Effect.sync(() => emitToUI(level, message, detail)),
  }
);

/**
 * Dynamic Logger Layer based on environment
 */
export const LoggerServiceLive = isTauri() ? LoggerServiceTauri : LoggerServiceWeb;

// Helpers for functional pipelines
export const logInfo = (message: string, context?: Record<string, unknown>) =>
  Effect.flatMap(LoggerService, (logger) => logger.info(message, context));

export const logError = (message: string, context?: Record<string, unknown>, error?: unknown) =>
  Effect.flatMap(LoggerService, (logger) => logger.error(message, context, error));
