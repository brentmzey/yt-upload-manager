import PocketBase, { BaseAuthStore } from 'pocketbase';
import { Effect, Context, Layer } from 'effect';
import { 
  ChannelRecordSchema, 
  BatchRecordSchema, 
  StagedVideoRecordSchema,
  SettingRecordSchema 
} from './channel/config';

export type ChannelRecord = typeof ChannelRecordSchema.Type;
export type BatchRecord = typeof BatchRecordSchema.Type;
export type StagedVideoRecord = typeof StagedVideoRecordSchema.Type;
export type SettingRecord = typeof SettingRecordSchema.Type;

export class PocketBaseError {
  readonly _tag = 'PocketBaseError';
  constructor(readonly cause: unknown) {}
}

export interface PocketBaseService {
  readonly getChannels: () => Effect.Effect<ChannelRecord[], PocketBaseError>;
  readonly createChannel: (channel: Omit<ChannelRecord, 'id' | 'created' | 'updated'>) => Effect.Effect<ChannelRecord, PocketBaseError>;
  readonly updateChannel: (id: string, updates: Partial<Omit<ChannelRecord, 'id' | 'created' | 'updated'>>) => Effect.Effect<ChannelRecord, PocketBaseError>;
  readonly activateChannel: (id: string) => Effect.Effect<ChannelRecord, PocketBaseError>;
  readonly isAuthenticated: () => boolean;
  readonly authenticateAsAdmin: (email: string, password: string) => Effect.Effect<void, PocketBaseError>;
  readonly getPendingBatch: (channelId: string) => Effect.Effect<BatchRecord, PocketBaseError>;
  readonly createBatch: (channelId: string) => Effect.Effect<BatchRecord, PocketBaseError>;
  readonly getStagedVideos: (batchId: string) => Effect.Effect<StagedVideoRecord[], PocketBaseError>;
  readonly saveStagedVideo: (video: Partial<StagedVideoRecord> & { id?: string }) => Effect.Effect<StagedVideoRecord, PocketBaseError>;
  readonly deleteStagedVideo: (id: string) => Effect.Effect<void, PocketBaseError>;
  readonly getSetting: (key: string) => Effect.Effect<SettingRecord, PocketBaseError>;
  readonly updateSetting: (key: string, value: unknown) => Effect.Effect<void, PocketBaseError>;
}

export const PocketBaseService = Context.GenericTag<PocketBaseService>('PocketBaseService');

/**
 * Creates a Live PocketBase Service for a specific URL.
 */
