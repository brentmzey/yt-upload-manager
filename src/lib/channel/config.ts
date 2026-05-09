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
export const YouTubeLatencyPreference = Schema.Literal('normal', 'low', 'ultraLow');
export const YouTubeProjection = Schema.Literal('rectangular', '360');

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
  scheduledEndTime: Schema.Option(Schema.String),
  publishAt: Schema.Option(Schema.String),
  recordingDate: Schema.Option(Schema.String),
  language: Schema.Option(Schema.String),
  defaultLanguage: Schema.Option(Schema.String),
  defaultAudioLanguage: Schema.Option(Schema.String),
  latencyPreference: Schema.Option(YouTubeLatencyPreference),
  enableAutoStart: Schema.Option(Schema.Boolean),
  enableAutoStop: Schema.Option(Schema.Boolean),
  enableDvr: Schema.Option(Schema.Boolean),
  enableContentEncryption: Schema.Option(Schema.Boolean),
  startWithLowLatency: Schema.Option(Schema.Boolean),
  recordFromStart: Schema.Option(Schema.Boolean),
  enableMonitorStream: Schema.Option(Schema.Boolean),
  broadcastStreamDelayMs: Schema.Option(Schema.Number),
  projection: Schema.Option(YouTubeProjection),
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
  handle: Schema.String,
  status: Schema.Literal('active', 'expired', 'pending'),
  youtube_config_brotli_b64: Schema.String,
  last_error: Schema.Option(Schema.String),
  last_sync_at: Schema.Option(Schema.String),
  is_archived: Schema.Option(Schema.Boolean),
  notes: Schema.Option(Schema.String),
  metadata_json: Schema.Option(Schema.Any),
  created: Schema.String,
  updated: Schema.String,
});

/**
 * PocketBase representation of a Batch.
 */
export const BatchRecordSchema = Schema.Struct({
  id: Schema.String,
  channel_id: Schema.String, // Relation -> s_channels
  status: Schema.Literal('pending', 'processing', 'completed', 'failed'),
  scheduled_for: Schema.Option(Schema.String),
  is_archived: Schema.Option(Schema.Boolean),
  notes: Schema.Option(Schema.String),
  metadata_json: Schema.Option(Schema.Any),
  created: Schema.String,
  updated: Schema.String,
});

/**
 * PocketBase representation of a Staged Video.
 */
export const StagedVideoRecordSchema = Schema.Struct({
  id: Schema.String,
  batch_id: Schema.String, // Relation -> s_batches
  status: Schema.Literal('idle', 'processing', 'success', 'error'),
  title: Schema.String,
  description_brotli_b64: Schema.Option(Schema.String),
  privacyStatus: YouTubePrivacyStatus,
  license: Schema.Option(Schema.String),
  embeddable: Schema.Option(Schema.Boolean),
  publicStatsViewable: Schema.Option(Schema.Boolean),
  madeForKids: Schema.Option(Schema.Boolean),
  tags: Schema.Option(Schema.Array(Schema.String)),
  categoryId: Schema.Option(Schema.String),
  thumbnailUrl: Schema.Option(Schema.String),
  scheduledStartTime: Schema.Option(Schema.String),
  publishAt: Schema.Option(Schema.String),
  recordingDate: Schema.Option(Schema.String),
  language: Schema.Option(Schema.String),
  defaultLanguage: Schema.Option(Schema.String),
  defaultAudioLanguage: Schema.Option(Schema.String),
  sort_order: Schema.Option(Schema.Number),
  error_message: Schema.Option(Schema.String),
  finished_at: Schema.Option(Schema.String),
  latencyPreference: Schema.Option(YouTubeLatencyPreference),
  enableAutoStart: Schema.Option(Schema.Boolean),
  enableAutoStop: Schema.Option(Schema.Boolean),
  enableDvr: Schema.Option(Schema.Boolean),
  enableContentEncryption: Schema.Option(Schema.Boolean),
  startWithLowLatency: Schema.Option(Schema.Boolean),
  recordFromStart: Schema.Option(Schema.Boolean),
  enableMonitorStream: Schema.Option(Schema.Boolean),
  broadcastStreamDelayMs: Schema.Option(Schema.Number),
  projection: Schema.Option(YouTubeProjection),
  scheduledEndTime: Schema.Option(Schema.String),
  is_archived: Schema.Option(Schema.Boolean),
  notes: Schema.Option(Schema.String),
  metadata_json: Schema.Option(Schema.Any),
  created: Schema.String,
  updated: Schema.String,
});

/**
 * PocketBase representation of a Setting.
 */
export const SettingRecordSchema = Schema.Struct({
  id: Schema.String,
  key: Schema.String,
  value: Schema.Any,
  category: Schema.Option(Schema.String),
  created: Schema.String,
});

// Legacy BatchUploadSchema for specific processing logic
export const BatchUploadSchema = Schema.Struct({
  channelId: Schema.String,
  videos: Schema.Array(VideoMetadataSchema),
});
