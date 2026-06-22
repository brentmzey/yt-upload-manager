import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { SettingsManager } from './SettingsManager';
import { PocketBaseService } from '../lib/pocketbase';
import { LoggerServiceLive } from '../lib/logger';
import { YouTubeServiceLive } from '../lib/youtube/service';
import { Effect, Layer } from 'effect';
import { useTenant } from '../lib/tenant_context';

// Mock the whole pocketbase library to avoid constructor issues
vi.mock('pocketbase', () => {
  class MockBaseAuthStore {
    save = vi.fn();
    clear = vi.fn();
    isValid = false;
    token = '';
    model = null;
  }
  return {
    default: class {
      collection = () => ({
        authWithPassword: () => Promise.resolve(),
        getFullList: () => Promise.resolve([]),
        getFirstListItem: () => Promise.resolve({ id: 'setting-1' }),
        create: () => Promise.resolve({ id: 'record-1' }),
        update: () => Promise.resolve({ id: 'record-1' }),
        delete: () => Promise.resolve(true),
      });
      authStore = new MockBaseAuthStore();
    },
    BaseAuthStore: MockBaseAuthStore,
  };
});

// Mock the pocketbase service module
vi.mock('../lib/pocketbase', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/pocketbase')>();
  const { Effect, Layer } = await import('effect');
  
  const MockLayer = Layer.succeed(
    actual.PocketBaseService,
    {
      getChannels: () => Effect.succeed([] as actual.ChannelRecord[]),
      isAuthenticated: () => false,
      authenticateAsAdmin: () => Effect.void,
      getPendingBatch: () => Effect.succeed({ id: 'batch-1' } as actual.BatchRecord),
      createBatch: () => Effect.succeed({ id: 'batch-1' } as actual.BatchRecord),
      getStagedVideos: () => Effect.succeed([] as actual.StagedVideoRecord[]),
      saveStagedVideo: (v: Partial<actual.StagedVideoRecord>) => Effect.succeed({ id: v.id || 'new-id' } as actual.StagedVideoRecord),
      deleteStagedVideo: () => Effect.void,
      getSetting: (key: string) => {
        if (key === 'AUTO_ENRICHMENT') return Effect.succeed({ value: 'true' } as actual.SettingRecord);
        if (key === 'TAURI_NATIVE_BACKEND') return Effect.succeed({ value: 'false' } as actual.SettingRecord);
        if (key === 'MAX_CONCURRENT_UPLOADS') return Effect.succeed({ value: '3' } as actual.SettingRecord);
        if (key === 'YT_UPLOAD_RETRY_LIMIT') return Effect.succeed({ value: '5' } as actual.SettingRecord);
        if (key === 'YT_DEFAULT_PRIVACY') return Effect.succeed({ value: 'private' } as actual.SettingRecord);
        return Effect.fail(new actual.PocketBaseError(new Error('Not found')));
      },
      updateSetting: () => Effect.void,
      activateChannel: (id: string) => Effect.succeed({ id, status: 'active' } as actual.ChannelRecord),
      updateChannel: (id: string, updates: Partial<Omit<actual.ChannelRecord, 'id' | 'created' | 'updated'>>) => Effect.succeed({ id, ...updates } as actual.ChannelRecord),
    }
  );

  return {
    ...actual,
    PocketBaseServiceLive: MockLayer,
  };
});

// Mock the tenant context
vi.mock('../lib/tenant_context', () => ({
  useTenant: vi.fn()
}));

import { PocketBaseService, ChannelRecord, BatchRecord, StagedVideoRecord, SettingRecord, PocketBaseError } from '../lib/pocketbase';

describe('SettingsManager Component', () => {
  const updateSettingMock = vi.fn(() => Effect.void);

  beforeEach(() => {
    vi.clearAllMocks();
    
    vi.mocked(useTenant).mockReturnValue({
      tenant: { name: 'Test Tenant', slug: 'test-tenant' },
      isLoading: false,
      error: null,
      switchTenant: vi.fn(),
      appLayer: Layer.mergeAll(
        Layer.succeed(
          PocketBaseService,
          {
            getChannels: () => Effect.succeed([] as ChannelRecord[]),
            isAuthenticated: () => false,
            authenticateAsAdmin: () => Effect.void,
            getPendingBatch: () => Effect.succeed({ id: 'batch-1' } as BatchRecord),
            createBatch: () => Effect.succeed({ id: 'batch-1' } as BatchRecord),
            getStagedVideos: () => Effect.succeed([] as StagedVideoRecord[]),
            saveStagedVideo: (v: Partial<StagedVideoRecord>) => Effect.succeed({ id: v.id || 'new-id' } as StagedVideoRecord),
            deleteStagedVideo: () => Effect.void,
            getSetting: (key: string) => {
              if (key === 'AUTO_ENRICHMENT') return Effect.succeed({ value: 'true' } as SettingRecord);
              if (key === 'TAURI_NATIVE_BACKEND') return Effect.succeed({ value: 'false' } as SettingRecord);
              if (key === 'MAX_CONCURRENT_UPLOADS') return Effect.succeed({ value: '3' } as SettingRecord);
              if (key === 'YT_UPLOAD_RETRY_LIMIT') return Effect.succeed({ value: '5' } as SettingRecord);
              if (key === 'YT_DEFAULT_PRIVACY') return Effect.succeed({ value: 'private' } as SettingRecord);
              return Effect.fail(new PocketBaseError(new Error('Not found')));
            },
            updateSetting: updateSettingMock,
            activateChannel: (id: string) => Effect.succeed({ id, status: 'active' } as ChannelRecord),
            updateChannel: (id: string, updates: Partial<Omit<ChannelRecord, 'id' | 'created' | 'updated'>>) => Effect.succeed({ id, ...updates } as ChannelRecord),
          }
        ),
        LoggerServiceLive,
        YouTubeServiceLive
      )
    } as unknown as ReturnType<typeof useTenant>);
  });

  it('renders settings details dynamically from database store', async () => {
    await act(async () => {
      render(<SettingsManager />);
    });

    expect(screen.getByText('Tenant Settings')).toBeInTheDocument();
    expect(screen.getByText('Test Tenant')).toBeInTheDocument();
    expect(screen.getByText('Auto-Enrichment')).toBeInTheDocument();
    
    // Verify default value is present in inputs
    const maxConcurrentInput = screen.getByLabelText(/Max Concurrent Uploads/i) as HTMLInputElement;
    expect(maxConcurrentInput.value).toBe('3');

    const retryLimitInput = screen.getByLabelText(/API Upload Retry Limit/i) as HTMLInputElement;
    expect(retryLimitInput.value).toBe('5');
  });

  it('saves updated settings back to the dynamic database KV store on submit', async () => {
    await act(async () => {
      render(<SettingsManager />);
    });

    const maxConcurrentInput = screen.getByLabelText(/Max Concurrent Uploads/i);
    fireEvent.change(maxConcurrentInput, { target: { value: '8' } });

    const saveButton = screen.getByText('Save Configuration');
    await act(async () => {
      fireEvent.click(saveButton);
    });

    expect(updateSettingMock).toHaveBeenCalledWith('MAX_CONCURRENT_UPLOADS', 8);
  });
});