export const createPocketBaseServiceLive = (url: string) => {
  const hasLocalStorage = typeof window !== 'undefined' && !!window.localStorage;
  const isTest = typeof process !== 'undefined' && (process.env?.NODE_ENV === 'test' || !!process.env?.VITEST);

  const pb = new PocketBase(
    url,
    (isTest || !hasLocalStorage) ? new BaseAuthStore() : undefined
  );

  return { pb, layer: Layer.succeed(
    PocketBaseService,
    {
      getChannels: () =>
        Effect.tryPromise({
          try: () => pb.collection('s_channels').getFullList() as Promise<ChannelRecord[]>,
          catch: (error) => new PocketBaseError(error),
        }),
      createChannel: (channel) =>
        Effect.tryPromise({
          try: () => pb.collection('s_channels').create(channel) as Promise<ChannelRecord>,
          catch: (error) => new PocketBaseError(error),
        }),
      updateChannel: (id, updates) =>
        Effect.tryPromise({
          try: () => pb.collection('s_channels').update(id, updates) as Promise<ChannelRecord>,
          catch: (error) => new PocketBaseError(error),
        }),
      activateChannel: (id) =>
        Effect.tryPromise({
          try: () => pb.collection('s_channels').update(id, { 
            status: 'active', 
            last_sync_at: new Date().toISOString() 
          }) as Promise<ChannelRecord>,
          catch: (error) => new PocketBaseError(error),
        }),
      isAuthenticated: () => pb.authStore.isValid,
      authenticateAsAdmin: (email, password) =>
        Effect.tryPromise({
          try: async () => {
            try {
              // Try 0.23+ Superusers
              await pb.collection('_superusers').authWithPassword(email, password);
            } catch (e: unknown) {
              if (e && typeof e === 'object' && 'status' in e && (e as { status: number }).status === 404) {
                // Fallback for legacy Admins (< 0.23.0) with newer SDK (>= 0.23.0)
                const res = await fetch(`${url}/api/admins/auth-with-password`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ email, password })
                });
                const data = await res.json() as { token: string; admin: unknown; message?: string };
                if (!res.ok) throw new Error(data.message || 'Legacy auth failed');
                pb.authStore.save(data.token, data.admin);
              } else {
                throw e;
              }
            }
          },
          catch: (error) => new PocketBaseError(error),
        }),
      getPendingBatch: (channelId) =>
        Effect.tryPromise({
          try: () => pb.collection('s_batches').getFirstListItem(`channel_id="${channelId}" && status="pending"`) as Promise<BatchRecord>,
          catch: (error) => new PocketBaseError(error),
        }),
      createBatch: (channelId) =>
        Effect.tryPromise({
          try: () => pb.collection('s_batches').create({ channel_id: channelId, status: 'pending' }) as Promise<BatchRecord>,
          catch: (error) => new PocketBaseError(error),
        }),
      getStagedVideos: (batchId) =>
        Effect.tryPromise({
          try: () => pb.collection('s_staged_videos').getFullList({ filter: `batch_id="${batchId}"`, sort: 'sort_order' }) as Promise<StagedVideoRecord[]>,
          catch: (error) => new PocketBaseError(error),
        }),
      saveStagedVideo: (video) =>
        Effect.tryPromise({
          try: () => {
            console.log("DEBUG: PocketBase.saveStagedVideo sending:", JSON.stringify(video));
            const promise = video.id 
              ? pb.collection('s_staged_videos').update(video.id, video)
              : pb.collection('s_staged_videos').create(video);
            return promise as Promise<StagedVideoRecord>;
          },
          catch: (error) => new PocketBaseError(error),
        }),
      deleteStagedVideo: (id) =>
        Effect.tryPromise({
          try: () => pb.collection('s_staged_videos').delete(id),
          catch: (error) => new PocketBaseError(error),
        }),
      getSetting: (key) =>
        Effect.tryPromise({
          try: () => pb.collection('t_app_settings').getFirstListItem(`key="${key}"`) as Promise<SettingRecord>,
          catch: (error) => new PocketBaseError(error),
        }),
      updateSetting: (key, value) =>
        Effect.tryPromise({
          try: async () => {
            try {
              const existing = await pb.collection('t_app_settings').getFirstListItem(`key="${key}"`);
              await pb.collection('t_app_settings').update(existing.id, { value });
            } catch {
              await pb.collection('t_app_settings').create({ key, value });
            }
          },
          catch: (error) => new PocketBaseError(error),
        }),
    }
  ) };
};

// Default Export for compatibility (uses central isomorphic config manager)
import { ConfigServiceLive } from './config';
const configValues = Effect.runSync(ConfigServiceLive.loadAll());

// Print highly visible architectural startup database context logs
console.log(`\n=======================================================`);
console.log(`🌐 yt-upload-manager | Initializing backing databases...`);
console.log(`   └─ Backing Tenant DB URL   : ${configValues.pocketBaseUrl}`);
console.log(`   └─ Central Registry DB URL : ${configValues.mainPocketBaseUrl}`);

if (configValues.mainPocketBaseUrl.includes('pockethost.io')) {
  console.log(`   ⚠️  PRODUCTION ENVIRONMENT DETECTED | Connected to central Pockethost!`);
} else {
  console.log(`   💡 DEVELOPMENT ENVIRONMENT DETECTED | Connected to local database.`);
}
console.log(`=======================================================\n`);

const defaultPbInstance = createPocketBaseServiceLive(configValues.pocketBaseUrl);

export const pb = defaultPbInstance.pb;
export const PocketBaseServiceLive = defaultPbInstance.layer;



