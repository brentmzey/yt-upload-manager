import React, { useEffect, useState, useRef } from 'react';
import { Terminal, Trash2, ChevronDown, Info } from 'lucide-react';
import { uiLogListeners, type UILogEntry } from '../lib/logger';

export const LogConsole: React.FC = () => {
  const [logs, setLogs] = useState<UILogEntry[]>([]);
  const [isOpen, setIsOpen] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const listener = (entry: UILogEntry) => {
      setLogs(prev => [...prev.slice(-99), entry]); // Keep last 100 logs
    };
    uiLogListeners.add(listener);
    return () => { uiLogListeners.delete(listener); };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 bg-slate-900 text-white p-3 rounded-full shadow-2xl hover:scale-110 transition-transform"
      >
        <Terminal size={20} />
      </button>
    );
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 md:left-64 bg-slate-900 dark:bg-slate-950 text-slate-300 dark:text-slate-400 shadow-2xl border-t border-slate-700 dark:border-slate-800 flex flex-col transition-all h-64 z-50">
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800 dark:bg-slate-900 border-b border-slate-700 dark:border-slate-800">
        <div className="flex items-center space-x-2">
          <Terminal size={16} className="text-blue-400" />
          <span className="text-xs font-bold uppercase tracking-widest">User Feedback & Activity Logs</span>
        </div>
        <div className="flex items-center space-x-4">
          <button onClick={() => setLogs([])} className="hover:text-white dark:hover:text-slate-100 transition-colors" title="Clear logs">
            <Trash2 size={14} />
          </button>
          <button onClick={() => setIsOpen(false)} className="hover:text-white dark:hover:text-slate-100 transition-colors">
            <ChevronDown size={16} />
          </button>
        </div>
      </div>
      
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 font-mono text-[11px] leading-relaxed space-y-1">
        {logs.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-2">
            <Info size={24} className="opacity-20" />
            <p>Waiting for activity...</p>
          </div>
        )}
        {logs.map((log, i) => (
          <div key={i} className="flex space-x-3 group">
            <span className="text-slate-600 dark:text-slate-500 shrink-0">{new Date(log.timestamp).toLocaleTimeString([], { hour12: false })}</span>
            <span className={`shrink-0 ${
              log.level === 'error' ? 'text-red-400' : 
              log.level === 'warn' ? 'text-yellow-400' : 'text-blue-400'
            }`}>
              {log.level.toUpperCase()}
            </span>
            <div className="flex-1">
              <p className={log.level === 'error' ? 'text-red-200 dark:text-red-300 font-semibold' : 'text-slate-200 dark:text-slate-300'}>{log.message}</p>
              {log.detail && (
                <div className="mt-1 p-2 bg-black/30 dark:bg-black/50 rounded border border-white/5 dark:border-white/10 text-slate-400 dark:text-slate-500 break-all whitespace-pre-wrap">
                  {log.detail}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
