import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Effect, Layer } from 'effect';
import { PocketBaseService, PocketBaseServiceLive, pb } from '../lib/pocketbase';

/**
 * REAL INTEGRATION TEST
 * Targets the test PocketBase instance on port 8091.
 */
describe('PocketBase Service Integration', () => {
  // Use the port defined in justfile:test-pb
  const testUrl = 'http://127.0.0.1:8091';
  
  beforeAll(async () => {
    // Ensure we are pointing to the test DB
    process.env.VITE_TEST_PB_URL = testUrl;
    
    // Login as the test superuser created in justfile
    await pb.collection('_superusers').authWithPassword('test@example.com', 'test123456');
  });

  it('creates and retrieves channels', async () => {
    const program = Effect.gen(function* (_) {
      const service = yield* _(PocketBaseService);
      
      // 1. Create a channel (providing required youtube_config_brotli_b64)
      const created = yield* _(service.createChannel({
        name: 'Test Channel Integration',
        handle: '@test_it',
        status: 'pending',
        youtube_config_brotli_b64: 'empty' 
      }));
      expect(created.name).toBe('Test Channel Integration');

      // 2. Retrieve list
      const channels = yield* _(service.getChannels());
      expect(channels.some(c => c.name === 'Test Channel Integration')).toBe(true);
      
      return created.id;
    });

    await Effect.runPromise(Effect.provide(program, PocketBaseServiceLive));
  });

  it('manages batches and staged videos', async () => {
    const program = Effect.gen(function* (_) {
      const service = yield* _(PocketBaseService);
      
      // 0. Create a real channel first to satisfy relation
      const channel = yield* _(service.createChannel({
        name: 'Batch Test Channel',
        handle: '@batch_test',
        status: 'active',
        youtube_config_brotli_b64: 'empty'
      }));

      // 1. Create batch
      const batch = yield* _(service.createBatch(channel.id));
      expect(batch.status).toBe('pending');

      // 2. Save staged video
      const video = yield* _(service.saveStagedVideo({
        batch_id: batch.id,
        title: 'Integration Test Video',
        status: 'idle',
        sort_order: 1,
        privacyStatus: 'public'
      }));
      expect(video.title).toBe('Integration Test Video');

      // 3. Retrieve staged videos
      const list = yield* _(service.getStagedVideos(batch.id));
      expect(list).toHaveLength(1);
      expect(list[0].title).toBe('Integration Test Video');
    });

    await Effect.runPromise(Effect.provide(program, PocketBaseServiceLive));
  });
});
