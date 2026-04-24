import { describe, it, expect, vi } from 'vitest';
import { Effect, Option } from 'effect';
import { channelToStorage, channelToDomain, stagedVideoToStorage, stagedVideoToDomain } from './mappers';

vi.mock('brotli-wasm', () => {
  return {
    default: Promise.resolve({
      compress: (input: Uint8Array) => input, // Passthrough mock
      decompress: (input: Uint8Array) => input, // Passthrough mock
    }),
  };
});

describe('Mappers', () => {
  describe('Channel Mappers', () => {
    it('maps channel domain to storage and back', async () => {
      const domain: any = {
        name: 'My Channel',
        youtubeConfig: { clientId: 'client-123', scopes: ['upload'] }
      };

      const storageEffect = channelToStorage(domain);
      const storage = await Effect.runPromise(storageEffect);

      expect(storage.name).toBe('My Channel');
      expect(storage.youtube_config_brotli_b64).toBeDefined();

      const backToDomainEffect = channelToDomain({ ...storage, id: 'id-1', created: '', updated: '' });
      const backToDomain = await Effect.runPromise(backToDomainEffect);

      expect(backToDomain.name).toBe('My Channel');
      expect(backToDomain.youtubeConfig.clientId).toBe('client-123');
    });
  });

  describe('Staged Video Mappers', () => {
    it('maps staged video domain to storage and back', async () => {
      const domain: any = {
        title: 'Video Title',
        description: 'Video Description',
        privacyStatus: 'private',
        license: 'youtube',
        embeddable: true,
        publicStatsViewable: true,
        madeForKids: false,
        containsSyntheticMedia: false,
        paidProductPlacement: false,
        tags: ['tag1', 'tag2'],
        categoryId: '22',
        subDetails: { key1: 'val1' },
        thumbnailUrl: Option.some('https://thumb.url'),
        scheduledStartTime: Option.none(),
        publishAt: Option.none(),
        recordingDate: Option.none(),
        language: Option.some('en'),
        localizations: Option.none(),
      };

      const storageEffect = stagedVideoToStorage('batch-1', domain);
      const storage = await Effect.runPromise(storageEffect);

      expect(storage.batch_id).toBe('batch-1');
      expect(storage.title).toBe('Video Title');
      expect(storage.tags).toEqual(['tag1', 'tag2']);

      const backToDomainEffect = stagedVideoToDomain({ ...storage, id: 'id-1', created: '' });
      const backToDomain = await Effect.runPromise(backToDomainEffect);

      expect(backToDomain.title).toBe('Video Title');
      expect(backToDomain.description).toBe('Video Description');
      expect(Option.getOrNull(backToDomain.thumbnailUrl)).toBe('https://thumb.url');
    });
  });
});
