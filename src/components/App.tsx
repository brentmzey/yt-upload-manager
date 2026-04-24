import React, { useState } from 'react';
import { DashboardLayout } from './DashboardLayout';
import { BatchManager } from './BatchManager';
import { ChannelManager } from './ChannelManager';
import { LogConsole } from './LogConsole';
import { LayoutDashboard, Video, Radio, Users, Settings, Plus } from 'lucide-react';

export const App: React.FC = () => {
  const [activePage, setActivePage] = useState('dashboard');

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
        return (
          <div className="max-w-2xl mx-auto space-y-8">
            <header>
              <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Settings</h1>
              <p className="text-slate-500 dark:text-slate-400 mt-1">Configure your global application preferences.</p>
            </header>
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-6">
               <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white">Auto-Enrichment</p>
                    <p className="text-sm text-slate-500">Automatically optimize titles and descriptions using AI.</p>
                  </div>
                  <div className="w-12 h-6 bg-blue-600 rounded-full relative cursor-pointer">
                    <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full"></div>
                  </div>
               </div>
               <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-6">
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white">Tauri Native Backend</p>
                    <p className="text-sm text-slate-500">Use local Rust services for faster video processing.</p>
                  </div>
                  <div className="w-12 h-6 bg-slate-200 dark:bg-slate-700 rounded-full relative cursor-pointer">
                    <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full"></div>
                  </div>
               </div>
            </div>
          </div>
        );
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
