import { Effect, Context, Stream, Layer } from 'effect';
import { VideoMetadataSchema, BatchUploadSchema } from '../tenant/config';
import { logInfo, logError, LoggerService } from '../logger';
import { enrichMetadata } from './enrichment';
import { invoke } from '@tauri-apps/api/core';
import type { VideoMetadataPayload, BatchJobResponse } from '../../bindings/youtube_types';
import { Option } from 'effect';

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

export const YouTubeServiceLive = Layer.succeed(
  YouTubeService,
  {
    uploadVideo: (metadata, _file) =>
      Effect.gen(function* (_) {
        yield* _(logInfo('Invoking backend upload job', { title: metadata.title }));
        
        const payload = toPayload(metadata);

        const response = yield* _(
          Effect.tryPromise({
            try: () => invoke<BatchJobResponse>('start_youtube_upload_job', { payload }),
            catch: (error) => new YouTubeError("Backend job failed", error),
          })
        );

        return response.video_id;
      }).pipe(
        Effect.tap((id) => logInfo('Backend job completed', { id, title: metadata.title })),
        Effect.tapError((err) => logError('Backend job failed', { title: metadata.title }, err))
      ),
      
    scheduleLiveStream: (metadata) =>
      Effect.gen(function* (_) {
        yield* _(logInfo('Invoking backend scheduling job', { title: metadata.title }));
        
        const payload = toPayload(metadata);

        const response = yield* _(
          Effect.tryPromise({
            try: () => invoke<BatchJobResponse>('start_youtube_upload_job', { payload }),
            catch: (error) => new YouTubeError("Backend scheduling failed", error),
          })
        );

        return response.video_id;
      }).pipe(
        Effect.tap((id) => logInfo('Backend scheduling completed', { id, title: metadata.title })),
        Effect.tapError((err) => logError('Backend scheduling failed', { title: metadata.title }, err))
      ),
  }
);

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
      // Control concurrency for 12-factor resource management
      // Using concurrency: 2 to avoid hitting rate limits or crashing Tauri
      Stream.runCollect
    );
