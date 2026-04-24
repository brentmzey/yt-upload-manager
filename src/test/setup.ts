import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock Tauri APIs
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(),
}));

// Mock PocketBase
vi.mock('pocketbase', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      collection: vi.fn().mockReturnThis(),
      getFullList: vi.fn(),
      authStore: {
        isValid: false,
        token: '',
        model: null,
      },
    })),
  };
});
