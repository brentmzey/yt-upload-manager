import { Effect, Context, Option, Layer } from 'effect';
import { ConfigServiceLive, ConfigError } from './config';
import { PocketBaseService, PocketBaseError } from './pocketbase';

/**
 * Unified MicroProfile-style configuration resolver.
 * Searches across:
 * 1. Environment variables / process.env (Highest Priority)
 * 2. Mounted ConfigMap JSON files / microconfig.json
 * 3. Dynamic Database KV Store / t_app_settings (Dynamic backing service)
 */
export interface DynamicConfigService {
  readonly get: (key: string) => Effect.Effect<string, ConfigError | PocketBaseError>;
  readonly getOptional: (key: string) => Effect.Effect<Option.Option<string>, never>;
  readonly getBoolean: (key: string) => Effect.Effect<boolean, ConfigError | PocketBaseError>;
  readonly getOptionalBoolean: (key: string) => Effect.Effect<Option.Option<boolean>, never>;
}

export const DynamicConfigService = Context.GenericTag<DynamicConfigService>('DynamicConfigService');

export const DynamicConfigServiceLive = Layer.effect(
  DynamicConfigService,
  Effect.gen(function* (_) {
    const pb = yield* _(PocketBaseService);

    return {
      get: (key: string) =>
        Effect.gen(function* (_) {
          // 1. Try environment / file configmap sources first (via ConfigServiceLive directly)
          const localValOpt = yield* _(ConfigServiceLive.getOptional(key));
          if (Option.isSome(localValOpt)) {
            return localValOpt.value;
          }

          // 2. Fall back to backing database config properties (t_app_settings)
          const dbValOpt = yield* _(
            pb.getSetting(key).pipe(
              Effect.map((record) => Option.some(String(record.value))),
              Effect.catchAll(() => Effect.succeed(Option.none()))
            )
          );

          if (Option.isSome(dbValOpt)) {
            return dbValOpt.value;
          }

          return yield* _(
            Effect.fail(
              new ConfigError(
                `Configuration key '${key}' was not found in environment, microconfig, or database settings.`
              )
            )
          );
        }),

      getOptional: (key: string) =>
        Effect.gen(function* (_) {
          // 1. Try environment / file configmap sources first
          const localValOpt = yield* _(ConfigServiceLive.getOptional(key));
          if (Option.isSome(localValOpt)) {
            return localValOpt;
          }

          // 2. Fall back to backing database config properties
          const dbValOpt = yield* _(
            pb.getSetting(key).pipe(
              Effect.map((record) => Option.some(String(record.value))),
              Effect.catchAll(() => Effect.succeed(Option.none()))
            )
          );

          return dbValOpt;
        }),

      getBoolean: (key: string) =>
        Effect.gen(function* (_) {
          const valStr = yield* _(
            Effect.gen(function* (_) {
              const localValOpt = yield* _(ConfigServiceLive.getOptional(key));
              if (Option.isSome(localValOpt)) {
                return localValOpt.value;
              }

              const dbValOpt = yield* _(
                pb.getSetting(key).pipe(
                  Effect.map((record) => Option.some(String(record.value))),
                  Effect.catchAll(() => Effect.succeed(Option.none()))
                )
              );

              if (Option.isSome(dbValOpt)) {
                return dbValOpt.value;
              }

              return yield* _(
                Effect.fail(
                  new ConfigError(`Configuration key '${key}' is required but not found in any source.`)
                )
              );
            })
          );

          const s = valStr.toLowerCase();
          return s === 'true' || s === '1' || s === 'yes';
        }),

      getOptionalBoolean: (key: string) =>
        Effect.gen(function* (_) {
          const valOpt = yield* _(
            Effect.gen(function* (_) {
              const localValOpt = yield* _(ConfigServiceLive.getOptional(key));
              if (Option.isSome(localValOpt)) {
                return localValOpt;
              }

              const dbValOpt = yield* _(
                pb.getSetting(key).pipe(
                  Effect.map((record) => Option.some(String(record.value))),
                  Effect.catchAll(() => Effect.succeed(Option.none()))
                )
              );

              return dbValOpt;
            })
          );

          return Option.map(valOpt, (v) => {
            const s = v.toLowerCase();
            return s === 'true' || s === '1' || s === 'yes';
          });
        }),
    };
  })
);
