import { describe, it, expect, beforeAll } from 'vitest';
import { Effect, Option } from 'effect';
import { PocketBaseService, PocketBaseServiceLive, pb } from '../lib/pocketbase';
import { YouTubeService, YouTubeServiceLive, processBatch } from '../lib/youtube/service';
import { LoggerServiceLive } from '../lib/logger';
import { compressToBrotliB64, decompressFromBrotliB64 } from '../lib/compression';
import { invoke } from '@tauri-apps/api/core';

// We mock tauri invoke calls here for mock YouTube api backend verification
import { vi } from 'vitest';

vi.mock('../lib/env', () => ({
  isTauri: () => true,
  isWeb: () => false,
  logPlatform: () => {},
  isDummyMode: () => true,
}));

describe('Bulk Staging & Stream Integration Stacking Pipeline', () => {
  const testUrl = 'http://127.0.0.1:8091';

  beforeAll(async () => {
    // Ensure we are pointing to the test DB
    process.env.VITE_TEST_PB_URL = testUrl;
    
    // Login as the test superuser
    await pb.collection('_superusers').authWithPassword('test@example.com', 'test123456');
  });

  it('provisions and executes a bulk pre-upload live stream staging queue', async () => {
    const program = Effect.gen(function* (_) {
      const pbService = yield* _(PocketBaseService);

      // 1. Create target channel
      const channel = yield* _(pbService.createChannel({
        name: 'Gamer Channel Prime',
        handle: '@gamer_prime',
        status: 'active',
        youtube_config_brotli_b64: 'empty'
      }));
      expect(channel.name).toBe('Gamer Channel Prime');

      // 2. Create target batch
      const batch = yield* _(pbService.createBatch(channel.id));
      expect(batch.status).toBe('pending');

      // 3. Stage 3 stream placeholders with offset times (Simulation of UI bulk creation)
      const baseTime = new Date('2026-06-01T12:00:00.000Z');
      const stagedList = [];

      for (let i = 0; i < 3; i++) {
        const streamTime = new Date(baseTime.getTime() + i * 3600000).toISOString(); // 1 hr spacing
        const originalDescription = `Exclusive gaming broadcast #${i + 1} staged for our premium subscribers.`;
        
        // Compress description using Brotli Base64
        const compressedDesc = yield* _(compressToBrotliB64(originalDescription));

        const savedVideo = yield* _(pbService.saveStagedVideo({
          batch_id: batch.id,
          title: `Championship Series Live #${i + 1}`,
          description_brotli_b64: compressedDesc,
          status: 'idle',
          job_type: 'LiveBroadcast',
          sort_order: i,
          privacyStatus: 'private',
          scheduledStartTime: streamTime,
          language: 'en',
          latencyPreference: 'normal'
        }));

        expect(savedVideo.title).toContain(`Championship Series Live #${i + 1}`);
        stagedList.push(savedVideo);
      }

      expect(stagedList).toHaveLength(3);

      // 4. Retrieve and verify sorting and Brotli Decompression
      const stagedFromDb = yield* _(pbService.getStagedVideos(batch.id));
      expect(stagedFromDb).toHaveLength(3);
      expect(stagedFromDb[0].sort_order).toBe(0);
      expect(stagedFromDb[1].sort_order).toBe(1);
      expect(stagedFromDb[2].sort_order).toBe(2);

      // Verify decompression of retrieved fields
      for (let i = 0; i < 3; i++) {
        const descB64 = stagedFromDb[i].description_brotli_b64;
        const decompressed = yield* _(decompressFromBrotliB64(descB64));
        expect(decompressed).toBe(`Exclusive gaming broadcast #${i + 1} staged for our premium subscribers.`);
      }

      // 5. Build and execute mock Batch execution flow
      const batchPayload = {
        channelId: channel.id,
        videos: stagedFromDb.map(sv => ({
          job_type: 'LiveBroadcast' as const,
          title: sv.title,
          description: sv.title + " stream description", // Test decompress values
          privacyStatus: sv.privacyStatus as any,
          license: 'youtube',
          embeddable: true,
          publicStatsViewable: true,
          madeForKids: false,
          containsSyntheticMedia: false,
          paidProductPlacement: false,
          tags: ['esports'],
          categoryId: '20',
          subDetails: {},
          thumbnailUrl: Option.none(),
          scheduledStartTime: Option.some(sv.scheduledStartTime),
          scheduledEndTime: Option.none(),
          publishAt: Option.none(),
          recordingDate: Option.none(),
          language: Option.some('en'),
          defaultLanguage: Option.none(),
          defaultAudioLanguage: Option.none(),
          latencyPreference: Option.some('normal'),
          enableAutoStart: Option.some(false),
          enableAutoStop: Option.some(false),
          enableDvr: Option.some(true),
          enableContentEncryption: Option.some(false),
          startWithLowLatency: Option.some(false),
          recordFromStart: Option.some(true),
          enableMonitorStream: Option.some(true),
          broadcastStreamDelayMs: Option.some(0),
          projection: Option.some('rectangular' as const),
          localizations: Option.none()
        }))
      };

      // Mock tauri invoke start_youtube_upload_job responses
      vi.mocked(invoke).mockResolvedValue({ video_id: 'mock_stream_yt_123', status: 'Success' });

      // Run Batch Processing Effect Stream (12-Factor concurrent pipeline)
      const batchResult = yield* _(
        processBatch(batchPayload, [], [undefined, undefined, undefined], 'schedule')
      );

      // Convert Chunk to standard array for iteration
      const batchResultArray = Array.from(batchResult);

      // Verify all 3 live streams queued successfully to backend
      expect(batchResultArray).toHaveLength(3);
      batchResultArray.forEach(res => {
        expect(res).toBe('mock_stream_yt_123');
      });

      return batch;
    });

    const appLayer = Effect.provide(program, PocketBaseServiceLive).pipe(
      Effect.provide(YouTubeServiceLive),
      Effect.provide(LoggerServiceLive)
    );

    await Effect.runPromise(appLayer);
  });

  it('supports bulk editing staged video metadata properties', async () => {
    const program = Effect.gen(function* (_) {
      const pbService = yield* _(PocketBaseService);

      // 1. Create a channel and batch
      const channel = yield* _(pbService.createChannel({
        name: 'Bulk Edit Channel',
        handle: '@bulk_edit',
        status: 'active',
        youtube_config_brotli_b64: 'empty'
      }));
      const batch = yield* _(pbService.createBatch(channel.id));

      // 2. Stage 2 items with generic metadata
      const v1 = yield* _(pbService.saveStagedVideo({
        batch_id: batch.id,
        title: 'Draft Stream A',
        status: 'idle',
        job_type: 'LiveBroadcast',
        sort_order: 0,
        privacyStatus: 'private'
      }));
      const v2 = yield* _(pbService.saveStagedVideo({
        batch_id: batch.id,
        title: 'Draft Stream B',
        status: 'idle',
        job_type: 'LiveBroadcast',
        sort_order: 1,
        privacyStatus: 'private'
      }));

      // 3. Perform bulk edit equivalent operation
      const bulkDesc = "This is a bulk applied description!";
      const compressedBulkDesc = yield* _(compressToBrotliB64(bulkDesc));
      
      const bulkUpdatedV1 = yield* _(pbService.saveStagedVideo({
        id: v1.id,
        batch_id: batch.id,
        title: 'Draft Stream A - Bulk Approved',
        description_brotli_b64: compressedBulkDesc,
        status: 'idle',
        job_type: 'LiveBroadcast',
        sort_order: 0,
        privacyStatus: 'public',
        categoryId: '20'
      }));
      
      const bulkUpdatedV2 = yield* _(pbService.saveStagedVideo({
        id: v2.id,
        batch_id: batch.id,
        title: 'Draft Stream B - Bulk Approved',
        description_brotli_b64: compressedBulkDesc,
        status: 'idle',
        job_type: 'LiveBroadcast',
        sort_order: 1,
        privacyStatus: 'public',
        categoryId: '20'
      }));

      // 4. Verify persistence and decompression
      const stagedFromDb = yield* _(pbService.getStagedVideos(batch.id));
      expect(stagedFromDb).toHaveLength(2);
      
      const check1 = stagedFromDb.find(v => v.id === v1.id)!;
      const check2 = stagedFromDb.find(v => v.id === v2.id)!;
      
      expect(check1.title).toBe('Draft Stream A - Bulk Approved');
      expect(check1.privacyStatus).toBe('public');
      
      expect(check2.title).toBe('Draft Stream B - Bulk Approved');
      expect(check2.privacyStatus).toBe('public');
      
      const decomp1 = yield* _(decompressFromBrotliB64(check1.description_brotli_b64));
      expect(decomp1).toBe(bulkDesc);
    });

    const appLayer = Effect.provide(program, PocketBaseServiceLive).pipe(
      Effect.provide(YouTubeServiceLive),
      Effect.provide(LoggerServiceLive)
    );

    await Effect.runPromise(appLayer);
  });
});
