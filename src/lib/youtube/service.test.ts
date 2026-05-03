import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Effect, Layer, Option } from 'effect';
import { YouTubeService, YouTubeServiceWeb, YouTubeServiceTauri } from './service';
import { LoggerServiceWeb } from '../logger';
import { invoke } from '@tauri-apps/api/core';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

describe('YouTubeService', () => {
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
    thumbnailUrl: Option.none(),
    scheduledStartTime: Option.some('2024-05-02T12:00:00Z'),
    publishAt: Option.none(),
    recordingDate: Option.none(),
    language: Option.none(),
  };

  describe('YouTubeServiceWeb', () => {
    beforeEach(() => {
      vi.stubGlobal('fetch', vi.fn());
    });

    it('uploads video with thumbnail to edge backend using FormData', async () => {
      const mockResponse = { video_id: 'web-vid-123', status: 'Success' };
      (fetch as any).mockResolvedValue({
        json: () => Promise.resolve(mockResponse),
      });

      const videoBlob = new Blob(['video'], { type: 'video/mp4' });
      const thumbBlob = new Blob(['thumb'], { type: 'image/png' });

      const program = YouTubeService.pipe(
        Effect.flatMap(service => service.uploadVideo(metadata, videoBlob, thumbBlob))
      );

      const result = await Effect.runPromise(
        Effect.provide(program, Layer.mergeAll(YouTubeServiceWeb, LoggerServiceWeb))
      );

      expect(result).toBe('web-vid-123');
      const fetchCall = (fetch as any).mock.calls[0];
      const formData = fetchCall[1].body as FormData;
      
      expect(formData.get('video')).toBeDefined();
      expect(formData.get('thumbnail')).toBeDefined();
      
      const sentMetadata = JSON.parse(formData.get('metadata') as string);
      expect(sentMetadata.scheduled_start_time_millis).toBeDefined();
      // 2024-05-02T12:00:00Z -> 1714651200000
      expect(sentMetadata.scheduled_start_time_millis.toString()).toBe('1714651200000');
    });
  });

  describe('YouTubeServiceTauri', () => {
    it('invokes tauri command with base64 thumbnail and millis', async () => {
      (invoke as any).mockResolvedValue({ video_id: 'tauri-vid-123', status: 'Processing' });
      
      const videoBlob = new Blob(['video'], { type: 'video/mp4' });
      const thumbBlob = new Blob(['thumb'], { type: 'image/png' });

      // Mock FileReader for base64 conversion
      const mockBase64 = 'dGh1bWI='; // 'thumb' in base64
      class MockFileReader {
        onload: any;
        result: string = '';
        readAsDataURL(blob: Blob) {
          setTimeout(() => {
            this.result = 'data:image/png;base64,' + mockBase64;
            this.onload();
          }, 0);
        }
      }
      vi.stubGlobal('FileReader', MockFileReader);

      const program = YouTubeService.pipe(
        Effect.flatMap(service => service.uploadVideo(metadata, videoBlob, thumbBlob))
      );

      const result = await Effect.runPromise(
        Effect.provide(program, Layer.mergeAll(YouTubeServiceTauri, LoggerServiceWeb))
      );

      expect(result).toBe('tauri-vid-123');
      expect(invoke).toHaveBeenCalledWith('start_youtube_upload_job', expect.objectContaining({
        payload: expect.objectContaining({
          thumbnail_data_b64: mockBase64,
          scheduled_start_time_millis: 1714651200000n
        })
      }));
    });
  });
});
