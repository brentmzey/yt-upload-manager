import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { BatchManager } from './BatchManager';
import { YouTubeServiceLive } from '../lib/youtube/service';
import { LoggerServiceLive } from '../lib/logger';
import { Effect, Layer } from 'effect';

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
        getFirstListItem: () => Promise.resolve({ id: 'batch-1' }),
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
      getSetting: () => Effect.fail(new actual.PocketBaseError(new Error('Not found'))),
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

import { useTenant } from '../lib/tenant_context';
import { PocketBaseService, ChannelRecord, BatchRecord, StagedVideoRecord, PocketBaseError } from '../lib/pocketbase';
import { LoggerServiceLive } from '../lib/logger';
import { YouTubeServiceLive } from '../lib/youtube/service';

// Mock the tenant context
vi.mock('../lib/tenant_context', () => ({
  useTenant: vi.fn()
}));

describe('BatchManager', () => {
  beforeEach(() => {
    vi.mocked(useTenant).mockReturnValue({
      tenant: null,
      isLoading: false,
      error: null,
      switchTenant: vi.fn(),
      appLayer: Layer.mergeAll(
        Layer.succeed(
          PocketBaseService,
          {
            getChannels: () => Effect.succeed([{ id: 'ch-1', name: 'Test', status: 'active' } as ChannelRecord]),
            isAuthenticated: () => false,
            authenticateAsAdmin: () => Effect.void,
            getPendingBatch: () => Effect.succeed({ id: 'batch-1' } as BatchRecord),
            createBatch: () => Effect.succeed({ id: 'batch-1' } as BatchRecord),
            getStagedVideos: () => Effect.succeed([] as StagedVideoRecord[]),
            saveStagedVideo: (v: Partial<StagedVideoRecord>) => Effect.succeed({ id: v.id || 'new-id' } as StagedVideoRecord),
            deleteStagedVideo: () => Effect.void,
            getSetting: () => Effect.fail(new PocketBaseError(new Error('Not found'))),
            updateSetting: () => Effect.void,
            activateChannel: (id: string) => Effect.succeed({ id, status: 'active' } as ChannelRecord),
            updateChannel: (id: string, updates: Partial<Omit<ChannelRecord, 'id' | 'created' | 'updated'>>) => Effect.succeed({ id, ...updates } as ChannelRecord),
          }
        ),
        LoggerServiceLive,
        YouTubeServiceLive
      )
    } as unknown as ReturnType<typeof useTenant>);
  });
  it('renders the dropzone and defaults to Live Streams', async () => {
    await act(async () => {
      render(<BatchManager />);
    });
    expect(screen.getByText(/Click or drag videos to stage/i)).toBeDefined();
    // Check if Live Streams is selected (look for the style class or text)
    const streamBtn = screen.getByText(/Live Streams/i);
    expect(streamBtn.className).toContain('text-indigo-600');
  });

  it('stages files and allows editing metadata in upload mode', async () => {
    let container: HTMLElement;
    await act(async () => {
      const rendered = render(<BatchManager />);
      container = rendered.container;
    });
    
    // Switch to General Uploads mode
    const uploadBtn = screen.getByText(/General Uploads/i);
    await act(async () => {
      fireEvent.click(uploadBtn);
    });

    const file = new File(['video content'], 'test-video.mp4', { type: 'video/mp4' });
    const input = container!.querySelector('input[type="file"]')!;
    
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });

    expect(screen.getByText('test-video')).toBeDefined();
    
    // Open editor
    const editBtn = screen.getByTitle('Edit Metadata');
    await act(async () => {
      fireEvent.click(editBtn);
    });

    // Change title
    const titleInput = screen.getByLabelText(/Video Title/i);
    await act(async () => {
      fireEvent.change(titleInput, { target: { value: 'Updated Title' } });
    });

    // Verify change
    expect(screen.getByDisplayValue('Updated Title')).toBeDefined();

    // Close editor
    const commitBtn = screen.getByText(/Commit Configuration/i);
    await act(async () => {
      fireEvent.click(commitBtn);
    });
    expect(screen.queryByLabelText(/Video Title/i)).toBeNull();
  });

  it('allows reordering tasks using move buttons', async () => {
    let container: HTMLElement;
    await act(async () => {
      const rendered = render(<BatchManager />);
      container = rendered.container;
    });
    
    // Switch to General Uploads mode
    const uploadBtn = screen.getByText(/General Uploads/i);
    await act(async () => {
      fireEvent.click(uploadBtn);
    });

    const file1 = new File(['1'], 'v1.mp4', { type: 'video/mp4' });
    const file2 = new File(['2'], 'v2.mp4', { type: 'video/mp4' });
    const input = container!.querySelector('input[type="file"]')!;
    
    await act(async () => {
      fireEvent.change(input, { target: { files: [file1, file2] } });
    });

    const rows = container!.querySelectorAll('tbody tr');
    expect(rows[0]).toHaveTextContent('v1');
    expect(rows[1]).toHaveTextContent('v2'); 

    // Move v2 up
    const moveUpBtns = screen.getAllByTitle('Move Up');
    await act(async () => {
      fireEvent.click(moveUpBtns[1]); // Button for second task
    });

    const newRows = container!.querySelectorAll('tbody tr');
    expect(newRows[0]).toHaveTextContent('v2');
    expect(newRows[1]).toHaveTextContent('v1');
  });
});
