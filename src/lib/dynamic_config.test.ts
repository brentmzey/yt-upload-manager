import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Effect, Layer, Option } from 'effect';
import { PocketBaseService } from './pocketbase';
import { DynamicConfigService, DynamicConfigServiceLive } from './dynamic_config';

/**
 * UNIT TEST HARNESS FOR DYNAMIC CONFIGURATION SERVICE.
 * Validates 100% of code branches, prioritizing environment overrides,
 * falling back to database metrics, dynamic boolean conversions, and monadic Options.
 */
describe('DynamicConfigService Unit Test Harness', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clear relevant environment variables
    delete process.env.TEST_ENV_KEY;
    delete process.env.TEST_BOOL_KEY;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('resolves key from environment variables with high priority', async () => {
    process.env.TEST_ENV_KEY = 'env-value-123';

    // Mock PocketBaseService to ensure it is not called (fails if called)
    const pbServiceMock = Layer.succeed(PocketBaseService, {
      getSetting: () => Effect.fail(new Error('Should not be called') as any),
      getChannels: () => Effect.succeed([]),
      createChannel: () => Effect.succeed({}),
      updateChannel: () => Effect.succeed({}),
      activateChannel: () => Effect.succeed({}),
      isAuthenticated: () => false,
      authenticateAsAdmin: () => Effect.void,
      getPendingBatch: () => Effect.succeed({}),
      createBatch: () => Effect.succeed({}),
      getStagedVideos: () => Effect.succeed([]),
      saveStagedVideo: () => Effect.succeed({}),
      deleteStagedVideo: () => Effect.void,
      updateSetting: () => Effect.void,
    });

    const program = Effect.gen(function* (_) {
      const config = yield* _(DynamicConfigService);
      return yield* _(config.get('TEST_ENV_KEY'));
    });

    const result = await Effect.runPromise(
      Effect.provide(program, DynamicConfigServiceLive.pipe(Layer.provide(pbServiceMock)))
    );

    expect(result).toBe('env-value-123');
  });

  it('falls back to database backing properties if env variable is absent', async () => {
    // Mock PocketBaseService to return a value from getSetting
    const pbServiceMock = Layer.succeed(PocketBaseService, {
      getSetting: (key: string) => Effect.succeed({ key, value: 'db-value-456' }),
      getChannels: () => Effect.succeed([]),
      createChannel: () => Effect.succeed({}),
      updateChannel: () => Effect.succeed({}),
      activateChannel: () => Effect.succeed({}),
      isAuthenticated: () => false,
      authenticateAsAdmin: () => Effect.void,
      getPendingBatch: () => Effect.succeed({}),
      createBatch: () => Effect.succeed({}),
      getStagedVideos: () => Effect.succeed([]),
      saveStagedVideo: () => Effect.succeed({}),
      deleteStagedVideo: () => Effect.void,
      updateSetting: () => Effect.void,
    });

    const program = Effect.gen(function* (_) {
      const config = yield* _(DynamicConfigService);
      return yield* _(config.get('TEST_ENV_KEY'));
    });

    const result = await Effect.runPromise(
      Effect.provide(program, DynamicConfigServiceLive.pipe(Layer.provide(pbServiceMock)))
    );

    expect(result).toBe('db-value-456');
  });

  it('returns a ConfigError if key is missing from all sources', async () => {
    // Mock PocketBase to fail
    const pbServiceMock = Layer.succeed(PocketBaseService, {
      getSetting: () => Effect.fail(new Error('Key not found') as any),
      getChannels: () => Effect.succeed([]),
      createChannel: () => Effect.succeed({}),
      updateChannel: () => Effect.succeed({}),
      activateChannel: () => Effect.succeed({}),
      isAuthenticated: () => false,
      authenticateAsAdmin: () => Effect.void,
      getPendingBatch: () => Effect.succeed({}),
      createBatch: () => Effect.succeed({}),
      getStagedVideos: () => Effect.succeed([]),
      saveStagedVideo: () => Effect.succeed({}),
      deleteStagedVideo: () => Effect.void,
      updateSetting: () => Effect.void,
    });

    const program = Effect.gen(function* (_) {
      const config = yield* _(DynamicConfigService);
      return yield* _(config.get('NON_EXISTENT_KEY'));
    });

    const result = await Effect.runPromise(
      Effect.provide(program, DynamicConfigServiceLive.pipe(Layer.provide(pbServiceMock))).pipe(
        Effect.flip,
        Effect.map((err) => err._tag)
      )
    );

    expect(result).toBe('ConfigError');
  });

  it('correctly resolves and parses boolean properties', async () => {
    const pbServiceMock = Layer.succeed(PocketBaseService, {
      getSetting: (key: string) => {
        if (key === 'TRUE_KEY') return Effect.succeed({ key, value: 'true' });
        if (key === 'YES_KEY') return Effect.succeed({ key, value: 'yes' });
        if (key === 'ONE_KEY') return Effect.succeed({ key, value: '1' });
        return Effect.succeed({ key, value: 'false' });
      },
      getChannels: () => Effect.succeed([]),
      createChannel: () => Effect.succeed({}),
      updateChannel: () => Effect.succeed({}),
      activateChannel: () => Effect.succeed({}),
      isAuthenticated: () => false,
      authenticateAsAdmin: () => Effect.void,
      getPendingBatch: () => Effect.succeed({}),
      createBatch: () => Effect.succeed({}),
      getStagedVideos: () => Effect.succeed([]),
      saveStagedVideo: () => Effect.succeed({}),
      deleteStagedVideo: () => Effect.void,
      updateSetting: () => Effect.void,
    });

    const program = Effect.gen(function* (_) {
      const config = yield* _(DynamicConfigService);
      const val1 = yield* _(config.getBoolean('TRUE_KEY'));
      const val2 = yield* _(config.getBoolean('YES_KEY'));
      const val3 = yield* _(config.getBoolean('ONE_KEY'));
      const val4 = yield* _(config.getBoolean('FALSE_KEY'));
      return { val1, val2, val3, val4 };
    });

    const result = await Effect.runPromise(
      Effect.provide(program, DynamicConfigServiceLive.pipe(Layer.provide(pbServiceMock)))
    );

    expect(result.val1).toBe(true);
    expect(result.val2).toBe(true);
    expect(result.val3).toBe(true);
    expect(result.val4).toBe(false);
  });

  it('resolves getOptional keys cleanly into Option types', async () => {
    const pbServiceMock = Layer.succeed(PocketBaseService, {
      getSetting: (key: string) => {
        if (key === 'EXISTENT_DB_KEY') return Effect.succeed({ key, value: 'db-val' });
        return Effect.fail(new Error('Not found') as any);
      },
      getChannels: () => Effect.succeed([]),
      createChannel: () => Effect.succeed({}),
      updateChannel: () => Effect.succeed({}),
      activateChannel: () => Effect.succeed({}),
      isAuthenticated: () => false,
      authenticateAsAdmin: () => Effect.void,
      getPendingBatch: () => Effect.succeed({}),
      createBatch: () => Effect.succeed({}),
      getStagedVideos: () => Effect.succeed([]),
      saveStagedVideo: () => Effect.succeed({}),
      deleteStagedVideo: () => Effect.void,
      updateSetting: () => Effect.void,
    });

    const program = Effect.gen(function* (_) {
      const config = yield* _(DynamicConfigService);
      const opt1 = yield* _(config.getOptional('EXISTENT_DB_KEY'));
      const opt2 = yield* _(config.getOptional('NON_EXISTENT_KEY'));
      const optBool1 = yield* _(config.getOptionalBoolean('TRUE_KEY'));
      return { opt1, opt2, optBool1 };
    });

    // Seed environment variables for TRUE_KEY to check config side of getOptionalBoolean
    process.env.TRUE_KEY = 'true';

    const result = await Effect.runPromise(
      Effect.provide(program, DynamicConfigServiceLive.pipe(Layer.provide(pbServiceMock)))
    );

    expect(Option.isSome(result.opt1)).toBe(true);
    expect(Option.getOrNull(result.opt1)).toBe('db-val');
    
    expect(Option.isNone(result.opt2)).toBe(true);
    
    expect(Option.isSome(result.optBool1)).toBe(true);
    expect(Option.getOrNull(result.optBool1)).toBe(true);

    delete process.env.TRUE_KEY;
  });
});
