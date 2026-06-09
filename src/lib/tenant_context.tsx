import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { Effect, Layer } from 'effect';
import { RegistryService, RegistryServiceLive, type TenantConfig } from './registry';
import { PocketBaseService, createPocketBaseServiceLive } from './pocketbase';
import { LoggerServiceLive } from './logger';
import { YouTubeServiceLive } from './youtube/service';
import { SettingsServiceLive } from './settings';

interface TenantContextType {
  tenant: TenantConfig | null;
  isLoading: boolean;
  error: string | null;
  appLayer: Layer.Layer<PocketBaseService | any, never, never> | null;
  switchTenant: (slug: string) => Promise<void>;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tenant, setTenant] = useState<TenantConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const switchTenant = async (slug: string) => {
    setIsLoading(true);
    setError(null);
    
    const program = Effect.gen(function* (_) {
      const registry = yield* _(RegistryService);
      const config = yield* _(registry.getTenantConfig(slug));
      setTenant(config);
    }).pipe(
      Effect.catchAll((err) => {
        setError(`Failed to load tenant configuration for ${slug}`);
        return Effect.void;
      })
    );

    await Effect.runPromise(Effect.provide(program, RegistryServiceLive));
    setIsLoading(false);
  };

  useEffect(() => {
    const identifyAndSwitch = async () => {
      // 1. Check for manual override in Environment
      const envSlug = (import.meta.env?.PUBLIC_DEFAULT_TENANT_SLUG);
      if (envSlug) {
        await switchTenant(envSlug);
        return;
      }

      // 2. Check Hostname for Web deployments (client-slug.yt-manager.com)
      if (typeof window !== 'undefined') {
        const host = window.location.hostname;
        // Simple heuristic: if it has multiple parts and isn't localhost
        const parts = host.split('.');
        if (parts.length >= 3 && parts[0] !== 'www' && !host.includes('localhost')) {
          await switchTenant(parts[0]);
          return;
        }
      }

      // 3. Fallback to local-dev
      await switchTenant('local-dev');
    };

    identifyAndSwitch();
  }, []);

  const appLayer = useMemo(() => {
    if (!tenant) return null;
    const { layer: tenantPbLive } = createPocketBaseServiceLive(tenant.dbUrl);
    return Layer.mergeAll(tenantPbLive, LoggerServiceLive, YouTubeServiceLive, SettingsServiceLive);
  }, [tenant]);

  return (
    <TenantContext.Provider value={{ tenant, isLoading, error, appLayer, switchTenant }}>
      {children}
    </TenantContext.Provider>
  );
};

export const useTenant = () => {
  const context = useContext(TenantContext);
  if (!context) throw new Error('useTenant must be used within a TenantProvider');
  return context;
};
