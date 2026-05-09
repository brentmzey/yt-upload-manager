import { Effect, Option } from "effect";
import { 
  VideoMetadataSchema, 
  StagedVideoRecordSchema,
  ChannelSchema,
  ChannelRecordSchema
} from "./channel/config";
import { 
  compressToBrotliB64, 
  decompressFromBrotliB64, 
  CompressionError
} from "./compression";

/**
 * Transforms a Channel domain object into a ChannelRecord for PocketBase storage.
 */
export const channelToStorage = (
  domain: typeof ChannelSchema.Type
): Effect.Effect<Omit<typeof ChannelRecordSchema.Type, 'created' | 'updated' | 'id'>, CompressionError> =>
  Effect.gen(function* (_) {
    const configStr = JSON.stringify(domain.youtubeConfig);
    const youtube_config_brotli_b64 = yield* _(compressToBrotliB64(configStr));
    return {
      name: domain.name,
      handle: domain.name.toLowerCase().replace(/\s+/g, '_'), // Simple derived handle for now
      status: 'pending' as const,
      youtube_config_brotli_b64,
      last_error: Option.none(),
      last_sync_at: Option.none(),
    };
  });

/**
 * Transforms a ChannelRecord into a Channel domain object.
 */
export const channelToDomain = (
  storage: typeof ChannelRecordSchema.Type
): Effect.Effect<typeof ChannelSchema.Type, CompressionError> =>
  Effect.gen(function* (_) {
    const configRaw = yield* _(decompressFromBrotliB64(storage.youtube_config_brotli_b64));
    return {
      id: storage.id,
      name: storage.name,
      youtubeConfig: JSON.parse(configRaw),
    };
  });

/**
 * Transforms a VideoMetadata domain object into a StagedVideoRecord for PocketBase storage.
 */
export const stagedVideoToStorage = (
  batchId: string,
  domain: typeof VideoMetadataSchema.Type,
  status: 'idle' | 'processing' | 'success' | 'error' = 'idle',
  index: number = 0
): Effect.Effect<Omit<typeof StagedVideoRecordSchema.Type, 'created' | 'id'>, CompressionError> =>
  Effect.gen(function* (_) {
    const description_brotli_b64 = yield* _(compressToBrotliB64(domain.description));

    return {
      batch_id: batchId,
      status,
      title: domain.title,
      description_brotli_b64: Option.some(description_brotli_b64),
      privacyStatus: domain.privacyStatus,
      license: Option.some(domain.license),
      embeddable: Option.some(domain.embeddable),
      publicStatsViewable: Option.some(domain.publicStatsViewable),
      madeForKids: Option.some(domain.madeForKids),
      tags: Option.some([...domain.tags]),
      categoryId: Option.some(domain.categoryId),
      thumbnailUrl: domain.thumbnailUrl,
      scheduledStartTime: domain.scheduledStartTime,
      publishAt: domain.publishAt,
      recordingDate: domain.recordingDate,
      language: domain.language,
      sort_order: Option.some(index),
      error_message: Option.none(),
      finished_at: Option.none(),
      latencyPreference: domain.latencyPreference,
      enableAutoStart: domain.enableAutoStart,
      enableAutoStop: domain.enableAutoStop,
      enableDvr: domain.enableDvr,
      enableContentEncryption: domain.enableContentEncryption,
      startWithLowLatency: domain.startWithLowLatency,
      recordFromStart: domain.recordFromStart,
      enableMonitorStream: domain.enableMonitorStream,
      broadcastStreamDelayMs: domain.broadcastStreamDelayMs,
      projection: domain.projection,
      scheduledEndTime: domain.scheduledEndTime,
      defaultLanguage: domain.defaultLanguage,
      defaultAudioLanguage: domain.defaultAudioLanguage,
      is_archived: Option.some(false),
      notes: Option.none(),
      metadata_json: Option.none(),
    };
  });

/**
 * Transforms a StagedVideoRecord from PocketBase back into a VideoMetadata domain object.
 */
export const stagedVideoToDomain = (
  storage: typeof StagedVideoRecordSchema.Type
): Effect.Effect<typeof VideoMetadataSchema.Type, CompressionError> =>
  Effect.gen(function* (_) {
    const description = storage.description_brotli_b64._tag === 'Some' 
      ? yield* _(decompressFromBrotliB64(storage.description_brotli_b64.value))
      : "";

    return {
      title: storage.title,
      description,
      privacyStatus: storage.privacyStatus,
      license: (storage.license._tag === 'Some' ? storage.license.value : 'youtube') as any,
      embeddable: storage.embeddable._tag === 'Some' ? storage.embeddable.value : true,
      publicStatsViewable: storage.publicStatsViewable._tag === 'Some' ? storage.publicStatsViewable.value : true,
      madeForKids: storage.madeForKids._tag === 'Some' ? storage.madeForKids.value : false,
      containsSyntheticMedia: false, 
      paidProductPlacement: false,
      tags: storage.tags._tag === 'Some' ? storage.tags.value : [],
      categoryId: storage.categoryId._tag === 'Some' ? storage.categoryId.value : '22',
      subDetails: {},
      thumbnailUrl: storage.thumbnailUrl,
      scheduledStartTime: storage.scheduledStartTime,
      scheduledEndTime: storage.scheduledEndTime,
      publishAt: storage.publishAt,
      recordingDate: storage.recordingDate,
      language: storage.language,
      defaultLanguage: storage.defaultLanguage,
      defaultAudioLanguage: storage.defaultAudioLanguage,
      latencyPreference: storage.latencyPreference,
      enableAutoStart: storage.enableAutoStart,
      enableAutoStop: storage.enableAutoStop,
      enableDvr: storage.enableDvr,
      enableContentEncryption: storage.enableContentEncryption,
      startWithLowLatency: storage.startWithLowLatency,
      recordFromStart: storage.recordFromStart,
      enableMonitorStream: storage.enableMonitorStream,
      broadcastStreamDelayMs: storage.broadcastStreamDelayMs,
      projection: storage.projection,
      localizations: Option.none(),
    };
  });
