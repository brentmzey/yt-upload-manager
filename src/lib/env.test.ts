import { describe, it, expect, vi, afterEach } from 'vitest';
import { isTauri, isWeb } from './env';

describe('Environment Detection', () => {
  afterEach(() => {
    delete (window as any).__TAURI_INTERNALS__;
  });

  it('detects tauri environment', () => {
    (window as any).__TAURI_INTERNALS__ = {};
    expect(isTauri()).toBe(true);
    expect(isWeb()).toBe(false);
  });

  it('detects web environment', () => {
    expect(isTauri()).toBe(false);
    expect(isWeb()).toBe(true);
  });
});
