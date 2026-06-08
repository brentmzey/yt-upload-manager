import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Video, Radio, Users, Settings, LogOut, Search, Bell, Menu, X, Cpu, Activity, Building2 } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { invoke } from '@tauri-apps/api/core';
import { isTauri } from '../lib/env';
import type { SystemStatus } from '../bindings/youtube_types';

const Logo: React.FC = () => (
  <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-600 dark:from-indigo-600 dark:to-purple-800 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200 dark:shadow-indigo-900/20 hover:scale-105 transition-transform duration-300">
    <svg className="w-6 h-6 text-white" viewBox="0 0 128 128" fill="currentColor">
      <path d="M50.4 78.5a75.1 75.1 0 0 0-28.5 6.9l24.2-65.7c.7-2 1.9-3.2 3.4-3.2h29c1.5 0 2.7 1.2 3.4 3.2l24.2 65.7s-11.6-7-28.5-7L67 45.5c-.4-1.7-1.6-2.8-2.9-2.8-1.3 0-2.5 1.1-2.9 2.7L50.4 78.5Zm-1.1 28.2Zm-4.2-20.2c-2 6.6-.6 15.8 4.2 20.2a17.5 17.5 0 0 1 .2-.7 5.5 5.5 0 0 1 5.7-4.5c2.8.1 4.3 1.5 4.7 4.7.2 1.1.2 2.3.2 3.5v.4c0 2.7.7 5.2 2.2 7.4a13 13 0 0 0 5.7 4.9v-.3l-.2-.3c-1.8-5.6-.5-9.5 4.4-12.8l1.5-1a73 73 0 0 0 3.2-2.2 16 16 0 0 0 6.8-11.4c.3-2 .1-4-.6-6l-.8.6-1.6 1a37 37 0 0 1-22.4 2.7c-5-.7-9.7-2-13.2-6.2Z" />
    </svg>
  </div>
);

interface SidebarItemProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}

