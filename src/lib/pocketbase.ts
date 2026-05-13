import PocketBase, { BaseAuthStore } from 'pocketbase';
import { Effect, Context, Layer } from 'effect';

export class PocketBaseError {
  readonly _tag = 'PocketBaseError';
  constructor(readonly cause: unknown) {}
}

export interface PocketBaseService {
  readonly getChannels: () => Effect.Effect<any[], PocketBaseError>;
  readonly createChannel: (channel: any) => Effect.Effect<any, PocketBaseError>;
  readonly updateChannel: (id: string, updates: any) => Effect.Effect<any, PocketBaseError>;
  readonly activateChannel: (id: string) => Effect.Effect<any, PocketBaseError>;
  readonly isAuthenticated: () => boolean;
  readonly authenticateAsAdmin: (email: string, password: string) => Effect.Effect<void, PocketBaseError>;
  readonly getPendingBatch: (channelId: string) => Effect.Effect<any, PocketBaseError>;
  readonly createBatch: (channelId: string) => Effect.Effect<any, PocketBaseError>;
  readonly getStagedVideos: (batchId: string) => Effect.Effect<any[], PocketBaseError>;
  readonly saveStagedVideo: (video: any) => Effect.Effect<any, PocketBaseError>;
  readonly deleteStagedVideo: (id: string) => Effect.Effect<void, PocketBaseError>;
  readonly getSetting: (key: string) => Effect.Effect<any, PocketBaseError>;
  readonly updateSetting: (key: string, value: any) => Effect.Effect<void, PocketBaseError>;
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
          try: () => pb.collection('s_channels').getFullList(),
          catch: (error) => new PocketBaseError(error),
        }),
      createChannel: (channel) =>
        Effect.tryPromise({
          try: () => pb.collection('s_channels').create(channel),
          catch: (error) => new PocketBaseError(error),
        }),
      updateChannel: (id, updates) =>
        Effect.tryPromise({
          try: () => pb.collection('s_channels').update(id, updates),
          catch: (error) => new PocketBaseError(error),
        }),
      activateChannel: (id) =>
        Effect.tryPromise({
          try: () => pb.collection('s_channels').update(id, { 
            status: 'active', 
            last_sync_at: new Date().toISOString() 
          }),
          catch: (error) => new PocketBaseError(error),
        }),
      isAuthenticated: () => pb.authStore.isValid,
      authenticateAsAdmin: (email, password) =>
        Effect.tryPromise({
          try: async () => {
            try {
              // Try 0.23+ Superusers
              await pb.collection('_superusers').authWithPassword(email, password);
            } catch (e: any) {
              if (e.status === 404) {
                // Fallback for legacy Admins (< 0.23.0) with newer SDK (>= 0.23.0)
                const res = await fetch(`${url}/api/admins/auth-with-password`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ email, password })
                });
                const data = await res.json();
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
          try: () => pb.collection('s_batches').getFirstListItem(`channel_id="${channelId}" && status="pending"`),
          catch: (error) => new PocketBaseError(error),
        }),
      createBatch: (channelId) =>
        Effect.tryPromise({
          try: () => pb.collection('s_batches').create({ channel_id: channelId, status: 'pending' }),
          catch: (error) => new PocketBaseError(error),
        }),
      getStagedVideos: (batchId) =>
        Effect.tryPromise({
          try: () => pb.collection('s_staged_videos').getFullList({ filter: `batch_id="${batchId}"`, sort: 'sort_order' }),
          catch: (error) => new PocketBaseError(error),
        }),
      saveStagedVideo: (video) =>
        Effect.tryPromise({
          try: () => {
            console.log("DEBUG: PocketBase.saveStagedVideo sending:", JSON.stringify(video));
            return video.id 
              ? pb.collection('s_staged_videos').update(video.id, video)
              : pb.collection('s_staged_videos').create(video);
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
          try: () => pb.collection('t_app_settings').getFirstListItem(`key="${key}"`),
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

// Default Export for compatibility (uses local dev by default)
const defaultPbInstance = createPocketBaseServiceLive(
  (typeof process !== 'undefined' && process.env?.VITE_TEST_PB_URL) 
    ? process.env.VITE_TEST_PB_URL 
    : (import.meta.env?.PUBLIC_POCKETBASE_URL || 'http://127.0.0.1:8090')
);

export const pb = defaultPbInstance.pb;
export const PocketBaseServiceLive = defaultPbInstance.layer;


