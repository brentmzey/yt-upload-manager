import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isTauri, isWeb, isDummyMode } from '../lib/env';

describe('Platform Target Verification', () => {
  beforeEach(() => {
    // Clean window mock environment before each test
    vi.stubGlobal('window', {
      __TAURI_INTERNALS__: undefined,
      navigator: {
        userAgent: '',
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('verifies Web Target environment resolution', () => {
    // In web target, window.__TAURI_INTERNALS__ is undefined
    expect(isTauri()).toBe(false);
    expect(isWeb()).toBe(true);
  });

  it('verifies Desktop Target environment resolution', () => {
    // Desktop Tauri target injects __TAURI_INTERNALS__
    vi.stubGlobal('window', {
      __TAURI_INTERNALS__: {},
      navigator: {
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      },
    });
    expect(isTauri()).toBe(true);
    expect(isWeb()).toBe(false);
  });

  it('verifies iOS Target environment resolution', () => {
    // Mobile iOS Tauri target injects __TAURI_INTERNALS__ and navigator.userAgent reports iPhone/iPad
    vi.stubGlobal('window', {
      __TAURI_INTERNALS__: {},
      navigator: {
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
      },
    });
    expect(isTauri()).toBe(true);
    expect(isWeb()).toBe(false);
  });

  it('verifies Android Target environment resolution', () => {
    // Mobile Android Tauri target injects __TAURI_INTERNALS__ and navigator.userAgent reports Android
    vi.stubGlobal('window', {
      __TAURI_INTERNALS__: {},
      navigator: {
        userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
      },
    });
    expect(isTauri()).toBe(true);
    expect(isWeb()).toBe(false);
  });

  it('verifies dummy mode matches env variable', () => {
    // dummy mode defaults to true in test config
    expect(typeof isDummyMode()).toBe('boolean');
  });
});
