import React, { useState } from 'react';
import { LayoutDashboard, Video, Radio, Users, Settings, LogOut, Search, Bell, Menu, X } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';

interface SidebarItemProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}

const SidebarItem: React.FC<SidebarItemProps> = ({ icon, label, active, onClick }) => (
  <div 
    onClick={onClick}
    className={`flex items-center space-x-3 p-3 rounded-xl cursor-pointer transition-all duration-200 ${
      active 
        ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' 
        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'
    }`}
  >
    {icon}
    <span className="font-semibold text-sm">{label}</span>
  </div>
);

export const DashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden font-sans text-slate-900 dark:text-slate-100 transition-colors duration-300">
      {/* Sidebar - Desktop */}
      <aside className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col p-6 space-y-8 hidden md:flex">
        <div className="flex items-center space-x-3 px-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">YT</div>
          <span className="text-xl font-bold tracking-tight dark:text-white">Manager</span>
        </div>
        
        <nav className="flex-1 space-y-1">
          <SidebarItem icon={<LayoutDashboard size={20} />} label="Dashboard" active />
          <SidebarItem icon={<Video size={20} />} label="Uploads" />
          <SidebarItem icon={<Radio size={20} />} label="Live Streams" />
          <SidebarItem icon={<Users size={20} />} label="Channels" />
          <div className="pt-8 pb-2 px-2 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Admin</div>
          <SidebarItem icon={<Settings size={20} />} label="Settings" />
        </nav>

        <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
          <SidebarItem icon={<LogOut size={20} />} label="Logout" />
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside className={`fixed inset-y-0 left-0 w-64 bg-white dark:bg-slate-900 shadow-2xl z-50 transform transition-transform duration-300 ease-in-out md:hidden ${
        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="p-6 flex flex-col h-full">
          <div className="flex items-center justify-between mb-8 px-2">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">YT</div>
              <span className="text-xl font-bold tracking-tight dark:text-white">Manager</span>
            </div>
            <button onClick={() => setIsMobileMenuOpen(false)} className="text-slate-500 dark:text-slate-400">
              <X size={24} />
            </button>
          </div>
          
          <nav className="flex-1 space-y-1">
            <SidebarItem icon={<LayoutDashboard size={20} />} label="Dashboard" active onClick={() => setIsMobileMenuOpen(false)} />
            <SidebarItem icon={<Video size={20} />} label="Uploads" onClick={() => setIsMobileMenuOpen(false)} />
            <SidebarItem icon={<Radio size={20} />} label="Live Streams" onClick={() => setIsMobileMenuOpen(false)} />
            <SidebarItem icon={<Users size={20} />} label="Channels" onClick={() => setIsMobileMenuOpen(false)} />
            <div className="pt-8 pb-2 px-2 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Admin</div>
            <SidebarItem icon={<Settings size={20} />} label="Settings" onClick={() => setIsMobileMenuOpen(false)} />
          </nav>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
            <SidebarItem icon={<LogOut size={20} />} label="Logout" />
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 md:px-8">
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 rounded-lg md:hidden"
            >
              <Menu size={24} />
            </button>
            <div className="relative w-64 lg:w-96 hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
              <input 
                type="text" 
                placeholder="Search batches or channels..." 
                className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-full py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-blue-500 transition-all dark:text-slate-100"
              />
            </div>
          </div>
          
          <div className="flex items-center space-x-3 md:space-x-6">
            <ThemeToggle />
            <button className="relative text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 transition-colors p-2">
              <Bell size={20} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-slate-900"></span>
            </button>
            <div className="flex items-center space-x-3">
              <div className="text-right hidden lg:block">
                <p className="text-sm font-bold leading-none dark:text-white">Senior Architect</p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold tracking-wider mt-1">Administrator</p>
              </div>
              <div className="w-8 h-8 md:w-10 md:h-10 bg-slate-200 dark:bg-slate-800 rounded-full border-2 border-slate-100 dark:border-slate-800 overflow-hidden shadow-inner shrink-0">
                <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Senior" alt="User" />
              </div>
            </div>
          </div>
        </header>

        {/* Scrollable Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50 dark:bg-slate-950">
          <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
