import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Effect, Layer, Stream, Option, Chunk } from 'effect';
import { processBatch, YouTubeService } from './service';
import { LoggerService } from '../logger';

describe('Batch Processing Integration', () => {
  it('processes a full batch of videos with enrichment', async () => {
    // 1. Mock YouTube Service
    const mockUpload = vi.fn().mockReturnValue(Effect.succeed('vid-123'));
    const YouTubeServiceMock = Layer.succeed(YouTubeService, {
      uploadVideo: mockUpload,
      scheduleLiveStream: vi.fn(),
      onJobCompleted: vi.fn().mockReturnValue(Effect.succeed(() => {})),
    });

    // 2. Mock Logger Service
    const LoggerServiceMock = Layer.succeed(LoggerService, {
      info: vi.fn().mockReturnValue(Effect.void),
      warn: vi.fn().mockReturnValue(Effect.void),
      error: vi.fn().mockReturnValue(Effect.void),
      debug: vi.fn().mockReturnValue(Effect.void),
      notify: vi.fn().mockReturnValue(Effect.void),
    });

    const metadata: any = {
      title: 'Video for {{name}}',
      description: 'Desc',
      privacyStatus: 'private',
      license: 'youtube',
      embeddable: true,
      publicStatsViewable: true,
      madeForKids: false,
      containsSyntheticMedia: false,
      paidProductPlacement: false,
      tags: [],
      categoryId: '22',
      subDetails: { name: 'UserA' },
      thumbnailUrl: Option.none(),
      scheduledStartTime: Option.none(),
      publishAt: Option.none(),
      recordingDate: Option.none(),
      language: Option.none(),
    };

    const batch: any = {
      channelId: 'ch-1',
      videos: [metadata, { ...metadata, subDetails: { name: 'UserB' } }]
    };

    const files = [new Blob(['v1']), new Blob(['v2'])];

    const program = processBatch(batch, files, 'upload');
    const result = await Effect.runPromise(
      Effect.provide(program, Layer.mergeAll(YouTubeServiceMock, LoggerServiceMock))
    );

    expect(Chunk.toReadonlyArray(result)).toHaveLength(2);
    expect(mockUpload).toHaveBeenCalledTimes(2);
    
    // Verify enrichment happened before upload
    expect(mockUpload).toHaveBeenNthCalledWith(1, expect.objectContaining({ title: 'Video for UserA' }), expect.anything());
    expect(mockUpload).toHaveBeenNthCalledWith(2, expect.objectContaining({ title: 'Video for UserB' }), expect.anything());
  });
});
