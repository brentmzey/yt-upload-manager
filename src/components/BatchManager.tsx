import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Effect, Layer } from 'effect';
import { YouTubeService, YouTubeServiceLive, processBatch } from '../lib/youtube/service';
import { LoggerServiceLive, logInfo } from '../lib/logger';
import { VideoMetadataSchema } from '../lib/channel/config';
import { Option } from 'effect';
import { RefreshCw, CheckCircle2, XCircle, Loader2, AlertTriangle, Play, RotateCcw, Upload, FileVideo, Plus, Trash2, ExternalLink } from 'lucide-react';
import type { YouTubeVideoDetails } from '../bindings/youtube_types';

type BatchTask = {
  id: string;
  metadata: typeof VideoMetadataSchema.Type;
  file: File;
  status: 'idle' | 'processing' | 'success' | 'error' | 'queued';
  error?: string;
  youtubeDetails?: YouTubeVideoDetails;
};

export const BatchManager: React.FC = () => {
  const [mode, setMode] = useState<'upload' | 'schedule'>('upload');
  const [tasks, setTasks] = useState<BatchTask[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const AppLayer = Layer.mergeAll(YouTubeServiceLive, LoggerServiceLive);
    
    const setupListener = Effect.gen(function* (_) {
      const service = yield* _(YouTubeService);
      const unlisten = yield* _(service.onJobCompleted((response) => {
        console.log('Job completed event received:', response);
        // We'd ideally match response.video_id or some correlation ID
        // For this prototype, we just log it
        Effect.runSync(
          logInfo('Job completed from backend', { videoId: response.video_id }).pipe(
            Effect.provide(LoggerServiceLive)
          )
        );
      }));
      return unlisten;
    });

    const cleanupPromise = Effect.runPromise(Effect.provide(setupListener, AppLayer));
    
    return () => {
      cleanupPromise.then(unlisten => unlisten());
    };
  }, []);

  const createDefaultMetadata = (fileName: string, scheduleOffsetDays: number): typeof VideoMetadataSchema.Type => ({
    title: fileName.split('.')[0] || 'Untitled Video',
    description: 'Auto-staged via YouTube Upload Manager',
    privacyStatus: 'private',
    license: 'youtube',
    embeddable: true,
    publicStatsViewable: true,
    madeForKids: false,
    containsSyntheticMedia: false,
    paidProductPlacement: false,
    tags: ['staged'],
    categoryId: '22',
    subDetails: {},
    thumbnailUrl: Option.none(),
    scheduledStartTime: mode === 'schedule' ? Option.some(new Date(Date.now() + 86400000 * scheduleOffsetDays).toISOString()) : Option.none(),
    publishAt: Option.none(),
    recordingDate: Option.none(),
    language: Option.some('en'),
    localizations: Option.none(),
  });

  const handleFiles = (files: FileList) => {
    const startIndex = tasks.length;
    const newTasks: BatchTask[] = Array.from(files).map((file, i) => ({
      id: crypto.randomUUID(),
      metadata: createDefaultMetadata(file.name, startIndex + i + 1),
      file,
      status: 'idle',
    }));
    setTasks(prev => [...prev, ...newTasks]);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => setIsDragging(false);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
  };

  const removeTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const handleRunBatch = async (taskIds?: string[]) => {
    setIsProcessing(true);
    const targetTasks = tasks.filter(t => taskIds ? taskIds.includes(t.id) : (t.status === 'idle' || t.status === 'error'));
    
    setTasks(prev => prev.map(t => targetTasks.find(tt => tt.id === t.id) ? { ...t, status: 'processing', error: undefined } : t));

    const AppLayer = Layer.mergeAll(YouTubeServiceLive, LoggerServiceLive);

    for (const task of targetTasks) {
      const batch = {
        channelId: 'channel-default',
        videos: [task.metadata]
      };
      
      const program = processBatch(batch, [task.file], mode);

      try {
        const result = await Effect.runPromise(Effect.provide(program, AppLayer));
        const videoIdArray = Array.from(result as any) as string[];
        const videoId = videoIdArray[0];

        // Fetch details
        const detailsProgram = Effect.gen(function* (_) {
          const service = yield* _(YouTubeService);
          return yield* _(service.getVideoDetails(videoId));
        });
        const details = await Effect.runPromise(Effect.provide(detailsProgram, AppLayer));

        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'success', youtubeDetails: details } : t));
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
      <div className="p-4 md:p-8 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 transition-colors">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <RefreshCw className={isProcessing ? 'animate-spin text-blue-600' : 'text-slate-400 dark:text-slate-500'} size={24} />
              Batch Control Center
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Configure and monitor your multi-channel tasks</p>
          </div>
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-full md:w-auto">
            <button 
              disabled={isProcessing}
              onClick={() => setMode('upload')}
              className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all ${mode === 'upload' ? 'bg-white dark:bg-slate-700 shadow-md text-blue-600 dark:text-blue-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 disabled:opacity-50'}`}
            >
              Uploads
            </button>
            <button 
              disabled={isProcessing}
              onClick={() => setMode('schedule')}
              className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all ${mode === 'schedule' ? 'bg-white dark:bg-slate-700 shadow-md text-blue-600 dark:text-blue-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 disabled:opacity-50'}`}
            >
              Live Streams
            </button>
          </div>
        </div>

        <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700/50 rounded-xl flex items-start gap-3 text-yellow-800 dark:text-yellow-200 shadow-sm">
          <AlertTriangle className="shrink-0 mt-0.5 text-yellow-600 dark:text-yellow-400" size={20} />
          <div>
            <h4 className="font-bold mb-1 tracking-tight text-yellow-900 dark:text-yellow-100">DISCLAIMER: ORDER DOES MATTER!</h4>
            <p className="text-sm font-medium opacity-90">Files will be uploaded and scheduled in chronological time. The first file you stage is the most recent/next video/livestream upcoming. Additional files are automatically scheduled incrementally.</p>
          </div>
        </div>

        {/* Drag & Drop Area */}
        <div 
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`mb-8 border-2 border-dashed rounded-2xl p-8 transition-all cursor-pointer flex flex-col items-center justify-center text-center ${
            isDragging ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/50'
          }`}
        >
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={(e) => e.target.files && handleFiles(e.target.files)} 
            multiple 
            accept="video/*" 
            className="hidden" 
          />
          <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 mb-4">
            <Upload size={32} />
          </div>
          <h3 className="font-bold text-slate-900 dark:text-white mb-1">Click or drag videos to stage</h3>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Supported: MP4, MOV, AVI, etc.</p>
        </div>

        {tasks.length > 0 && (
          <div className="space-y-4">
            {/* Stats Bar */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {[
                { label: 'Total', value: stats.total, color: 'text-slate-600 dark:text-slate-300', bg: 'bg-slate-50 dark:bg-slate-800/50' },
                { label: 'Succeeded', value: stats.success, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20' },
                { label: 'Failed', value: stats.error, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20' },
                { label: 'Processing', value: stats.processing, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20' },
              ].map((s, i) => (
                <div key={i} className={`${s.bg} p-4 rounded-xl border border-black/5 dark:border-white/5`}>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1">{s.label}</p>
                  <p className={`text-xl md:text-2xl font-black ${s.color}`}>{s.value}</p>
                </div>
              ))}
            </div>

            {/* Task List */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm min-w-[600px]">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 font-bold uppercase text-[10px] tracking-widest border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-6 py-4 w-12">Status</th>
                      <th className="px-6 py-4">Title / Metadata</th>
                      <th className="px-6 py-4 w-32">File Size</th>
                      <th className="px-6 py-4 text-right w-24">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {tasks.map((task) => (
                      <tr key={task.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="px-6 py-4">
                          {task.status === 'idle' && <div className="w-2 h-2 bg-slate-300 dark:bg-slate-600 rounded-full"></div>}
                          {task.status === 'processing' && <Loader2 className="animate-spin text-blue-600 dark:text-blue-400" size={18} />}
                          {task.status === 'success' && <CheckCircle2 className="text-green-600 dark:text-green-400" size={18} />}
                          {task.status === 'error' && <XCircle className="text-red-600 dark:text-red-400" size={18} />}
                        </td>
                        <td className="px-6 py-4">
                          {!task.youtubeDetails ? (
                            <div className="flex items-center gap-3">
                              <FileVideo className="text-slate-300 dark:text-slate-600 shrink-0" size={20} />
                              <div>
                                <p className="font-bold text-slate-900 dark:text-white leading-tight">{task.metadata.title}</p>
                                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{task.metadata.privacyStatus} • {task.metadata.categoryId}</p>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-start gap-4 p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm transition-all hover:shadow-md">
                              <div className="w-32 h-20 bg-slate-200 dark:bg-slate-700 rounded-lg overflow-hidden shrink-0 relative">
                                {task.youtubeDetails.thumbnail_url ? (
                                  <img src={task.youtubeDetails.thumbnail_url} alt="Thumbnail" className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-slate-400">
                                    <FileVideo size={24} />
                                  </div>
                                )}
                                <div className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                                  {task.youtubeDetails.privacy_status.toUpperCase()}
                                </div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-slate-900 dark:text-white text-sm line-clamp-2 leading-tight mb-1">
                                  {task.youtubeDetails.title}
                                </h4>
                                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mb-2">
                                  {task.youtubeDetails.description || 'No description provided.'}
                                </p>
                                <a 
                                  href={task.youtubeDetails.url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                                >
                                  <ExternalLink size={12} />
                                  View on YouTube
                                </a>
                              </div>
                            </div>
                          )}
                          
                          {task.error && (
                            <div className="mt-2 flex items-start gap-2 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded border border-red-100 dark:border-red-900/30 text-[11px] font-medium">
                              <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                              <span>{task.error}</span>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-medium">
                          {(task.file.size / (1024 * 1024)).toFixed(1)} MB
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            {task.status === 'error' && (
                              <button 
                                disabled={isProcessing}
                                onClick={() => handleRunBatch([task.id])}
                                className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg transition-colors disabled:opacity-30"
                                title="Retry this item"
                              >
                                <RotateCcw size={16} />
                              </button>
                            )}
                            <button 
                              disabled={isProcessing}
                              onClick={() => removeTask(task.id)}
                              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg transition-colors disabled:opacity-30"
                              title="Remove from queue"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <button 
                disabled={isProcessing || tasks.every(t => t.status === 'success')}
                onClick={() => handleRunBatch()}
                className="flex-1 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold hover:bg-slate-800 dark:hover:bg-slate-100 disabled:opacity-50 shadow-xl shadow-slate-200 dark:shadow-none flex items-center justify-center gap-2 transition-all"
              >
                {isProcessing ? <Loader2 className="animate-spin" /> : <Play size={18} />}
                {stats.error > 0 ? 'Retry Failed & Run Idle' : `Start Batch (${tasks.length} videos)`}
              </button>
              
              {stats.error > 0 && (
                <button 
                  disabled={isProcessing}
                  onClick={retryFailed}
                  className="px-6 py-4 border-2 border-red-200 dark:border-red-900/30 text-red-600 dark:text-red-400 rounded-xl font-bold hover:bg-red-50 dark:hover:bg-red-900/20 transition-all flex items-center gap-2 justify-center"
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