const SidebarItem: React.FC<SidebarItemProps> = ({ icon, label, active, onClick }) => (
  <div 
    onClick={onClick}
    className={`flex items-center space-x-3 p-3 rounded-xl cursor-pointer transition-all duration-300 relative overflow-hidden group ${
      active 
        ? 'bg-white/40 dark:bg-slate-800/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] border border-white/20 dark:border-slate-700/50 text-indigo-700 dark:text-indigo-300' 
        : 'text-slate-500 hover:bg-slate-500/5 dark:text-slate-400 dark:hover:bg-slate-400/10 hover:text-slate-900 dark:hover:text-slate-100'
    }`}
  >
    {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-indigo-500 rounded-r-full shadow-[0_0_10px_rgba(99,102,241,0.8)]"></div>}
    <div className={`transition-transform duration-300 ${active ? 'scale-110' : 'group-hover:scale-110'}`}>{icon}</div>
    <span className="font-semibold text-sm tracking-tight">{label}</span>
  </div>
);

interface DashboardLayoutProps {
  children: React.ReactNode;
  activePage: string;
  onPageChange: (page: string) => void;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children, activePage, onPageChange }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);

  useEffect(() => {
    if (isTauri()) {
      const fetchStatus = async () => {
        try {
          const status = await invoke<SystemStatus>('get_system_status');
          setSystemStatus(status);
        } catch (e) {
          console.error('Failed to fetch system status', e);
        }
      };
      fetchStatus();
      const interval = setInterval(fetchStatus, 5000);
      return () => clearInterval(interval);
    }
  }, []);

  const handleNav = (page: string) => {
    onPageChange(page);
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="flex h-screen relative bg-slate-50 dark:bg-slate-950 overflow-hidden font-sans text-slate-900 dark:text-slate-100 transition-colors duration-500">
      
      {/* Background Mesh Gradients */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] rounded-full bg-blue-400/20 dark:bg-blue-900/20 blur-[100px] animate-pulse mix-blend-multiply dark:mix-blend-screen" style={{ animationDuration: '8s' }}></div>
        <div className="absolute top-[20%] -right-[10%] w-[50%] h-[50%] rounded-full bg-indigo-400/20 dark:bg-indigo-900/20 blur-[120px] animate-pulse mix-blend-multiply dark:mix-blend-screen" style={{ animationDuration: '12s' }}></div>
        <div className="absolute -bottom-[20%] left-[20%] w-[60%] h-[60%] rounded-full bg-purple-400/10 dark:bg-purple-900/10 blur-[150px] animate-pulse mix-blend-multiply dark:mix-blend-screen" style={{ animationDuration: '10s' }}></div>
      </div>

      {/* Sidebar - Desktop */}
      <aside className="relative z-20 w-64 bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl border-r border-white/40 dark:border-slate-800/50 flex flex-col p-6 space-y-8 hidden md:flex shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
        <div className="flex items-center space-x-3 px-2">
          <Logo />
          <span className="text-xl font-black tracking-tight dark:text-white">YT Manager</span>
        </div>
        
        <nav className="flex-1 space-y-2">
          <SidebarItem icon={<LayoutDashboard size={20} />} label="Dashboard" active={activePage === 'dashboard'} onClick={() => handleNav('dashboard')} />
          <SidebarItem icon={<Video size={20} />} label="Uploads" active={activePage === 'uploads'} onClick={() => handleNav('uploads')} />
          <SidebarItem icon={<Radio size={20} />} label="Live Streams" active={activePage === 'live'} onClick={() => handleNav('live')} />
          <SidebarItem icon={<Users size={20} />} label="Channels" active={activePage === 'channels'} onClick={() => handleNav('channels')} />
          <div className="pt-8 pb-2 px-2 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Admin</div>
          <SidebarItem icon={<Building2 size={20} />} label="Tenants" active={activePage === 'tenants'} onClick={() => handleNav('tenants')} />
          <SidebarItem icon={<Settings size={20} />} label="Settings" active={activePage === 'settings'} onClick={() => handleNav('settings')} />
        </nav>

        <div className="pt-4 border-t border-slate-200/50 dark:border-slate-800/50">
          <SidebarItem icon={<LogOut size={20} />} label="Logout" />
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/20 dark:bg-slate-900/60 backdrop-blur-md z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside className={`fixed inset-y-0 left-0 w-64 bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl shadow-2xl z-50 transform transition-transform duration-300 ease-in-out md:hidden ${
        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="p-6 flex flex-col h-full">
          <div className="flex items-center justify-between mb-8 px-2">
            <div className="flex items-center space-x-3">
              <Logo />
              <span className="text-xl font-black tracking-tight dark:text-white">YT Manager</span>
            </div>
            <button onClick={() => setIsMobileMenuOpen(false)} className="text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 p-2 rounded-xl transition-colors">
              <X size={20} />
            </button>
          </div>
          
          <nav className="flex-1 space-y-2">
            <SidebarItem icon={<LayoutDashboard size={20} />} label="Dashboard" active={activePage === 'dashboard'} onClick={() => handleNav('dashboard')} />
            <SidebarItem icon={<Video size={20} />} label="Uploads" active={activePage === 'uploads'} onClick={() => handleNav('uploads')} />
            <SidebarItem icon={<Radio size={20} />} label="Live Streams" active={activePage === 'live'} onClick={() => handleNav('live')} />
            <SidebarItem icon={<Users size={20} />} label="Channels" active={activePage === 'channels'} onClick={() => handleNav('channels')} />
            <div className="pt-8 pb-2 px-2 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Admin</div>
            <SidebarItem icon={<Building2 size={20} />} label="Tenants" active={activePage === 'tenants'} onClick={() => handleNav('tenants')} />
            <SidebarItem icon={<Settings size={20} />} label="Settings" active={activePage === 'settings'} onClick={() => handleNav('settings')} />
          </nav>

          <div className="pt-4 border-t border-slate-200/50 dark:border-slate-800/50">
            <SidebarItem icon={<LogOut size={20} />} label="Logout" />
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="relative z-10 flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl border-b border-white/40 dark:border-slate-800/50 flex items-center justify-between px-4 md:px-8 shadow-sm">
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 text-slate-500 hover:bg-slate-200/50 dark:text-slate-400 dark:hover:bg-slate-800/50 rounded-xl md:hidden transition-colors"
            >
              <Menu size={20} />
            </button>
            <div className="relative w-64 lg:w-96 hidden sm:block group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 group-focus-within:text-indigo-500 transition-colors" size={18} />
              <input 
                type="text" 
                placeholder="Search batches or channels..." 
                className="w-full bg-white/50 dark:bg-slate-900/50 backdrop-blur-md border border-slate-200/50 dark:border-slate-700/50 rounded-full py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/30 transition-all dark:text-slate-100 placeholder-slate-400/70 shadow-inner"
              />
            </div>
          </div>
          
          <div className="flex items-center space-x-3 md:space-x-6">
            {systemStatus && (
              <div className="hidden lg:flex items-center space-x-4 px-4 py-1.5 bg-white/50 dark:bg-slate-800/50 backdrop-blur-md rounded-full border border-slate-200/50 dark:border-slate-700/50 shadow-sm">
                <div className="flex items-center gap-2">
                  <Cpu size={14} className="text-indigo-500 animate-pulse" />
                  <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">{systemStatus.cpu_usage.toFixed(1)}%</span>
                </div>
                <div className="w-px h-3 bg-slate-300 dark:bg-slate-600"></div>
                <div className="flex items-center gap-2">
                  <Activity size={14} className="text-emerald-500" />
                  <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">{systemStatus.active_jobs} Jobs</span>
                </div>
              </div>
            )}
            <ThemeToggle />
            <button className="relative text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 transition-colors p-2 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 rounded-xl">
              <Bell size={20} />
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-slate-900 shadow-[0_0_8px_rgba(239,68,68,0.8)]"></span>
            </button>
            <div className="flex items-center space-x-3 pl-2 border-l border-slate-200/50 dark:border-slate-700/50">
              <div className="text-right hidden lg:block">
                <p className="text-sm font-bold leading-none dark:text-white tracking-tight">Senior Architect</p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold tracking-widest mt-1">Administrator</p>
              </div>
              <div className="w-9 h-9 md:w-10 md:h-10 bg-gradient-to-tr from-indigo-100 to-white dark:from-indigo-900/30 dark:to-slate-800 rounded-full border border-white/60 dark:border-slate-700 overflow-hidden shadow-md shrink-0 p-0.5 transition-transform hover:scale-105 cursor-pointer">
                <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Senior" alt="User" className="rounded-full bg-slate-100 dark:bg-slate-800" />
              </div>
            </div>
          </div>
        </header>

        {/* Scrollable Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 relative z-10">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
