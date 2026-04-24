import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Effect, Layer } from 'effect';
import { YouTubeService, YouTubeServiceWeb } from './service';
import { LoggerServiceWeb } from '../logger';

describe('YouTubeServiceWeb', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  it('uploads video to edge backend', async () => {
    const mockResponse = { video_id: 'test-vid-123', status: 'Success' };
    (fetch as any).mockResolvedValue({
      json: () => Promise.resolve(mockResponse),
    });

    const metadata: any = {
      title: 'Test Video',
      description: 'Test Desc',
      privacyStatus: 'private',
      license: 'youtube',
      embeddable: true,
      publicStatsViewable: true,
      madeForKids: false,
      containsSyntheticMedia: false,
      paidProductPlacement: false,
      tags: [],
      categoryId: '22',
      subDetails: {},
      thumbnailUrl: { _tag: 'None' },
      scheduledStartTime: { _tag: 'None' },
      publishAt: { _tag: 'None' },
      recordingDate: { _tag: 'None' },
      language: { _tag: 'None' },
    };

    const program = YouTubeService.pipe(
      Effect.flatMap(service => service.uploadVideo(metadata, new Blob(['test'], { type: 'video/mp4' })))
    );

    const result = await Effect.runPromise(
      Effect.provide(program, Layer.mergeAll(YouTubeServiceWeb, LoggerServiceWeb))
    );

    expect(result).toBe('test-vid-123');
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/upload'), expect.objectContaining({
      method: 'POST',
    }));
  });
});
