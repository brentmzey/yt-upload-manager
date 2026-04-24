import { Effect, Context, Stream, Layer } from 'effect';
import { VideoMetadataSchema, BatchUploadSchema } from '../channel/config';
import { logInfo, logError, LoggerService } from '../logger';
import { enrichMetadata } from './enrichment';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { VideoMetadataPayload, BatchJobResponse } from '../../bindings/youtube_types';
import { Option } from 'effect';
import { isTauri } from '../env';

// 12-Factor: Edge backend URL for web environment
const EDGE_BACKEND_URL = import.meta.env.PUBLIC_EDGE_BACKEND_URL || 'https://api.yt-manager.com';

export class YouTubeError {
  readonly _tag = 'YouTubeError';
  constructor(readonly message: string, readonly cause?: unknown) {}
}

export interface YouTubeService {
  readonly uploadVideo: (
    metadata: typeof VideoMetadataSchema.Type,
    file: Blob
  ) => Effect.Effect<string, YouTubeError, LoggerService>;
  
  readonly scheduleLiveStream: (
    metadata: typeof VideoMetadataSchema.Type
  ) => Effect.Effect<string, YouTubeError, LoggerService>;

  readonly onJobCompleted: (
    handler: (response: BatchJobResponse) => void
  ) => Effect.Effect<() => void, YouTubeError>;
}

export const YouTubeService = Context.GenericTag<YouTubeService>('YouTubeService');

const toPayload = (metadata: typeof VideoMetadataSchema.Type): VideoMetadataPayload => ({
  title: metadata.title,
  description: metadata.description,
  privacy_status: metadata.privacyStatus,
  license: metadata.license,
  embeddable: metadata.embeddable,
  public_stats_viewable: metadata.publicStatsViewable,
  made_for_kids: metadata.madeForKids,
  contains_synthetic_media: metadata.containsSyntheticMedia,
  paid_product_placement: metadata.paidProductPlacement,
  tags: [...metadata.tags],
  category_id: metadata.categoryId,
  sub_details: metadata.subDetails,
  thumbnail_url: Option.getOrNull(metadata.thumbnailUrl),
  scheduled_start_time: Option.getOrNull(metadata.scheduledStartTime),
  publish_at: Option.getOrNull(metadata.publishAt),
  recording_date: Option.getOrNull(metadata.recordingDate),
  language: Option.getOrNull(metadata.language),
});

// --- TAURI IMPLEMENTATION ---
export const YouTubeServiceTauri = Layer.succeed(
  YouTubeService,
  {
    uploadVideo: (metadata, _file) =>
      Effect.gen(function* (_) {
        yield* _(logInfo('Tauri: Queueing backend upload job', { title: metadata.title }));
        const payload = toPayload(metadata);
        const response = yield* _(
          Effect.tryPromise({
            try: () => invoke<BatchJobResponse>('start_youtube_upload_job', { payload }),
            catch: (error) => new YouTubeError("Tauri backend job failed", error),
          })
        );
        return response.video_id;
      }),
      
    scheduleLiveStream: (metadata) =>
      Effect.gen(function* (_) {
        yield* _(logInfo('Tauri: Queueing backend scheduling job', { title: metadata.title }));
        const payload = toPayload(metadata);
        const response = yield* _(
          Effect.tryPromise({
            try: () => invoke<BatchJobResponse>('start_youtube_upload_job', { payload }),
            catch: (error) => new YouTubeError("Tauri backend scheduling failed", error),
          })
        );
        return response.video_id;
      }),

    onJobCompleted: (handler) =>
      Effect.tryPromise({
        try: async () => {
          const unlisten = await listen<BatchJobResponse>('job-completed', (event) => {
            handler(event.payload);
          });
          return unlisten;
        },
        catch: (error) => new YouTubeError("Failed to subscribe to tauri events", error),
      }),
  }
);

// --- WEB IMPLEMENTATION (Edge Backend) ---
export const YouTubeServiceWeb = Layer.succeed(
  YouTubeService,
  {
    uploadVideo: (metadata, file) =>
      Effect.gen(function* (_) {
        yield* _(logInfo('Web: Sending upload to Edge backend', { title: metadata.title }));
        
        const formData = new FormData();
        formData.append('metadata', JSON.stringify(toPayload(metadata)));
        formData.append('video', file);

        const response = yield* _(
          Effect.tryPromise({
            try: () => fetch(`${EDGE_BACKEND_URL}/upload`, {
              method: 'POST',
              body: formData,
            }).then(r => r.json() as Promise<BatchJobResponse>),
            catch: (error) => new YouTubeError("Web Edge backend upload failed", error),
          })
        );

        return response.video_id;
      }),
      
    scheduleLiveStream: (metadata) =>
      Effect.gen(function* (_) {
        yield* _(logInfo('Web: Sending scheduling to Edge backend', { title: metadata.title }));
        
        const response = yield* _(
          Effect.tryPromise({
            try: () => fetch(`${EDGE_BACKEND_URL}/schedule`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(toPayload(metadata)),
            }).then(r => r.json() as Promise<BatchJobResponse>),
            catch: (error) => new YouTubeError("Web Edge backend scheduling failed", error),
          })
        );

        return response.video_id;
      }),

    onJobCompleted: (_handler) =>
      Effect.sync(() => () => {}),
  }
);

/**
 * Dynamic YouTube Service Layer based on environment
 */
export const YouTubeServiceLive = isTauri() ? YouTubeServiceTauri : YouTubeServiceWeb;

// High-level batch processing using Effect Streams
export const processBatch = (
  batch: typeof BatchUploadSchema.Type,
  files: Blob[],
  mode: 'upload' | 'schedule'
) =>
  Stream.fromIterable(batch.videos.map((v, i) => ({ metadata: v, file: files[i] })))
    .pipe(
      Stream.mapEffect(({ metadata, file }) =>
        Effect.gen(function* (_) {
          const enriched = yield* _(enrichMetadata(metadata));
          const service = yield* _(YouTubeService);
          return mode === 'upload' 
            ? yield* _(service.uploadVideo(enriched, file))
            : yield* _(service.scheduleLiveStream(enriched));
        })
      ),
      Stream.runCollect
    );
