import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Effect, Layer, Option } from 'effect';
import { pb, PocketBaseService, PocketBaseServiceLive } from '../lib/pocketbase';
import { YouTubeService, YouTubeServiceWeb } from '../lib/youtube/service';
import { LoggerServiceWeb } from '../lib/logger';

/**
  * Live integration test for scheduling live broadcasts (future streams)
  * and managing cleanup operations.
  */
describe('YouTube Live Broadcast Integration Pipeline', () => {
  const testUrl = 'http://127.0.0.1:8091';
  const originalFetch = globalThis.fetch;

  beforeAll(async () => {
    // Point to the test DB
    process.env.VITE_TEST_PB_URL = testUrl;

    // Selective fetch spy: intercepts remote YouTube Edge calls but lets PocketBase DB calls pass through!
    globalThis.fetch = async (input: any, init?: any) => {
      const url = typeof input === 'string' ? input : input.url || '';
      if (url.includes('api.yt-manager.com')) {
        if (url.includes('/schedule')) {
          return new Response(JSON.stringify({ video_id: 'mock_yt_stream_999', status: 'Success' }));
        }
      }
      return originalFetch(input, init);
    };
    
    // Login as the test superuser
    await pb.collection('_superusers').authWithPassword('test@example.com', 'test123456');
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('stages a future stream with thumbnail, verifies details via YouTube service, and cleans up', async () => {
    const program = Effect.gen(function* (_) {
      const pbService = yield* _(PocketBaseService);
      const ytService = yield* _(YouTubeService);

      // 1. Create a channel and batch first to satisfy relational database constraints
      const channel = yield* _(
        pbService.createChannel({
          name: 'Esports Integration Channel',
          handle: '@esports_integration',
          status: 'active',
          youtube_config_brotli_b64: 'mock_config',
        })
      );

      const batch = yield* _(pbService.createBatch(channel.id));

      // 2. Stage a future stream placeholder in the database
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const staged = yield* _(
        pbService.saveStagedVideo({
          batch_id: batch.id,
          title: 'E2E Esports Live Tournament 2026',
          description_brotli_b64: 'mock_desc',
          status: 'idle',
          job_type: 'LiveBroadcast',
          privacyStatus: 'private',
          scheduledStartTime: tomorrow.toISOString(),
          latencyPreference: 'ultraLow',
        })
      );

      expect(staged.id).toBeDefined();
      expect(staged.title).toBe('E2E Esports Live Tournament 2026');

      // 2. Schedule/upload the future stream placeholder to YouTube via YouTubeService
      const metadata = {
        job_type: 'LiveBroadcast' as const,
        title: staged.title,
        description: 'Exclusive livestream broadcast of the final tournament.',
        privacyStatus: 'private' as const,
        license: 'youtube',
        embeddable: true,
        publicStatsViewable: true,
        madeForKids: false,
        containsSyntheticMedia: false,
        paidProductPlacement: false,
        tags: ['esports', 'tournament'],
        categoryId: '20',
        subDetails: {},
        thumbnailUrl: Option.none(),
        scheduledStartTime: Option.some(staged.scheduledStartTime),
        scheduledEndTime: Option.none(),
        publishAt: Option.none(),
        recordingDate: Option.none(),
        language: Option.some('en'),
        defaultLanguage: Option.none(),
        defaultAudioLanguage: Option.none(),
        latencyPreference: Option.some('ultraLow'),
        enableAutoStart: Option.some(true),
        enableAutoStop: Option.some(true),
        enableDvr: Option.some(true),
        enableContentEncryption: Option.some(false),
        startWithLowLatency: Option.some(false),
        recordFromStart: Option.some(true),
        enableMonitorStream: Option.some(true),
        broadcastStreamDelayMs: Option.some(0),
        projection: Option.some('rectangular'),
        localizations: Option.none(),
      };

      const mockThumbnail = new Blob(['mock_thumb_data'], { type: 'image/png' });
      const videoId = yield* _(ytService.scheduleLiveStream('ch-esports-channel', metadata, mockThumbnail));
      expect(videoId).toBeDefined();

      // 3. Verify stream availability and deep details
      const details = yield* _(ytService.getVideoDetails(videoId));
      expect(details.id).toBe(videoId);
      expect(details.privacy_status).toBe('private');

      // 4. Remove/Clean up the staged video task from database to finalize test
      yield* _(pbService.deleteStagedVideo(staged.id));

      // 5. Verify it is successfully removed from the database
      const stagedList = yield* _(pbService.getStagedVideos(batch.id));
      const exists = stagedList.some((v) => v.id === staged.id);
      expect(exists).toBe(false);

      return { videoId, details };
    });

    const runtimeLayer = Layer.mergeAll(
      PocketBaseServiceLive,
      YouTubeServiceWeb,
      LoggerServiceWeb
    );

    const result = await Effect.runPromise(Effect.provide(program, runtimeLayer));
    expect(result.videoId).toBeDefined();
    expect(result.details.id).toBe(result.videoId);
  });
});
