import { describe, it, expect, vi, beforeAll } from 'vitest';
import { Effect, Layer, Option } from 'effect';
import { PocketBaseService } from '../lib/pocketbase';
import { YouTubeService, YouTubeServiceLive } from '../lib/youtube/service';
import { LoggerServiceLive } from '../lib/logger';
import { invoke } from '@tauri-apps/api/core';

// Mock Tauri APIs
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

// Mock Env
vi.mock('../lib/env', () => ({
  isTauri: () => true,
  isWeb: () => false,
  logPlatform: () => {},
  isDummyMode: () => true,
}));

// Mock brotli-wasm
vi.mock('brotli-wasm', () => ({
  default: Promise.resolve({
    compress: (input: Uint8Array) => input, // Mock as pass-through for test
    decompress: (input: Uint8Array) => input,
  }),
}));

// Global fetch mock
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({ video_id: 'yt-123', status: 'Success' }),
});

describe('E2E Staging & Compression Flow', () => {
  it('compresses metadata before sending to Tauri and includes hints', async () => {
    // 1. Mock PocketBase Service
    const PocketBaseServiceMock = Layer.succeed(PocketBaseService, {
      getChannels: () => Effect.succeed([]),
      isAuthenticated: () => false,
      authenticateAsAdmin: () => Effect.void,
      getPendingBatch: () => Effect.succeed({ id: 'batch-123' }),
      createBatch: () => Effect.succeed({ id: 'batch-123' }),
      getStagedVideos: () => Effect.succeed([
        { id: 'sv-1', title: 'Video 1', status: 'idle', privacyStatus: 'private', sort_order: 0, description_brotli_b64: '' }
      ]),
      saveStagedVideo: (v: any) => Effect.succeed({ id: v.id || 'new-id' }),
      deleteStagedVideo: () => Effect.void,
      getSetting: () => Effect.fail(new Error('Not found') as any),
      updateSetting: () => Effect.void,
    });

    const AppLayer = Layer.mergeAll(YouTubeServiceLive, LoggerServiceLive, PocketBaseServiceMock);

    // 2. Prepare Metadata
    const metadata: any = {
      job_type: 'VideoUpload',
      title: 'Compressed Video',
      description: 'This is a description.',
      privacyStatus: 'private',
      license: 'youtube',
      embeddable: true,
      publicStatsViewable: true,
      madeForKids: false,
      containsSyntheticMedia: false,
      paidProductPlacement: false,
      tags: ['test'],
      categoryId: '22',
      subDetails: {},
      thumbnailUrl: Option.none(),
      scheduledStartTime: Option.none(),
      scheduledEndTime: Option.none(),
      publishAt: Option.none(),
      recordingDate: Option.none(),
      language: Option.none(),
      defaultLanguage: Option.none(),
      defaultAudioLanguage: Option.none(),
      latencyPreference: Option.none(),
      enableAutoStart: Option.none(),
      enableAutoStop: Option.none(),
      enableDvr: Option.none(),
      enableContentEncryption: Option.none(),
      startWithLowLatency: Option.none(),
      recordFromStart: Option.none(),
      enableMonitorStream: Option.none(),
      broadcastStreamDelayMs: Option.none(),
      projection: Option.none(),
      localizations: Option.none(),
    };

    // 3. Trigger Upload
    (invoke as any).mockResolvedValue({ video_id: 'yt-123', status: 'Success' });
    
    const program = YouTubeService.pipe(
      Effect.flatMap(service => service.uploadVideo('ch-123', metadata, new Blob(['video']), undefined))
    );

    const videoId = await Effect.runPromise(Effect.provide(program, AppLayer));

    // 4. Verify Compression Hints & Integrity
    expect(videoId).toBe('yt-123');
    const lastCall = (invoke as any).mock.calls[0];
    expect(lastCall[0]).toBe('start_youtube_upload_job');
    
    const payload = lastCall[1].payload;
    expect(payload.channel_id).toBe('ch-123');
    expect(payload.compressed_fields).toContain('description');
    expect(payload.is_compressed).toBe(true);
  });
});
