import { describe, it, expect, beforeAll } from 'vitest';
import { Effect, Layer } from 'effect';
import { PocketBaseService, PocketBaseServiceLive, pb } from '../lib/pocketbase';
import { DynamicConfigService, DynamicConfigServiceLive } from '../lib/dynamic_config';

/**
 * FULL END-TO-END INTEGRATION TEST FOR DYNAMIC 12-FACTOR CONFIGURATION.
 * Simulates a MicroProfile Config environment where dynamic properties are injected
 * via environment variables or backing databases, fully managed via Effect monads.
 */
describe('12-Factor Dynamic Configuration E2E Integration Pipeline', () => {
  const testUrl = 'http://127.0.0.1:8091';

  beforeAll(async () => {
    // Point to the test DB
    process.env.VITE_TEST_PB_URL = testUrl;
    
    // Login as the test superuser
    await pb.collection('_superusers').authWithPassword('test@example.com', 'test123456');
  });

  it('resolves environment variables with top priority', async () => {
    process.env.CUSTOM_TEST_PROPERTY = 'env-value';

    const program = Effect.gen(function* (_) {
      const dynamicConfig = yield* _(DynamicConfigService);
      const val = yield* _(dynamicConfig.get('CUSTOM_TEST_PROPERTY'));
      return val;
    });

    const runtimeLayer = DynamicConfigServiceLive.pipe(
      Layer.provide(PocketBaseServiceLive)
    );

    const result = await Effect.runPromise(Effect.provide(program, runtimeLayer));
    expect(result).toBe('env-value');

    // Cleanup env
    delete process.env.CUSTOM_TEST_PROPERTY;
  });

  it('falls back to database backing properties dynamically and handles updates without redeployment', async () => {
    const program = Effect.gen(function* (_) {
      const pbService = yield* _(PocketBaseService);
      const dynamicConfig = yield* _(DynamicConfigService);

      const targetKey = 'DYNAMIC_DB_TIMEOUT_LIMIT';
      const flagKey = 'DYNAMIC_FEATURE_FLAG';

      // 1. Initially the key should fail because it doesn't exist
      const initialFetch = yield* _(
        dynamicConfig.get(targetKey).pipe(
          Effect.flip, // Flip turns error into success value
          Effect.map((err) => err._tag)
        )
      );
      expect(initialFetch).toBe('ConfigError');

      // 2. Write key directly into backing database properties (KV store)
      // Simulating a Kubernetes ConfigMap update or PocketBase Dashboard change on the fly!
      yield* _(pbService.updateSetting(targetKey, '45000'));

      // 3. Re-query key. It should now resolve to the new database value WITHOUT restart!
      const activeValue = yield* _(dynamicConfig.get(targetKey));
      expect(activeValue).toBe('45000');

      // 4. Update the key dynamically in the database (plug & play without redeployment)
      yield* _(pbService.updateSetting(targetKey, '90000'));

      // 5. Query again. The app should dynamically reference the updated value immediately!
      const updatedValue = yield* _(dynamicConfig.get(targetKey));
      expect(updatedValue).toBe('90000');

      // 6. Verify dynamic boolean properties
      yield* _(pbService.updateSetting(flagKey, 'true'));
      const activeFlag = yield* _(dynamicConfig.getBoolean(flagKey));
      expect(activeFlag).toBe(true);

      yield* _(pbService.updateSetting(flagKey, 'no'));
      const inactiveFlag = yield* _(dynamicConfig.getBoolean(flagKey));
      expect(inactiveFlag).toBe(false);

      return { activeValue, updatedValue };
    });

    // Merge both output layers so both services are visible in the runtime program
    const runtimeLayer = Layer.mergeAll(
      DynamicConfigServiceLive.pipe(Layer.provide(PocketBaseServiceLive)),
      PocketBaseServiceLive
    );

    await Effect.runPromise(Effect.provide(program, runtimeLayer));
  });
});
