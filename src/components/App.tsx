import React, { useState } from 'react';
import { DashboardLayout } from './DashboardLayout';
import { BatchManager } from './BatchManager';
import { ChannelManager } from './ChannelManager';
import { SettingsManager } from './SettingsManager';
import { TenantManager } from './TenantManager';
import { LogConsole } from './LogConsole';
import { LayoutDashboard, Video, Radio, Users, Settings, Plus, Loader2 } from 'lucide-react';
import { TenantProvider, useTenant } from '../lib/tenant_context';

const AppContent: React.FC = () => {
  const [activePage, setActivePage] = useState('dashboard');
  const { tenant, isLoading, error } = useTenant();

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="animate-spin text-indigo-600 mb-4" size={48} />
        <p className="text-slate-500 font-bold tracking-widest uppercase text-xs">Bootstrapping Application...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 p-8 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-red-600 mb-6">
          <Settings size={32} />
        </div>
        <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Configuration Error</h2>
        <p className="text-slate-500 max-w-md mb-8">{error}</p>
        <button onClick={() => window.location.reload()} className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-8 py-3 rounded-xl font-bold">Retry Boot</button>
      </div>
    );
  }

  const renderContent = () => {
    switch (activePage) {
      case 'dashboard':
        return (
          <>
            <header className="mb-8">
              <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter">Overview</h1>
              <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium tracking-wide">Manage your multi-channel YouTube operations.</p>
            </header>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-8">
                <BatchManager />
              </div>
              
              <div className="space-y-8">
                <section className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl p-6 rounded-3xl border border-white/40 dark:border-slate-800/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.1)] transition-all">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="font-bold text-lg text-slate-900 dark:text-white tracking-tight">Active Channels</h3>
                    <button 
                      onClick={() => setActivePage('channels')}
                      className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800/80 rounded-xl text-indigo-600 dark:text-indigo-400 transition-colors bg-indigo-50 dark:bg-indigo-500/10"
                    >
                      <Plus size={20} />
                    </button>
                  </div>
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-white/40 dark:bg-slate-800/40 hover:bg-white dark:hover:bg-slate-800 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 rounded-2xl border border-white/40 dark:border-slate-700/50 cursor-pointer group">
                        <div className="flex items-center space-x-4">
                          <div className="w-12 h-12 bg-gradient-to-br from-indigo-100 to-white dark:from-indigo-900/40 dark:to-slate-800 rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-black text-sm shadow-inner border border-white/60 dark:border-slate-700/50">C{i}</div>
                          <div>
                            <p className="text-sm font-bold text-slate-900 dark:text-white tracking-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">Channel #{i}</p>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest mt-0.5">YouTube Official</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 dark:bg-emerald-500/10 rounded-full border border-emerald-100 dark:border-emerald-500/20">
                          <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
                          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">LIVE</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="bg-gradient-to-br from-indigo-500 via-purple-500 to-fuchsia-600 p-8 rounded-3xl shadow-[0_20px_40px_-15px_rgba(99,102,241,0.5)] text-white relative overflow-hidden group">
                  <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPgo8cmVjdCB3aWR0aD0iOCIgaGVpZ2h0PSI4IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMDUiLz4KPC9zdmc+')] opacity-20"></div>
                  <div className="relative z-10">
                    <h3 className="font-black text-2xl mb-2 tracking-tight drop-shadow-sm">Pro Enrichment</h3>
                    <p className="text-white/80 text-sm mb-6 font-medium leading-relaxed">Upgrade to unlock AI-powered metadata optimization and batch thumbnail generation.</p>
                    <button className="bg-white/20 hover:bg-white/30 backdrop-blur-md border border-white/30 text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 shadow-lg group-hover:scale-105 active:scale-95 flex items-center gap-2">
                      Upgrade Now
                    </button>
                  </div>
                  <div className="absolute -right-8 -bottom-8 w-40 h-40 bg-white/20 rounded-full blur-3xl mix-blend-overlay group-hover:bg-white/30 transition-all duration-500"></div>
                  <div className="absolute -left-8 -top-8 w-32 h-32 bg-indigo-400/40 rounded-full blur-2xl mix-blend-overlay"></div>
                </section>
              </div>
            </div>
          </>
        );
      case 'channels':
        return <ChannelManager />;
      case 'uploads':
      case 'live':
        return (
          <div className="h-96 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-900 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800">
            <Video size={48} className="mb-4 opacity-20" />
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Coming Soon</h3>
            <p className="text-sm">Advanced {activePage} history and analytics are under development.</p>
          </div>
        );
      case 'settings':
        return <SettingsManager />;
      case 'tenants':
        return <TenantManager />;
      default:
        return <div>Page not found</div>;
    }
  };

  return (
    <DashboardLayout activePage={activePage} onPageChange={setActivePage}>
      {renderContent()}
      <LogConsole />
    </DashboardLayout>
  );
};

export const App: React.FC = () => {
  return (
    <TenantProvider>
      <AppContent />
    </TenantProvider>
  );
};
