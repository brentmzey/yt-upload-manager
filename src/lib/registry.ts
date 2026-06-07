import PocketBase, { BaseAuthStore } from 'pocketbase';
import { Effect, Context, Layer } from 'effect';

import { ConfigServiceLive } from './config';
const configValues = Effect.runSync(ConfigServiceLive.loadAll());
const MAIN_POCKETBASE_URL = configValues.mainPocketBaseUrl;

// Shared Auth Store for the session if needed, or isolated
const hasLocalStorage = typeof window !== 'undefined' && !!window.localStorage;
const isTest = typeof process !== 'undefined' && (process.env?.NODE_ENV === 'test' || !!process.env?.VITEST);

const mainPb = new PocketBase(
  MAIN_POCKETBASE_URL,
  (isTest || !hasLocalStorage) ? new BaseAuthStore() : undefined
);

export class RegistryError {
  readonly _tag = 'RegistryError';
  constructor(readonly cause: unknown) {}
}

export interface TenantConfig {
  id: string;
  name: string;
  slug: string;
  dbUrl: string;
  properties: Record<string, any>;
}

export interface RegistryService {
  readonly getTenantConfig: (slug: string) => Effect.Effect<TenantConfig, RegistryError>;
  readonly listActiveTenants: () => Effect.Effect<any[], RegistryError>;
  readonly authenticate: (email: string, pass: string) => Effect.Effect<void, RegistryError>;
}

export const RegistryService = Context.GenericTag<RegistryService>('RegistryService');

export const RegistryServiceLive = Layer.succeed(
  RegistryService,
  {
    authenticate: (email, pass) => 
      Effect.tryPromise({
        try: () => mainPb.collection('_superusers').authWithPassword(email, pass),
        catch: (e) => new RegistryError(e)
      }),
    listActiveTenants: () =>
      Effect.tryPromise({
        try: () => mainPb.collection('s_tenants').getFullList({ filter: 'status = "active"' }),
        catch: (e) => new RegistryError(e)
      }),
    getTenantConfig: (slug) =>
      Effect.gen(function* (_) {
        const result = yield* _(
          Effect.gen(function* (_) {
            const tenant = yield* _(Effect.tryPromise({
              try: () => mainPb.collection('s_tenants').getFirstListItem(`tenant_slug="${slug}" && status="active"`),
              catch: (e) => new RegistryError(e)
            }));

            const props = yield* _(Effect.tryPromise({
              try: () => mainPb.collection('s_tenant_properties').getFullList({ filter: `tenant_id="${tenant.id}"` }),
              catch: (e) => new RegistryError(e)
            }));

            const configMap: Record<string, any> = {};
            props.forEach(p => {
              configMap[p.property_key] = p.property_value;
            });

            return {
              id: tenant.id,
              name: tenant.tenant_name,
              slug: tenant.tenant_slug,
              dbUrl: configMap['TENANT_PROD_BASE_DB_URI'] || 'http://127.0.0.1:8090',
              properties: configMap
            };
          }).pipe(
            Effect.catchAll(() => {
              // Graceful local development offline fallback to avoid configuration crashes
              console.warn(`⚠️ Central Registry DB at ${MAIN_POCKETBASE_URL} is offline or tenant '${slug}' was not found. Gracefully falling back to local-only offline mode.`);
              return Effect.succeed({
                id: 'local-dev-id',
                name: 'Local Development Tenant',
                slug: 'local-dev',
                dbUrl: configValues.pocketBaseUrl || 'http://127.0.0.1:8090',
                properties: {
                  'TENANT_PROD_BASE_DB_URI': configValues.pocketBaseUrl || 'http://127.0.0.1:8090',
                  'TENANT_REGION': 'local-offline',
                }
              });
            })
          )
        );
        return result;
      })
  }
);
