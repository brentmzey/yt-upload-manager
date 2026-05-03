import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Effect, Layer, Option } from 'effect';
import { PocketBaseService } from '../lib/pocketbase';
import { YouTubeService, YouTubeServiceTauri } from '../lib/youtube/service';
import { LoggerServiceLive } from '../lib/logger';
import { invoke } from '@tauri-apps/api/core';

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

// Mock PocketBase library constructor/system
vi.mock('pocketbase', () => {
  return {
    default: class {
      collection = () => ({});
      authStore = { isValid: false, save: () => {} };
    }
  };
});

describe('E2E Staging Flow', () => {
  it('loads staged videos from PocketBase and triggers Tauri backend', async () => {
    // 1. Create Mock Layers
    const PocketBaseServiceMock = Layer.succeed(PocketBaseService, {
      getChannels: () => Effect.succeed([]),
      isAuthenticated: () => false,
      authenticateAsAdmin: () => Effect.void,
      getPendingBatch: () => Effect.succeed({ id: 'batch-123' }),
      createBatch: () => Effect.succeed({ id: 'batch-123' }),
      getStagedVideos: () => Effect.succeed([
        { id: 'sv-1', title: 'Video 1', status: 'idle', privacyStatus: 'private', sort_order: 0 }
      ]),
      saveStagedVideo: (v: any) => Effect.succeed({ id: v.id || 'new-id' }),
      deleteStagedVideo: () => Effect.void,
    });

    const AppLayer = Layer.mergeAll(YouTubeServiceTauri, LoggerServiceLive, PocketBaseServiceMock);

    // 2. Verify Staging Load via Service
    const loadProgram = PocketBaseService.pipe(
      Effect.flatMap(pb => pb.getStagedVideos('batch-123'))
    );
    const staged = await Effect.runPromise(Effect.provide(loadProgram, AppLayer));
    expect(staged).toHaveLength(1);
    expect(staged[0].title).toBe('Video 1');

    // 3. Simulate User Starting Batch (Calling YouTubeService)
    (invoke as any).mockResolvedValue({ video_id: 'dummy_yt_123', status: 'Success' });
    
    const metadata: any = {
      title: staged[0].title,
      description: '',
      privacyStatus: staged[0].privacyStatus,
      license: 'youtube',
      tags: [],
      categoryId: '22',
      thumbnailUrl: Option.none(),
      scheduledStartTime: Option.none(),
      publishAt: Option.none(),
      recordingDate: Option.none(),
      language: Option.none(),
    };

    const uploadProgram = YouTubeService.pipe(
      // Note: we use undefined for thumbnail
      Effect.flatMap(service => service.uploadVideo(metadata, new Blob(['video']), undefined))
    );

    const videoId = await Effect.runPromise(Effect.provide(uploadProgram, AppLayer));
    
    // 4. Verify interaction with Tauri Backend
    expect(videoId).toBe('dummy_yt_123');
    expect(invoke).toHaveBeenCalledWith('start_youtube_upload_job', expect.anything());
  });
});
