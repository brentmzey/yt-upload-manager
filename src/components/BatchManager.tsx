import React, { useState, useMemo } from 'react';
import { Effect, Layer, Chunk } from 'effect';
import { YouTubeServiceLive, processBatch } from '../lib/youtube/service';
import { LoggerServiceLive, logInfo, logError } from '../lib/logger';
import { VideoMetadataSchema } from '../lib/tenant/config';
import { Option, Stream } from 'effect';
import { RefreshCw, CheckCircle2, XCircle, Loader2, AlertTriangle, Play, RotateCcw } from 'lucide-react';

type BatchTask = {
  id: string;
  metadata: typeof VideoMetadataSchema.Type;
  file: Blob;
  status: 'idle' | 'processing' | 'success' | 'error';
  error?: string;
};

export const BatchManager: React.FC = () => {
  const [mode, setMode] = useState<'upload' | 'schedule'>('upload');
  const [tasks, setTasks] = useState<BatchTask[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Initialize mock tasks for demonstration
  const initTasks = () => {
    const newTasks: BatchTask[] = Array.from({ length: 3 }).map((_, i) => ({
      id: crypto.randomUUID(),
      metadata: {
        title: `Video ${i + 1}: {{campaign}}`,
        description: 'Batch metadata description with {{author}}',
        privacyStatus: 'private' as const,
        license: 'youtube' as const,
        embeddable: true,
        publicStatsViewable: true,
        madeForKids: false,
        containsSyntheticMedia: false,
        paidProductPlacement: false,
        tags: ['batch', `vid${i}`],
        categoryId: '22',
        subDetails: { campaign: 'Spring 2026', author: 'Senior Arch' },
        thumbnailUrl: Option.none(),
        scheduledStartTime: mode === 'schedule' ? Option.some('2026-05-01T12:00:00Z') : Option.none(),
        publishAt: Option.none(),
        recordingDate: Option.none(),
        language: Option.some('en'),
        localizations: Option.none(),
      },
      file: new Blob(['test'], { type: 'video/mp4' }),
      status: 'idle',
    }));
    setTasks(newTasks);
  };

  const handleRunBatch = async (taskIds?: string[]) => {
    setIsProcessing(true);
    const targetTasks = tasks.filter(t => taskIds ? taskIds.includes(t.id) : (t.status === 'idle' || t.status === 'error'));
    
    // Update target tasks to processing
    setTasks(prev => prev.map(t => targetTasks.find(tt => tt.id === t.id) ? { ...t, status: 'processing', error: undefined } : t));

    const AppLayer = Layer.mergeAll(YouTubeServiceLive, LoggerServiceLive);

    for (const task of targetTasks) {
      const batch = {
        tenantId: 'tenant-123',
        videos: [task.metadata]
      };
      
      const program = processBatch(batch, [task.file], mode);

      try {
        await Effect.runPromise(Effect.provide(program, AppLayer));
        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'success' } : t));
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'error', error: msg } : t));
      }
    }
    setIsProcessing(false);
  };

  const retryFailed = () => {
    const failedIds = tasks.filter(t => t.status === 'error').map(t => t.id);
    if (failedIds.length > 0) handleRunBatch(failedIds);
  };

  const stats = useMemo(() => ({
    total: tasks.length,
    success: tasks.filter(t => t.status === 'success').length,
    error: tasks.filter(t => t.status === 'error').length,
    processing: tasks.filter(t => t.status === 'processing').length,
  }), [tasks]);

  return (
    <div className="space-y-6">
      <div className="p-8 bg-white rounded-2xl shadow-xl border border-slate-200">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <RefreshCw className={isProcessing ? 'animate-spin text-blue-600' : 'text-slate-400'} size={24} />
              Batch Control Center
            </h2>
            <p className="text-slate-500 text-sm mt-1">Configure and monitor your multi-tenant tasks</p>
          </div>
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button 
              disabled={isProcessing}
              onClick={() => setMode('upload')}
              className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${mode === 'upload' ? 'bg-white shadow-md text-blue-600' : 'text-slate-500 hover:text-slate-700 disabled:opacity-50'}`}
            >
              Uploads
            </button>
            <button 
              disabled={isProcessing}
              onClick={() => setMode('schedule')}
              className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${mode === 'schedule' ? 'bg-white shadow-md text-blue-600' : 'text-slate-500 hover:text-slate-700 disabled:opacity-50'}`}
            >
              Live Streams
            </button>
          </div>
        </div>

        {tasks.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
            <Loader2 size={48} className="text-slate-200 mb-4" />
            <p className="text-slate-400 font-medium mb-6">No active tasks in current batch</p>
            <button 
              onClick={initTasks}
              className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all active:scale-95"
            >
              Initialize Mock Batch
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Stats Bar */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              {[
                { label: 'Total', value: stats.total, color: 'text-slate-600', bg: 'bg-slate-50' },
                { label: 'Succeeded', value: stats.success, color: 'text-green-600', bg: 'bg-green-50' },
                { label: 'Failed', value: stats.error, color: 'text-red-600', bg: 'bg-red-50' },
                { label: 'Processing', value: stats.processing, color: 'text-blue-600', bg: 'bg-blue-50' },
              ].map((s, i) => (
                <div key={i} className={`${s.bg} p-4 rounded-xl border border-black/5`}>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{s.label}</p>
                  <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                </div>
              ))}
            </div>

            {/* Task List */}
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-400 font-bold uppercase text-[10px] tracking-widest border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Title / Metadata</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tasks.map((task) => (
                    <tr key={task.id} className="group hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        {task.status === 'idle' && <div className="w-2 h-2 bg-slate-300 rounded-full"></div>}
                        {task.status === 'processing' && <Loader2 className="animate-spin text-blue-600" size={18} />}
                        {task.status === 'success' && <CheckCircle2 className="text-green-600" size={18} />}
                        {task.status === 'error' && <XCircle className="text-red-600" size={18} />}
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-bold text-slate-900">{task.metadata.title}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{task.metadata.privacyStatus} • {task.metadata.categoryId}</p>
                        {task.error && (
                          <div className="mt-2 flex items-start gap-2 text-red-600 bg-red-50 p-2 rounded border border-red-100 text-[11px] font-medium max-w-md">
                            <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                            <span>{task.error}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {task.status === 'error' && (
                          <button 
                            disabled={isProcessing}
                            onClick={() => handleRunBatch([task.id])}
                            className="p-2 hover:bg-red-100 text-red-600 rounded-lg transition-colors disabled:opacity-30"
                            title="Retry this item"
                          >
                            <RotateCcw size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex gap-4 pt-4">
              <button 
                disabled={isProcessing || tasks.every(t => t.status === 'success')}
                onClick={() => handleRunBatch()}
                className="flex-1 py-4 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 disabled:opacity-50 shadow-xl shadow-slate-200 flex items-center justify-center gap-2"
              >
                {isProcessing ? <Loader2 className="animate-spin" /> : <Play size={18} />}
                {stats.error > 0 ? 'Retry Failed & Run Idle' : 'Start Entire Batch'}
              </button>
              
              {stats.error > 0 && (
                <button 
                  disabled={isProcessing}
                  onClick={retryFailed}
                  className="px-6 py-4 border-2 border-red-200 text-red-600 rounded-xl font-bold hover:bg-red-50 transition-all flex items-center gap-2"
                >
                  <RotateCcw size={18} />
                  Retry All Failures
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
