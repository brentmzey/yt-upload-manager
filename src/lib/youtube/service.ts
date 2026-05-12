import { Effect, Context, Stream, Layer } from 'effect';
import { VideoMetadataSchema, BatchUploadSchema } from '../channel/config';
import { logInfo, logError, LoggerService } from '../logger';
import { enrichMetadata } from './enrichment';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { VideoMetadataPayload, BatchJobResponse, YouTubeVideoDetails, YouTubeJobType } from '../../bindings/youtube_types';
import { Option } from 'effect';
import { isTauri } from '../env';
import { compressToBrotliB64 } from '../compression';

// 12-Factor: Edge backend URL for web environment
const EDGE_BACKEND_URL = import.meta.env.PUBLIC_EDGE_BACKEND_URL || 'https://api.yt-manager.com';

export class YouTubeError {
  readonly _tag = 'YouTubeError';
  constructor(readonly message: string, readonly cause?: unknown) {}
}

export interface YouTubeService {
  readonly uploadVideo: (
    metadata: typeof VideoMetadataSchema.Type,
    file: Blob,
    thumbnail?: Blob
  ) => Effect.Effect<string, YouTubeError, LoggerService>;
  
  readonly scheduleLiveStream: (
    metadata: typeof VideoMetadataSchema.Type,
    thumbnail?: Blob
  ) => Effect.Effect<string, YouTubeError, LoggerService>;

  readonly onJobCompleted: (
    handler: (response: BatchJobResponse) => void
  ) => Effect.Effect<() => void, YouTubeError>;

  readonly getVideoDetails: (
    videoId: string
  ) => Effect.Effect<YouTubeVideoDetails, YouTubeError>;
}

export const YouTubeService = Context.GenericTag<YouTubeService>('YouTubeService');

const fileToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]); // Remove data:image/png;base64,
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

const toPayload = async (metadata: typeof VideoMetadataSchema.Type, job_type: YouTubeJobType, thumbnailB64: string | null = null): Promise<VideoMetadataPayload> => {
  const scheduledTime = Option.getOrNull(metadata.scheduledStartTime);
  let millis: bigint | null = null;
  if (scheduledTime) {
    try {
      millis = BigInt(new Date(scheduledTime).getTime());
    } catch (e) {
      console.error("Failed to parse scheduled time for millis", e);
    }
  }

  // Handle compression at the boundary
  const compressedFields: string[] = [];
  let description = metadata.description;
  
  try {
    const descResult = await Effect.runPromise(compressToBrotliB64(description));
    description = descResult;
    compressedFields.push('description');
  } catch (e) {
    console.error("Compression failed at boundary, falling back to raw", e);
  }

  return {
    job_type,
    title: metadata.title,
    description,
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
    thumbnail_data_b64: thumbnailB64,
    scheduled_start_time: scheduledTime,
    scheduled_start_time_millis: millis,
    scheduled_end_time: Option.getOrNull(metadata.scheduledEndTime),
    publish_at: Option.getOrNull(metadata.publishAt),
    recording_date: Option.getOrNull(metadata.recordingDate),
    language: Option.getOrNull(metadata.language),
    default_language: Option.getOrNull(metadata.defaultLanguage),
    default_audio_language: Option.getOrNull(metadata.defaultAudioLanguage),
    latency_preference: Option.getOrNull(metadata.latencyPreference),
    enable_auto_start: Option.getOrNull(metadata.enableAutoStart),
    enable_auto_stop: Option.getOrNull(metadata.enableAutoStop),
    enable_dvr: Option.getOrNull(metadata.enableDvr),
    enable_content_encryption: Option.getOrNull(metadata.enableContentEncryption),
    start_with_low_latency: Option.getOrNull(metadata.startWithLowLatency),
    record_from_start: Option.getOrNull(metadata.recordFromStart),
    enable_monitor_stream: Option.getOrNull(metadata.enableMonitorStream),
    broadcast_stream_delay_ms: Option.getOrNull(metadata.broadcastStreamDelayMs),
    projection: Option.getOrNull(metadata.projection),
    is_compressed: compressedFields.length > 0,
    compressed_fields: compressedFields,
  };
};

