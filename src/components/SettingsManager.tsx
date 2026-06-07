import React, { useState, useEffect } from 'react';
import { Settings, Save, RotateCcw, Loader2, Sparkles, Cpu, HardDrive, ShieldCheck, HelpCircle, CheckCircle2 } from 'lucide-react';
import { PocketBaseService } from '../lib/pocketbase';
import { LoggerService } from '../lib/logger';
import { Effect } from 'effect';
import { useTenant } from '../lib/tenant_context';

interface AppSettings {
  autoEnrichment: boolean;
  tauriBackend: boolean;
  maxConcurrentUploads: number;
  retryLimit: number;
  defaultPrivacy: 'public' | 'private' | 'unlisted';
}

const DEFAULT_SETTINGS: AppSettings = {
  autoEnrichment: true,
  tauriBackend: false,
  maxConcurrentUploads: 3,
  retryLimit: 5,
  defaultPrivacy: 'private',
};

export const SettingsManager: React.FC = () => {
  const { appLayer, tenant } = useTenant();
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showSavedToast, setShowSavedToast] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = () => {
    if (!appLayer) return;
    setIsLoading(true);
    setError(null);

    const program = Effect.gen(function* (_) {
      const pbService = yield* _(PocketBaseService);
      const logger = yield* _(LoggerService);
      yield* _(logger.info("📡 Loading tenant settings from database..."));

      const getSettingSafe = (key: string, defaultValue: string) =>
        pbService.getSetting(key).pipe(
          Effect.map((record) => record.value),
          Effect.catchAll(() => Effect.succeed(defaultValue))
        );

      const autoEnrich = yield* _(getSettingSafe('AUTO_ENRICHMENT', 'true'));
      const tauriBackend = yield* _(getSettingSafe('TAURI_NATIVE_BACKEND', 'false'));
      const maxConcurrent = yield* _(getSettingSafe('MAX_CONCURRENT_UPLOADS', '3'));
      const retryLimit = yield* _(getSettingSafe('YT_UPLOAD_RETRY_LIMIT', '5'));
      const defaultPrivacy = yield* _(getSettingSafe('YT_DEFAULT_PRIVACY', 'private'));

      return {
        autoEnrichment: String(autoEnrich) === 'true',
        tauriBackend: String(tauriBackend) === 'true',
        maxConcurrentUploads: Number(maxConcurrent) || 3,
        retryLimit: Number(retryLimit) || 5,
        defaultPrivacy: defaultPrivacy as 'public' | 'private' | 'unlisted',
      };
    }).pipe(
      Effect.catchAll((err) => {
        console.error("Settings load error:", err);
        return Effect.fail(new Error("Database settings collection not accessible."));
      })
    );

    Effect.runPromise(Effect.provide(program, appLayer))
      .then((loadedSettings) => {
        setSettings(loadedSettings);
      })
      .catch((err) => {
        setError(err.message || "Failed to load configurations.");
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  useEffect(() => {
    fetchSettings();
  }, [appLayer]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appLayer) return;
    setIsSaving(true);
    setError(null);

    const program = Effect.gen(function* (_) {
      const pbService = yield* _(PocketBaseService);
      const logger = yield* _(LoggerService);
      yield* _(logger.info("💾 Persisting settings updates to database..."));

      yield* _(pbService.updateSetting('AUTO_ENRICHMENT', settings.autoEnrichment));
      yield* _(pbService.updateSetting('TAURI_NATIVE_BACKEND', settings.tauriBackend));
      yield* _(pbService.updateSetting('MAX_CONCURRENT_UPLOADS', settings.maxConcurrentUploads));
      yield* _(pbService.updateSetting('YT_UPLOAD_RETRY_LIMIT', settings.retryLimit));
      yield* _(pbService.updateSetting('YT_DEFAULT_PRIVACY', settings.defaultPrivacy));

      yield* _(logger.info("✅ Settings successfully persisted to database."));
    });

    try {
      await Effect.runPromise(Effect.provide(program, appLayer));
      setShowSavedToast(true);
      setTimeout(() => setShowSavedToast(false), 3000);
    } catch (err) {
      console.error("Save settings error:", err);
      setError("Failed to save settings to the database.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
        <Loader2 className="animate-spin text-blue-600 mb-4" size={36} />
        <p className="font-bold tracking-wide uppercase text-xs">Loading Settings...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Settings className="text-blue-600 dark:text-blue-400" size={32} />
            Tenant Settings
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Configure preferences for active tenant: <span className="font-bold text-blue-600 dark:text-blue-400">{tenant?.name || 'Local'}</span>
          </p>
        </div>
      </header>

      {showSavedToast && (
        <div className="flex items-center gap-2 p-4 bg-green-50 dark:bg-green-950/30 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-900/50 rounded-2xl shadow-lg shadow-green-100 dark:shadow-none animate-in fade-in slide-in-from-top-2 duration-300">
          <CheckCircle2 className="text-green-600 dark:text-green-400" size={20} />
          <span className="text-sm font-bold">Configurations updated dynamically without app restart!</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-900/50 rounded-2xl shadow-lg">
          <span className="text-sm font-bold">{error}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* General Preferences */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 pb-4 border-b border-slate-100 dark:border-slate-800">
            <Sparkles className="text-purple-600" size={20} />
            <h3 className="font-extrabold text-slate-950 dark:text-white text-lg">General Preferences</h3>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold text-slate-900 dark:text-white">Auto-Enrichment</p>
              <p className="text-sm text-slate-500 max-w-lg">Automatically optimize titles and descriptions using Brotli-based structural metadata.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.autoEnrichment}
                onChange={(e) => setSettings({ ...settings, autoEnrichment: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-6">
            <div>
              <p className="font-bold text-slate-900 dark:text-white">Default YouTube Privacy</p>
              <p className="text-sm text-slate-500 max-w-lg">Set the default visibility level for all staged videos uploaded in batches.</p>
            </div>
            <select
              value={settings.defaultPrivacy}
              onChange={(e) => setSettings({ ...settings, defaultPrivacy: e.target.value as any })}
              className="bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-2.5 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none text-slate-800 dark:text-slate-100"
            >
              <option value="private">Private</option>
              <option value="public">Public</option>
              <option value="unlisted">Unlisted</option>
            </select>
          </div>
        </div>

        {/* Integration Options */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 pb-4 border-b border-slate-100 dark:border-slate-800">
            <Cpu className="text-blue-600" size={20} />
            <h3 className="font-extrabold text-slate-950 dark:text-white text-lg">System Integration</h3>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold text-slate-900 dark:text-white">Tauri Native Backend</p>
              <p className="text-sm text-slate-500 max-w-lg">Force the application to bypass Axum and directly execute native Rust Core Tauri commands.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.tauriBackend}
                onChange={(e) => setSettings({ ...settings, tauriBackend: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>

        {/* Performance & Upload Options */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 pb-4 border-b border-slate-100 dark:border-slate-800">
            <HardDrive className="text-green-600" size={20} />
            <h3 className="font-extrabold text-slate-950 dark:text-white text-lg">Queue & Performance</h3>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <label htmlFor="maxConcurrentUploads" className="font-bold text-slate-900 dark:text-white cursor-pointer">Max Concurrent Uploads</label>
              <p className="text-sm text-slate-500 max-w-lg">Maximum concurrent videos processed by the background worker thread.</p>
            </div>
            <input
              id="maxConcurrentUploads"
              type="number"
              min="1"
              max="10"
              value={settings.maxConcurrentUploads}
              onChange={(e) => setSettings({ ...settings, maxConcurrentUploads: Math.max(1, Number(e.target.value)) })}
              className="w-24 bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-2.5 text-sm font-bold text-center focus:ring-2 focus:ring-blue-500 outline-none text-slate-800 dark:text-slate-100"
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-slate-100 dark:border-slate-800 pt-6">
            <div>
              <label htmlFor="retryLimit" className="font-bold text-slate-900 dark:text-white cursor-pointer">API Upload Retry Limit</label>
              <p className="text-sm text-slate-500 max-w-lg">Number of times the system will retry uploading a chunk on connection failures.</p>
            </div>
            <input
              id="retryLimit"
              type="number"
              min="0"
              max="20"
              value={settings.retryLimit}
              onChange={(e) => setSettings({ ...settings, retryLimit: Math.max(0, Number(e.target.value)) })}
              className="w-24 bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-2.5 text-sm font-bold text-center focus:ring-2 focus:ring-blue-500 outline-none text-slate-800 dark:text-slate-100"
            />
          </div>
        </div>

        {/* Buttons */}
        <div className="flex justify-end gap-4 pt-4">
          <button
            type="button"
            onClick={handleReset}
            className="px-6 py-3 rounded-2xl text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-2"
          >
            <RotateCcw size={16} />
            Reset Defaults
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-2xl font-black text-sm flex items-center gap-2 transition-all shadow-lg shadow-blue-200 dark:shadow-none"
          >
            {isSaving ? (
              <Loader2 className="animate-spin" size={16} />
            ) : (
              <Save size={16} />
            )}
            Save Configuration
          </button>
        </div>
      </form>
    </div>
  );
};
