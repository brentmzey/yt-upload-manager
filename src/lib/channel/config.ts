import { Schema } from "@effect/schema";

// --- Domain Models (Clean, uncompressed, used by UI and Logic) ---

export const YouTubeConfigSchema = Schema.Struct({
  clientId: Schema.String,
  scopes: Schema.Array(Schema.String),
});

export const ChannelSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  youtubeConfig: YouTubeConfigSchema,
});

export const YouTubePrivacyStatus = Schema.Literal('public', 'private', 'unlisted');
export const YouTubeLicense = Schema.Literal('youtube', 'creativeCommon');

export const VideoMetadataSchema = Schema.Struct({
  title: Schema.String.pipe(Schema.nonEmptyString()),
  description: Schema.String,
  privacyStatus: YouTubePrivacyStatus,
  license: YouTubeLicense,
  embeddable: Schema.Boolean,
  publicStatsViewable: Schema.Boolean,
  madeForKids: Schema.Boolean,
  containsSyntheticMedia: Schema.Boolean,
  paidProductPlacement: Schema.Boolean,
  tags: Schema.Array(Schema.String),
  categoryId: Schema.String,
  subDetails: Schema.Record({ key: Schema.String, value: Schema.String }),
  thumbnailUrl: Schema.Option(Schema.String),
  scheduledStartTime: Schema.Option(Schema.String),
  publishAt: Schema.Option(Schema.String),
  recordingDate: Schema.Option(Schema.String),
  language: Schema.Option(Schema.String),
  localizations: Schema.Option(Schema.Record({ 
    key: Schema.String, 
    value: Schema.Struct({ title: Schema.String, description: Schema.String }) 
  })),
});

// --- Storage Models (PocketBase specific, compressed, indexed) ---

/**
 * PocketBase representation of a Channel.
 */
export const ChannelRecordSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  youtube_config_brotli_b64: Schema.String,
  created: Schema.String,
  updated: Schema.String,
});

/**
 * PocketBase representation of a Batch.
 */
export const BatchRecordSchema = Schema.Struct({
  id: Schema.String,
  channel_id: Schema.String, // Relation -> channels
  status: Schema.Literal('pending', 'processing', 'completed', 'failed'),
  scheduled_for: Schema.Option(Schema.String),
  created: Schema.String,
});

/**
 * PocketBase representation of a Staged Video.
 */
export const StagedVideoRecordSchema = Schema.Struct({
  id: Schema.String,
  batch_id: Schema.String, // Relation -> batches
  status: Schema.Literal('idle', 'processing', 'success', 'error'),
  title: Schema.String,
  description_brotli_b64: Schema.String,
  privacyStatus: YouTubePrivacyStatus,
  license: YouTubeLicense,
  embeddable: Schema.Boolean,
  publicStatsViewable: Schema.Boolean,
  madeForKids: Schema.Boolean,
  containsSyntheticMedia: Schema.Boolean,
  paidProductPlacement: Schema.Boolean,
  tags: Schema.Array(Schema.String),
  categoryId: Schema.String,
  subDetails_brotli_b64: Schema.String,
  thumbnailUrl: Schema.Option(Schema.String),
  scheduledStartTime: Schema.Option(Schema.String),
  publishAt: Schema.Option(Schema.String),
  recordingDate: Schema.Option(Schema.String),
  language: Schema.Option(Schema.String),
  localizations_brotli_b64: Schema.Option(Schema.String),
  error_log: Schema.Option(Schema.String),
  created: Schema.String,
});

// Legacy BatchUploadSchema for specific processing logic
export const BatchUploadSchema = Schema.Struct({
  channelId: Schema.String,
  videos: Schema.Array(VideoMetadataSchema),
});
