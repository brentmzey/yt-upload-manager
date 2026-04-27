import PocketBase from 'pocketbase';
import { Effect, Context } from 'effect';

// 12-Factor: PocketBase URL from environment variable
const POCKETBASE_URL = import.meta.env.PUBLIC_POCKETBASE_URL || 'http://127.0.0.1:8090';

export const pb = new PocketBase(POCKETBASE_URL);

export class PocketBaseError {
  readonly _tag = 'PocketBaseError';
  constructor(readonly cause: unknown) {}
}

export interface PocketBaseService {
  readonly getChannels: () => Effect.Effect<any[], PocketBaseError>;
  readonly isAuthenticated: () => boolean;
  readonly authenticateAsAdmin: (email: string, password: string) => Effect.Effect<void, PocketBaseError>;
}

export const PocketBaseService = Context.GenericTag<PocketBaseService>('PocketBaseService');

export const PocketBaseServiceLive = Effect.provideService(
  PocketBaseService,
  {
    getChannels: () =>
      Effect.tryPromise({
        try: () => pb.collection('channels').getFullList(),
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
              const res = await fetch(`${POCKETBASE_URL}/api/admins/auth-with-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email, password: password })
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
  }
);