// --- TAURI IMPLEMENTATION ---
export const YouTubeServiceTauri = Layer.succeed(
  YouTubeService,
  {
    uploadVideo: (metadata, _file, thumbnail) =>
      Effect.gen(function* (_) {
        yield* _(logInfo('Tauri: Queueing backend upload job', { title: metadata.title }));
        const thumbnailB64 = thumbnail ? yield* _(Effect.promise(() => fileToBase64(thumbnail))) : null;
        const payload = yield* _(Effect.promise(() => toPayload(metadata, 'VideoUpload', thumbnailB64)));
        const response = yield* _(
          Effect.tryPromise({
            try: () => invoke<BatchJobResponse>('start_youtube_upload_job', { payload }),
            catch: (error) => new YouTubeError("Tauri backend job failed", error),
          })
        );
        return response.video_id;
      }),
      
    scheduleLiveStream: (metadata, thumbnail) =>
      Effect.gen(function* (_) {
        yield* _(logInfo('Tauri: Queueing backend scheduling job', { title: metadata.title }));
        const thumbnailB64 = thumbnail ? yield* _(Effect.promise(() => fileToBase64(thumbnail))) : null;
        const payload = yield* _(Effect.promise(() => toPayload(metadata, 'LiveBroadcast', thumbnailB64)));
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
      
    getVideoDetails: (videoId) =>
      Effect.tryPromise({
        try: () => invoke<YouTubeVideoDetails>('get_youtube_video_details', { videoId }),
        catch: (error) => new YouTubeError("Tauri backend getVideoDetails failed", error),
      }),
  }
);

// --- WEB IMPLEMENTATION (Edge Backend) ---
export const YouTubeServiceWeb = Layer.succeed(
  YouTubeService,
  {
      uploadVideo: (metadata, file, thumbnail) =>
      Effect.gen(function* (_) {
        yield* _(logInfo('Web: Sending upload to Edge backend', { title: metadata.title }));
        
        const payload = yield* _(Effect.promise(() => toPayload(metadata, 'VideoUpload')));
        const formData = new FormData();
        formData.append('metadata', JSON.stringify(payload, (_, v) => typeof v === 'bigint' ? v.toString() : v));
        formData.append('video', file);
        if (thumbnail) {
          formData.append('thumbnail', thumbnail);
        }

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
      
    scheduleLiveStream: (metadata, thumbnail) =>
      Effect.gen(function* (_) {
        yield* _(logInfo('Web: Sending scheduling to Edge backend', { title: metadata.title }));
        
        const payload = yield* _(Effect.promise(() => toPayload(metadata, 'LiveBroadcast')));
        const formData = new FormData();
        formData.append('metadata', JSON.stringify(payload, (_, v) => typeof v === 'bigint' ? v.toString() : v));
        if (thumbnail) {
          formData.append('thumbnail', thumbnail);
        }

        const response = yield* _(
          Effect.tryPromise({
            try: () => fetch(`${EDGE_BACKEND_URL}/schedule`, {
              method: 'POST',
              body: formData,
            }).then(r => r.json() as Promise<BatchJobResponse>),
            catch: (error) => new YouTubeError("Web Edge backend scheduling failed", error),
          })
        );

        return response.video_id;
      }),

    onJobCompleted: (_handler) =>
      Effect.sync(() => () => {}),

    getVideoDetails: (videoId) =>
      Effect.succeed({
        id: videoId,
        title: `Mock Edge Backend Title for ${videoId}`,
        description: "This is a dummy description fetched from the mock Edge Backend API.",
        thumbnail_url: "https://picsum.photos/640/360",
        privacy_status: "private",
        view_count: 0n,
        url: `https://youtube.com/watch?v=${videoId}`
      }),
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
  thumbnails: (Blob | undefined)[],
  mode: 'upload' | 'schedule'
) => {
  // 1. Prepare tasks with original indices to keep track of files/thumbnails
  const tasks = batch.videos.map((v, i) => ({ metadata: v, file: files[i], thumbnail: thumbnails[i] }));
  
  // 2. Sort by scheduledStartTime if in schedule mode
  if (mode === 'schedule') {
    tasks.sort((a, b) => {
      const timeA = Option.getOrNull(a.metadata.scheduledStartTime);
      const timeB = Option.getOrNull(b.metadata.scheduledStartTime);
      if (!timeA) return 1;
      if (!timeB) return -1;
      return new Date(timeA).getTime() - new Date(timeB).getTime();
    });
  }

  return Stream.fromIterable(tasks)
    .pipe(
      Stream.mapEffect(({ metadata, file, thumbnail }) =>
        Effect.gen(function* (_) {
          const enriched = yield* _(enrichMetadata(metadata));
          const service = yield* _(YouTubeService);
          return mode === 'upload' 
            ? yield* _(service.uploadVideo(enriched, file, thumbnail))
            : yield* _(service.scheduleLiveStream(enriched, thumbnail));
        }),
        { concurrency: 5 } // Allow queueing up to 5 jobs concurrently to the backend
      ),
      Stream.runCollect
    );
};

