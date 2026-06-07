import React, { useState } from 'react';
import { DashboardLayout } from './DashboardLayout';
import { BatchManager } from './BatchManager';
import { ChannelManager } from './ChannelManager';
import { SettingsManager } from './SettingsManager';
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
            <header>
              <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Overview</h1>
              <p className="text-slate-500 dark:text-slate-400 mt-1">Manage your multi-channel YouTube operations.</p>
            </header>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-8">
                <BatchManager />
              </div>
              
              <div className="space-y-8">
                <section className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-lg text-slate-900 dark:text-white">Active Channels</h3>
                    <button 
                      onClick={() => setActivePage('channels')}
                      className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-blue-600 dark:text-blue-400 transition-colors"
                    >
                      <Plus size={20} />
                    </button>
                  </div>
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 hover:shadow-md hover:border-blue-100 dark:hover:border-blue-900 transition-all rounded-xl border border-slate-100 dark:border-slate-800 cursor-pointer group">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-sm">C{i}</div>
                          <div>
                            <p className="text-sm font-bold text-slate-900 dark:text-white">Channel #{i}</p>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">YouTube Official</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="bg-gradient-to-br from-blue-600 to-indigo-700 dark:from-blue-700 dark:to-indigo-900 p-6 rounded-2xl shadow-xl shadow-blue-100 dark:shadow-none text-white relative overflow-hidden">
                  <div className="relative z-10">
                    <h3 className="font-bold text-lg mb-2">Pro Enrichment</h3>
                    <p className="text-blue-100 text-sm mb-4">Upgrade to unlock AI-powered metadata optimization and batch thumbnail generation.</p>
                    <button className="bg-white text-blue-600 px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-50 transition-colors">Upgrade Now</button>
                  </div>
                  <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
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
