import { Schema } from "@effect/schema";
import { z } from 'zod';

// Legacy Zod schema for compatibility if needed
export const TenantSchema = z.object({
  id: z.string(),
  name: z.string(),
  subDetailFields: z.array(z.string()),
  youtubeConfig: z.object({ 
    clientId: z.string(), 
    scopes: z.array(z.string()) 
  }),
});

// New Effect-based schemas for functional pipelines
export const YouTubeConfigSchema = Schema.Struct({
  clientId: Schema.String,
  scopes: Schema.Array(Schema.String),
});

export const TenantEffectSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  subDetailFields: Schema.Array(Schema.String),
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
  scheduledStartTime: Schema.Option(Schema.String), // For live streams
  publishAt: Schema.Option(Schema.String), // For scheduled private videos
  recordingDate: Schema.Option(Schema.String),
  language: Schema.Option(Schema.String),
  localizations: Schema.Option(Schema.Record({ 
    key: Schema.String, 
    value: Schema.Struct({ title: Schema.String, description: Schema.String }) 
  })),
});

export const BatchUploadSchema = Schema.Struct({
  tenantId: Schema.String,
  videos: Schema.Array(VideoMetadataSchema),
});
