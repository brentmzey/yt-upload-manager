import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock Tauri APIs
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  trace: vi.fn(),
}));

// Mock brotli-wasm
vi.mock('brotli-wasm', () => ({
  default: Promise.resolve({
    compress: (input: Uint8Array) => input, // Mock as pass-through
    decompress: (input: Uint8Array) => input,
  }),
}));

// Global fetch mock - REMOVED to allow real network requests in integration tests.
// If unit tests need to mock fetch, they should do it locally.


// Mock PocketBase - REMOVED GLOBAL MOCK to allow integration tests to use real PB.
// Individual tests should mock it if needed.

