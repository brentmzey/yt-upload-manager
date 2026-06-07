import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Effect, Option } from 'effect';
import { ConfigServiceLive } from './config';

describe('MicroProfile Config Service Integration / Unit tests', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clear relevant environment variables
    delete process.env.PUBLIC_MAIN_POCKETBASE_URL;
    delete process.env.VITE_TEST_PB_URL;
    delete process.env.PUBLIC_POCKETBASE_URL;
    delete process.env.PUBLIC_YT_DUMMY_MODE;
    delete process.env.PUBLIC_DEFAULT_TENANT_SLUG;
    delete process.env.PUBLIC_EDGE_BACKEND_URL;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('provides default configurations when environment is empty', async () => {
    const program = ConfigServiceLive.loadAll();
    const config = await Effect.runPromise(program);

    expect(config.mainPocketBaseUrl).toBe('https://yt-upload-manager-system-registry.pockethost.io/');
    expect(config.pocketBaseUrl).toBe('http://127.0.0.1:8090');
    expect(config.ytDummyMode).toBe(false);
    expect(config.defaultTenantSlug).toBe('local-dev');
    expect(config.edgeBackendUrl).toBe('https://api.yt-manager.com');
  });

  it('supports environment overrides for 12-factor apps', async () => {
    process.env.PUBLIC_MAIN_POCKETBASE_URL = 'http://registry.internal:8080';
    process.env.PUBLIC_POCKETBASE_URL = 'http://tenant.internal:8090';
    process.env.PUBLIC_YT_DUMMY_MODE = 'true';
    process.env.PUBLIC_DEFAULT_TENANT_SLUG = 'acme-corp';
    process.env.PUBLIC_EDGE_BACKEND_URL = 'http://backend.internal:3000';

    const program = ConfigServiceLive.loadAll();
    const config = await Effect.runPromise(program);

    expect(config.mainPocketBaseUrl).toBe('http://registry.internal:8080');
    expect(config.pocketBaseUrl).toBe('http://tenant.internal:8090');
    expect(config.ytDummyMode).toBe(true);
    expect(config.defaultTenantSlug).toBe('acme-corp');
    expect(config.edgeBackendUrl).toBe('http://backend.internal:3000');
  });

  it('handles test environment overrides with high priority', async () => {
    process.env.VITE_TEST_PB_URL = 'http://test-server:8091';
    process.env.PUBLIC_POCKETBASE_URL = 'http://prod-server:8090';

    const program = ConfigServiceLive.loadAll();
    const config = await Effect.runPromise(program);

    expect(config.mainPocketBaseUrl).toBe('http://test-server:8091');
    expect(config.pocketBaseUrl).toBe('http://test-server:8091');
  });

  it('returns Option.none for missing optional keys', async () => {
    const program = ConfigServiceLive.getOptional('NON_EXISTENT_KEY');
    const value = await Effect.runPromise(program);

    expect(Option.isNone(value)).toBe(true);
  });

  it('returns Option.some for present optional keys', async () => {
    process.env.SOME_KEY = 'present-value';
    const program = ConfigServiceLive.getOptional('SOME_KEY');
    const value = await Effect.runPromise(program);

    expect(Option.isSome(value)).toBe(true);
    expect(Option.getOrNull(value)).toBe('present-value');
    delete process.env.SOME_KEY;
  });
});
