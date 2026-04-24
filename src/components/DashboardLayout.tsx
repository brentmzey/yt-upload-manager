import React from 'react';
import { LayoutDashboard, Video, Radio, Users, Settings, LogOut, Search, Bell } from 'lucide-react';

interface SidebarItemProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}

const SidebarItem: React.FC<SidebarItemProps> = ({ icon, label, active }) => (
  <div className={`flex items-center space-x-3 p-3 rounded-xl cursor-pointer transition-all duration-200 ${
    active 
      ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' 
      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
  }`}>
    {icon}
    <span className="font-semibold text-sm">{label}</span>
  </div>
);

export const DashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans text-slate-900">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col p-6 space-y-8 hidden md:flex">
        <div className="flex items-center space-x-3 px-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">YT</div>
          <span className="text-xl font-bold tracking-tight">Manager</span>
        </div>
        
        <nav className="flex-1 space-y-1">
          <SidebarItem icon={<LayoutDashboard size={20} />} label="Dashboard" active />
          <SidebarItem icon={<Video size={20} />} label="Uploads" />
          <SidebarItem icon={<Radio size={20} />} label="Live Streams" />
          <SidebarItem icon={<Users size={20} />} label="Tenants" />
          <div className="pt-8 pb-2 px-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Admin</div>
          <SidebarItem icon={<Settings size={20} />} label="Settings" />
        </nav>

        <div className="pt-4 border-t border-slate-100">
          <SidebarItem icon={<LogOut size={20} />} label="Logout" />
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8">
          <div className="relative w-96 hidden lg:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search batches or tenants..." 
              className="w-full bg-slate-100 border-none rounded-full py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-blue-500 transition-all"
            />
          </div>
          
          <div className="flex items-center space-x-6">
            <button className="relative text-slate-500 hover:text-slate-900 transition-colors">
              <Bell size={20} />
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
            <div className="flex items-center space-x-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold leading-none">Senior Architect</p>
                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mt-1">Administrator</p>
              </div>
              <div className="w-10 h-10 bg-slate-200 rounded-full border-2 border-slate-100 overflow-hidden shadow-inner">
                <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Senior" alt="User" />
              </div>
            </div>
          </div>
        </header>

        {/* Scrollable Area */}
        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
