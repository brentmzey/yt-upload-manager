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
      youtube_config_brotli_b64,
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
  errorMsg?: string
): Effect.Effect<Omit<typeof StagedVideoRecordSchema.Type, 'created' | 'id'>, CompressionError> =>
  Effect.gen(function* (_) {
    const description_brotli_b64 = yield* _(compressToBrotliB64(domain.description));
    const subDetails_brotli_b64 = yield* _(compressToBrotliB64(JSON.stringify(domain.subDetails)));

    const localizations_brotli_b64 = yield* _(
      Option.match(domain.localizations, {
        onNone: () => Effect.succeed(Option.none<string>()),
        onSome: (loc) => compressToBrotliB64(JSON.stringify(loc)).pipe(Effect.map(Option.some))
      })
    );

    return {
      batch_id: batchId,
      status,
      title: domain.title,
      description_brotli_b64,
      privacyStatus: domain.privacyStatus,
      license: domain.license,
      embeddable: domain.embeddable,
      publicStatsViewable: domain.publicStatsViewable,
      madeForKids: domain.madeForKids,
      containsSyntheticMedia: domain.containsSyntheticMedia,
      paidProductPlacement: domain.paidProductPlacement,
      tags: [...domain.tags],
      categoryId: domain.categoryId,
      subDetails_brotli_b64,
      thumbnailUrl: domain.thumbnailUrl,
      scheduledStartTime: domain.scheduledStartTime,
      publishAt: domain.publishAt,
      recordingDate: domain.recordingDate,
      language: domain.language,
      localizations_brotli_b64,
      error_log: errorMsg ? Option.some(errorMsg) : Option.none(),
    };
  });

/**
 * Transforms a StagedVideoRecord from PocketBase back into a VideoMetadata domain object.
 */
export const stagedVideoToDomain = (
  storage: typeof StagedVideoRecordSchema.Type
): Effect.Effect<typeof VideoMetadataSchema.Type, CompressionError> =>
  Effect.gen(function* (_) {
    const description = yield* _(decompressFromBrotliB64(storage.description_brotli_b64));
    const subDetailsRaw = yield* _(decompressFromBrotliB64(storage.subDetails_brotli_b64));
    
    const localizations = yield* _(
      Option.match(storage.localizations_brotli_b64, {
        onNone: () => Effect.succeed(Option.none<any>()),
        onSome: (locB64) => decompressFromBrotliB64(locB64).pipe(Effect.map(raw => Option.some(JSON.parse(raw))))
      })
    );

    return {
      title: storage.title,
      description,
      privacyStatus: storage.privacyStatus,
      license: storage.license,
      embeddable: storage.embeddable,
      publicStatsViewable: storage.publicStatsViewable,
      madeForKids: storage.madeForKids,
      containsSyntheticMedia: storage.containsSyntheticMedia,
      paidProductPlacement: storage.paidProductPlacement,
      tags: [...storage.tags],
      categoryId: storage.categoryId,
      subDetails: JSON.parse(subDetailsRaw),
      thumbnailUrl: storage.thumbnailUrl,
      scheduledStartTime: storage.scheduledStartTime,
      publishAt: storage.publishAt,
      recordingDate: storage.recordingDate,
      language: storage.language,
      localizations,
    };
  });
