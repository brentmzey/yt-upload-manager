import { Effect, Context, Option, Either } from 'effect';

export class ConfigError {
  readonly _tag = 'ConfigError';
  constructor(readonly message: string, readonly cause?: unknown) {}
}

export interface AppConfig {
  readonly mainPocketBaseUrl: string;
  readonly pocketBaseUrl: string;
  readonly ytDummyMode: boolean;
  readonly defaultTenantSlug: string;
  readonly edgeBackendUrl: string;
}

export interface ConfigService {
  readonly get: (key: string) => Effect.Effect<string, ConfigError>;
  readonly getOptional: (key: string) => Effect.Effect<Option.Option<string>, never>;
  readonly getBoolean: (key: string) => Effect.Effect<boolean, ConfigError>;
  readonly getOptionalBoolean: (key: string) => Effect.Effect<Option.Option<boolean>, never>;
  readonly loadAll: () => Effect.Effect<AppConfig, ConfigError>;
}

export const ConfigService = Context.GenericTag<ConfigService>('ConfigService');

// Read file helper using safe try/catch for isomorphic browser/node compatibility
const readLocalMicroConfig = (): Record<string, string> => {
  try {
    // Check if we are in a Node-like environment where fs is available
    if (typeof process !== 'undefined' && process.versions && process.versions.node) {
      const fs = require('fs');
      const path = require('path');
      const configPath = path.resolve(process.cwd(), 'microconfig.json');
      if (fs.existsSync(configPath)) {
        const raw = fs.readFileSync(configPath, 'utf8');
        return JSON.parse(raw);
      }
    }
  } catch (e) {
    // Silently fallback if fs is not supported or file is malformed
  }
  return {};
};

const microConfigCache = readLocalMicroConfig();

/**
 * Professional, monadic configuration source lookup.
 * Mimics MicroProfile Config by resolving key across multiple providers:
 * 1. Environment variables (process.env for Vitest / Node)
 * 2. Bundled env variables (import.meta.env for Vite / Astro UI)
 * 3. Local microconfig.json file (configmap / file-based properties)
 */
const getRawValue = (key: string): Option.Option<string> => {
  // 1. Check local microconfig.json Cache
  if (microConfigCache[key] !== undefined) {
    return Option.some(String(microConfigCache[key]));
  }

  // 2. Check process.env (Node / Vitest runtime environment)
  if (typeof process !== 'undefined' && process.env && process.env[key] !== undefined) {
    return Option.some(process.env[key] as string);
  }

  // 3. Check import.meta.env (Vite / Astro bundled environment)
  // We use this fallback pattern to avoid compiler issues if import.meta.env is undefined
  try {
    const metaEnv = (import.meta as unknown as { env?: Record<string, unknown> }).env;
    if (metaEnv && metaEnv[key] !== undefined) {
      return Option.some(String(metaEnv[key]));
    }
  } catch (e) {
    // Ignore and proceed
  }

  return Option.none();
};

export const ConfigServiceLive = {
  get: (key: string): Effect.Effect<string, ConfigError> =>
    Effect.suspend(() => {
      const val = getRawValue(key);
      return Option.isSome(val)
        ? Effect.succeed(val.value)
        : Effect.fail(new ConfigError(`Configuration key '${key}' is required but not found in any source.`));
    }),

  getOptional: (key: string): Effect.Effect<Option.Option<string>, never> =>
    Effect.succeed(getRawValue(key)),

  getBoolean: (key: string): Effect.Effect<boolean, ConfigError> =>
    Effect.suspend(() => {
      const val = getRawValue(key);
      if (Option.isSome(val)) {
        const s = val.value.toLowerCase();
        return Effect.succeed(s === 'true' || s === '1' || s === 'yes');
      }
      return Effect.fail(new ConfigError(`Configuration key '${key}' is required but not found.`));
    }),

  getOptionalBoolean: (key: string): Effect.Effect<Option.Option<boolean>, never> =>
    Effect.succeed(
      Option.map(getRawValue(key), (v) => {
        const s = v.toLowerCase();
        return s === 'true' || s === '1' || s === 'yes';
      })
    ),

  loadAll: (): Effect.Effect<AppConfig, ConfigError> =>
    Effect.gen(function* (_) {
      // Resolve main pocketbase URL (central registry node)
      const mainPbOpt = yield* _(ConfigServiceLive.getOptional('PUBLIC_MAIN_POCKETBASE_URL'));
      const testPbOpt = yield* _(ConfigServiceLive.getOptional('VITE_TEST_PB_URL'));
      
      const mainPocketBaseUrl = Option.getOrElse(
        Option.firstSomeOf([testPbOpt, mainPbOpt]),
        () => 'https://yt-upload-manager-system-registry.pockethost.io/'
      );

      // Resolve tenant pocketbase URL (dedicated instance)
      const tenantPbOpt = yield* _(ConfigServiceLive.getOptional('PUBLIC_POCKETBASE_URL'));
      const pocketBaseUrl = Option.getOrElse(
        Option.firstSomeOf([testPbOpt, tenantPbOpt]),
        () => 'http://127.0.0.1:8090'
      );

      // Resolve dummy mode flag
      const dummyOpt = yield* _(ConfigServiceLive.getOptionalBoolean('PUBLIC_YT_DUMMY_MODE'));
      const ytDummyMode = Option.getOrElse(dummyOpt, () => false);

      // Resolve tenant slug
      const slugOpt = yield* _(ConfigServiceLive.getOptional('PUBLIC_DEFAULT_TENANT_SLUG'));
      const defaultTenantSlug = Option.getOrElse(slugOpt, () => 'local-dev');

      // Resolve edge backend url
      const edgeOpt = yield* _(ConfigServiceLive.getOptional('PUBLIC_EDGE_BACKEND_URL'));
      const edgeBackendUrl = Option.getOrElse(edgeOpt, () => 'https://api.yt-manager.com');

      return {
        mainPocketBaseUrl,
        pocketBaseUrl,
        ytDummyMode,
        defaultTenantSlug,
        edgeBackendUrl,
      };
    })
};
