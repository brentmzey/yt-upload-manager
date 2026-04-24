import React, { useState, useEffect } from 'react';
import { Plus, Search, MoreVertical, ExternalLink, Shield, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';
import { pb } from '../lib/pocketbase';

interface Channel {
  id: string;
  name: string;
  handle: string;
  thumbnail: string;
  status: 'active' | 'expired' | 'pending';
  subscriberCount: number;
  lastSync: string;
}

export const ChannelManager: React.FC = () => {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    // Simulated fetch from PocketBase
    const timer = setTimeout(() => {
      setChannels([
        {
          id: '1',
          name: 'Tech Insights',
          handle: '@techinsights',
          thumbnail: 'https://api.dicebear.com/7.x/identicon/svg?seed=tech',
          status: 'active',
          subscriberCount: 45000,
          lastSync: new Date().toISOString(),
        },
        {
          id: '2',
          name: 'Gaming Hub',
          handle: '@gaminghub_official',
          thumbnail: 'https://api.dicebear.com/7.x/identicon/svg?seed=gaming',
          status: 'expired',
          subscriberCount: 128000,
          lastSync: new Date(Date.now() - 86400000 * 5).toISOString(),
        },
        {
          id: '3',
          name: 'Daily Vlogs',
          handle: '@dailyvlogs_life',
          thumbnail: 'https://api.dicebear.com/7.x/identicon/svg?seed=vlogs',
          status: 'active',
          subscriberCount: 1200,
          lastSync: new Date().toISOString(),
        }
      ]);
      setIsLoading(false);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  const filteredChannels = channels.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.handle.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Channel Management</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Connect and monitor your YouTube authorized accounts</p>
        </div>
        <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-all shadow-lg shadow-blue-200 dark:shadow-none">
          <Plus size={18} />
          Add New Channel
        </button>
      </header>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
            <input 
              type="text" 
              placeholder="Filter channels..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800/50 border-none rounded-lg py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-blue-500 transition-all"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="p-20 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
            <Loader2 className="animate-spin mb-4" size={32} />
            <p className="font-medium">Loading channels...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0 divide-y md:divide-y-0 md:gap-px bg-slate-100 dark:bg-slate-800">
            {filteredChannels.map(channel => (
              <div key={channel.id} className="bg-white dark:bg-slate-900 p-6 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                <div className="flex justify-between items-start mb-4">
                  <div className="relative">
                    <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 overflow-hidden border border-slate-200 dark:border-slate-700">
                      <img src={channel.thumbnail} alt={channel.name} className="w-full h-full object-cover" />
                    </div>
                    <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-lg border-2 border-white dark:border-slate-900 flex items-center justify-center ${
                      channel.status === 'active' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
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

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-0.5">Subscribers</p>
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{(channel.subscriberCount / 1000).toFixed(1)}K</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-0.5">Status</p>
                    <p className={`text-sm font-bold capitalize ${
                      channel.status === 'active' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                    }`}>{channel.status}</p>
                  </div>
                </div>

                <div className="mt-6">
                  <button className="w-full py-2 px-4 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-center gap-2 transition-all">
                    View on YouTube
                    <ExternalLink size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
