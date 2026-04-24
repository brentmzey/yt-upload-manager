import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Effect, Layer } from 'effect';
import { LoggerService, LoggerServiceWeb, uiLogListeners } from './logger';

describe('LoggerServiceWeb', () => {
  beforeEach(() => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    uiLogListeners.clear();
  });

  it('emits log to console and UI listeners', async () => {
    const listener = vi.fn();
    uiLogListeners.add(listener);

    const program = LoggerService.pipe(
      Effect.flatMap(logger => logger.info('test message', { foo: 'bar' }))
    );

    await Effect.runPromise(Effect.provide(program, LoggerServiceWeb));

    expect(console.info).toHaveBeenCalledWith(expect.stringContaining('test message'));
    expect(console.info).toHaveBeenCalledWith(expect.stringContaining('{"foo":"bar"}'));
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({
      level: 'info',
      message: 'test message',
    }));
  });

  it('emits error with detail', async () => {
    const listener = vi.fn();
    uiLogListeners.add(listener);

    const errorObj = new Error('detailed error');
    const program = LoggerService.pipe(
      Effect.flatMap(logger => logger.error('failure', {}, errorObj))
    );

    await Effect.runPromise(Effect.provide(program, LoggerServiceWeb));

    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('failure'));
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('detailed error'));
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({
      level: 'error',
      message: 'failure',
      detail: 'Error: detailed error',
    }));
  });
});
