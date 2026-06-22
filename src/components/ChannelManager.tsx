import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Search, MoreVertical, ExternalLink, ShieldCheck, AlertCircle, Loader2, Database, X, Shield, Key } from 'lucide-react';
import { PocketBaseService, PocketBaseError } from '../lib/pocketbase';
import { LoggerService, LoggerServiceLive } from '../lib/logger';
import { Effect, Layer, Option } from 'effect';
import { compressToBrotliB64 } from '../lib/compression';
import { useTenant } from '../lib/tenant_context';

interface Channel {
  id: string;
  name: string;
  handle: string;
  status: 'active' | 'expired' | 'pending';
  created?: string;
  updated?: string;
  last_error?: string;
  last_sync_at?: string;
}

export const ChannelManager: React.FC = () => {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isActivating, setIsActivating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    handle: '',
    clientId: '',
    clientSecret: '',
  });

  const { appLayer } = useTenant();

  const fetchChannels = () => {
    if (!appLayer) return;
    setIsLoading(true);
    setError(null);
    const program = Effect.gen(function* (_) {
      const pbService = yield* _(PocketBaseService);
      const list = yield* _(pbService.getChannels());
      const mapped: Channel[] = list.map(c => ({
        id: c.id,
        name: c.name,
        handle: c.handle,
        status: c.status,
        created: c.created,
        updated: c.updated,
        last_error: Option.getOrNull(c.last_error) || undefined,
        last_sync_at: Option.getOrNull(c.last_sync_at) || undefined,
      }));
      setChannels(mapped);
    }).pipe(
      Effect.catchAll((err) => {
        console.error("Fetch Error:", err);
        setError("Database unreachable. Please ensure the tenant registry is correctly configured.");
        return Effect.void;
      })
    );

    Effect.runPromise(Effect.provide(program, appLayer)).finally(() => {
      setIsLoading(false);
    });
  };

  useEffect(() => {
    fetchChannels();
  }, [appLayer]);

  const handleActivate = (id: string) => {
    if (!appLayer) return;
    setIsActivating(id);
    const program = Effect.gen(function* (_) {
      const pbService = yield* _(PocketBaseService);
      yield* _(pbService.activateChannel(id));
      fetchChannels();
    }).pipe(
      Effect.catchAll((err) => {
        console.error("Activation Error:", err);
        alert("Failed to activate channel.");
        return Effect.void;
      })
    );

    Effect.runPromise(Effect.provide(program, appLayer)).finally(() => {
      setIsActivating(null);
    });
  };

  const handleAddChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("🖱️ Save Channel button clicked");
    
    if (!formData.name || !formData.clientId || !formData.clientSecret) {
      alert("Please fill in all required fields.");
      return;
    }

    setIsSaving(true);

    const program = Effect.gen(function* (_) {
      const pbService = yield* _(PocketBaseService);
      const logger = yield* _(LoggerService);
      
      yield* _(logger.info("🎬 Starting channel addition process..."));

      const configStr = JSON.stringify({
        clientId: formData.clientId,
        clientSecret: formData.clientSecret,
        scopes: ['https://www.googleapis.com/auth/youtube.upload']
      });
      
      yield* _(logger.info("🗜️ Compressing OAuth configuration..."));
      let compressedConfig;
      try {
        compressedConfig = yield* _(
          compressToBrotliB64(configStr).pipe(
            Effect.timeout("5 seconds"),
            Effect.catchTag("TimeoutException", () => 
              Effect.fail({ _tag: "CompressionError", message: "Brotli WASM timed out" })
            )
          )
        );
      } catch (e) {
        yield* _(logger.warn("⚠️ Compression failed or timed out. Saving uncompressed fallback.", { error: e }));
        // Fallback to raw B64 if compression fails, to keep the app working
        compressedConfig = btoa(configStr);
      }

      yield* _(logger.info("💾 Saving channel record to PocketBase..."));
      yield* _(pbService.createChannel({
        name: formData.name,
        handle: formData.handle.startsWith('@') ? formData.handle : `@${formData.handle}`,
        status: 'pending',
        youtube_config_brotli_b64: compressedConfig,
      }));

      yield* _(logger.info("✅ Channel saved successfully!"));
    });

    try {
      if (!appLayer) throw new Error("App layer not ready");
      await Effect.runPromise(Effect.provide(program, appLayer));
      setShowAddModal(false);
      setFormData({ name: '', handle: '', clientId: '', clientSecret: '' });
      fetchChannels();
    } catch (e: unknown) {
      console.error("❌ FAILED TO SAVE CHANNEL:", e);
      const isObject = e && typeof e === 'object';
      const tag = isObject && '_tag' in e ? String((e as { _tag: unknown })._tag) : '';
      const message = isObject && 'message' in e ? String((e as { message: unknown }).message) : '';

      const errorMessage = tag === 'CompressionError' 
        ? `Compression failed: ${message}. This usually means the WASM module failed to load.`
        : `Database error: ${tag || 'Unknown error'}.`;
      
      alert(`Error: ${errorMessage}`);
    } finally {
      setIsSaving(false);
    }
  };

  const filteredChannels = (channels || []).filter(c => 
    c.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.handle?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-slate-900 rounded-2xl border border-red-200 dark:border-red-900 shadow-sm text-center space-y-4">
        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center text-red-600 dark:text-red-400">
          <Database size={32} />
        </div>
        <h2 className="text-2xl font-black text-slate-900 dark:text-white">Setup Required</h2>
        <p className="text-slate-500 dark:text-slate-400 max-w-md">{error}</p>
        <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg text-left text-sm font-mono text-slate-600 dark:text-slate-300 w-full max-w-md">
          <p className="font-bold mb-2">Run the following command:</p>
          <code>just up</code>
        </div>
        <button onClick={fetchChannels} className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all">Retry Connection</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Channel Management</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Connect and monitor your YouTube authorized accounts</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-all shadow-lg shadow-indigo-200 dark:shadow-none hover:scale-105 active:scale-95"
        >
          <Plus size={18} />
          Add New Channel
        </button>
      </header>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xl transition-all">
          <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl w-full max-w-lg rounded-3xl shadow-2xl border border-white/40 dark:border-slate-700/50 overflow-hidden transform scale-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <h3 className="text-lg font-black text-slate-900 dark:text-white">Add YouTube Channel</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
            </div>
            <form onSubmit={handleAddChannel} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400">Display Name</label>
                  <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. My Vlog" className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"/>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400">Handle</label>
                  <input required value={formData.handle} onChange={e => setFormData({...formData, handle: e.target.value})} placeholder="@mychannel" className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"/>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1"><Key size={10}/> OAuth Client ID</label>
                <input required value={formData.clientId} onChange={e => setFormData({...formData, clientId: e.target.value})} placeholder="Paste Client ID here" className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"/>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1"><Shield size={10}/> OAuth Client Secret</label>
                <input required type="password" value={formData.clientSecret} onChange={e => setFormData({...formData, clientSecret: e.target.value})} placeholder="Paste Client Secret here" className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"/>
              </div>
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-2 text-sm font-bold text-slate-500 hover:text-slate-700">Cancel</button>
                <button type="submit" disabled={isSaving} className="flex-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-2 rounded-xl font-bold text-sm flex items-center justify-center gap-2">
                  {isSaving ? <Loader2 className="animate-spin" size={16}/> : <Plus size={16}/>}
                  Save Channel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl rounded-3xl border border-white/40 dark:border-slate-800/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.1)] overflow-hidden transition-all">
        <div className="p-4 border-b border-white/40 dark:border-slate-800/50 flex items-center gap-4">
          <div className="relative flex-1 max-w-md group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 group-focus-within:text-indigo-500 transition-colors" size={18} />
            <input 
              type="text" 
              placeholder="Filter channels..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/50 dark:bg-slate-800/50 backdrop-blur-md border border-slate-200/50 dark:border-slate-700/50 rounded-xl py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/30 transition-all outline-none shadow-inner"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="p-20 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
            <Loader2 className="animate-spin mb-4" size={32} />
            <p className="font-medium">Loading channels...</p>
          </div>
        ) : filteredChannels.length === 0 ? (
          <div className="p-20 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 text-center">
            <ShieldCheck size={48} className="mb-4 opacity-20" />
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No Channels Configured</h3>
            <p className="text-sm max-w-md">Click "Add New Channel" to get started with your YouTube OAuth credentials.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
            {filteredChannels.map(channel => (
              <div key={channel.id} className="bg-white/40 dark:bg-slate-800/40 backdrop-blur-md border border-white/40 dark:border-slate-700/50 p-6 rounded-2xl hover:-translate-y-1 hover:shadow-xl hover:bg-white dark:hover:bg-slate-800 transition-all duration-300 group">
                <div className="flex justify-between items-start mb-4">
                  <div className="relative">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-xl shadow-[0_8px_20px_rgba(99,102,241,0.3)] border border-white/20 dark:border-slate-700 group-hover:scale-110 transition-transform duration-300">
                      {channel.name?.charAt(0).toUpperCase()}
                    </div>
                    <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-lg border-2 border-white dark:border-slate-900 flex items-center justify-center shadow-sm ${
                      channel.status === 'active' ? 'bg-emerald-500 text-white' : channel.status === 'pending' ? 'bg-amber-500 text-white' : 'bg-red-500 text-white'
                    }`}>
                      {channel.status === 'active' ? <ShieldCheck size={12} /> : <AlertCircle size={12} />}
                    </div>
                  </div>
                  <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1">
                    <MoreVertical size={20} />
                  </button>
                </div>

                <div className="space-y-1 mb-4">
                  <h3 className="font-bold text-slate-900 dark:text-white truncate">{channel.name}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{channel.handle}</p>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/40 dark:border-slate-700/50">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-0.5">Created</p>
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                      {channel.created ? new Date(channel.created).toLocaleDateString() : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-0.5">Status</p>
                    <p className={`text-sm font-bold capitalize ${
                      channel.status === 'active' ? 'text-green-600 dark:text-green-400' : channel.status === 'pending' ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'
                    }`}>{channel.status}</p>
                  </div>
                </div>

                {channel.last_sync_at && (
                  <div className="mt-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-0.5">Last Sync</p>
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-400">{new Date(channel.last_sync_at).toLocaleString()}</p>
                  </div>
                )}

                {channel.last_error && (
                  <div className="mt-2 bg-red-50 dark:bg-red-900/20 p-2 rounded border border-red-100 dark:border-red-900/30">
                    <p className="text-[10px] font-black uppercase tracking-widest text-red-400 mb-0.5">Last Error</p>
                    <p className="text-[11px] font-medium text-red-600 dark:text-red-400 line-clamp-2">{channel.last_error}</p>
                  </div>
                )}

                <div className="mt-6 flex gap-2">
                  <button className="flex-1 py-2 px-4 rounded-xl bg-white/50 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm transition-all">
                    View Config
                  </button>
                  {channel.status !== 'active' && (
                    <button 
                      onClick={() => handleActivate(channel.id)}
                      disabled={isActivating === channel.id}
                      className="flex-1 py-2 px-4 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[11px] font-bold hover:bg-emerald-500 hover:text-white transition-all flex items-center justify-center gap-2"
                    >
                      {isActivating === channel.id ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={12} />}
                      Activate
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
