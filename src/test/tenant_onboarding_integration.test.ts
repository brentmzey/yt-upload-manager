import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Effect } from 'effect';
import PocketBase from 'pocketbase';
import { RegistryService, RegistryServiceLive } from '../lib/registry';

/**
 * REAL INTEGRATION TEST
 * Targets the test PocketBase instance on port 8091 acting as the "Main Registry".
 */
describe('Tenant Onboarding Integration', () => {
  const testUrl = 'http://127.0.0.1:8091';
  
  beforeAll(async () => {
    // Force the registry to use the test PB instance
    process.env.PUBLIC_MAIN_POCKETBASE_URL = testUrl;
    process.env.VITE_TEST_PB_URL = testUrl;
    
    // The justfile runs `bun run migrate` and `bun run scripts/migrate-main.ts`
    // which creates the basic schema for both Tenant and Registry databases on port 8091.
    const pb = new PocketBase(testUrl);
    await pb.collection('_superusers').authWithPassword('test@example.com', 'test123456');
  });

  it('authenticates and creates a tenant', async () => {
    const program = Effect.gen(function* (_) {
      const registry = yield* _(RegistryService);
      
      // 1. Authenticate
      yield* _(registry.authenticate('test@example.com', 'test123456'));

      // 2. We don't have createTenant in RegistryService yet, so we use PocketBase directly
      // just like the TenantManager UI does.
      const pb = new PocketBase(testUrl);
      
      yield* _(Effect.tryPromise({
        try: () => pb.collection('_superusers').authWithPassword('test@example.com', 'test123456'),
        catch: (e) => new Error(String(e))
      }));
      
      const tenant = yield* _(Effect.tryPromise({
        try: () => pb.collection('s_tenants').create({
          tenant_name: 'Integration Test Tenant',
          tenant_slug: 'integration-tenant',
          status: 'active'
        }),
        catch: (e) => new Error(String(e))
      }));
      
      yield* _(Effect.tryPromise({
        try: () => pb.collection('s_tenant_properties').create({
          tenant_id: tenant.id,
          property_key: 'TENANT_PROD_BASE_DB_URI',
          property_value: 'http://127.0.0.1:8099',
          is_secret: false
        }),
        catch: (e) => new Error(String(e))
      }));

      // 3. Verify it exists via RegistryService
      const fetchedConfig = yield* _(registry.getTenantConfig('integration-tenant'));
      
      expect(fetchedConfig.name).toBe('Integration Test Tenant');
      expect(fetchedConfig.slug).toBe('integration-tenant');
      expect(fetchedConfig.dbUrl).toBe('http://127.0.0.1:8099');
    });

    await Effect.runPromise(Effect.provide(program, RegistryServiceLive));
  });
});
