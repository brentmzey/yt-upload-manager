import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Effect, Layer } from 'effect';
import { YouTubeService, YouTubeServiceLive, processBatch } from '../lib/youtube/service';
import { LoggerServiceLive, logInfo } from '../lib/logger';
import { VideoMetadataSchema } from '../lib/channel/config';
import { PocketBaseService, PocketBaseServiceLive } from '../lib/pocketbase';
import { Option } from 'effect';
import { 
  RefreshCw, CheckCircle2, XCircle, Loader2, AlertTriangle, 
  Play, RotateCcw, Upload, FileVideo, Trash2, ExternalLink,
  GripVertical, ChevronUp, ChevronDown, Edit3, Save, X, Image as ImageIcon
} from 'lucide-react';
import type { YouTubeVideoDetails } from '../bindings/youtube_types';
import { v4 as uuidv4 } from 'uuid';

type BatchTask = {
  id: string; // Internal UUID
  pbId?: string; // PocketBase Record ID
  metadata: typeof VideoMetadataSchema.Type;
  file?: File; // Optional if reloaded from DB (though we won't have the blob)
  thumbnailFile?: File;
  status: 'idle' | 'processing' | 'success' | 'error' | 'queued';
  error?: string;
  youtubeDetails?: YouTubeVideoDetails;
};

export const BatchManager: React.FC = () => {
  const [mode, setMode] = useState<'upload' | 'schedule'>('upload');
  const [tasks, setTasks] = useState<BatchTask[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const AppLayer = useMemo(() => Layer.mergeAll(YouTubeServiceLive, LoggerServiceLive, PocketBaseServiceLive), []);

  // --- INITIALIZATION (Load from PocketBase) ---
  useEffect(() => {
    const init = Effect.gen(function* (_) {
      const pbService = yield* _(PocketBaseService);
      
      // For this demo, we use a fixed channel ID
      const channelId = 'channel-default';
      
      let currentBatch;
      try {
        currentBatch = yield* _(pbService.getPendingBatch(channelId));
      } catch (e) {
        currentBatch = yield* _(pbService.createBatch(channelId));
      }
      
      setBatchId(currentBatch.id);
      
      const stagedVideos = yield* _(pbService.getStagedVideos(currentBatch.id));
      const loadedTasks: BatchTask[] = stagedVideos.map(sv => ({
        id: uuidv4(),
        pbId: sv.id,
        status: sv.status,
        metadata: {
          title: sv.title,
          description: sv.description_brotli_b64, // In a real app we'd decompress, but for now we store raw or b64
          privacyStatus: sv.privacyStatus,
          license: sv.license || 'youtube',
          embeddable: sv.embeddable,
          publicStatsViewable: sv.publicStatsViewable,
          madeForKids: sv.madeForKids,
          containsSyntheticMedia: false,
          paidProductPlacement: false,
          tags: sv.tags || [],
          categoryId: sv.categoryId || '22',
          subDetails: {},
          thumbnailUrl: Option.none(),
          scheduledStartTime: sv.scheduledStartTime ? Option.some(sv.scheduledStartTime) : Option.none(),
          publishAt: Option.none(),
          recordingDate: Option.none(),
          language: Option.some('en'),
          localizations: Option.none(),
        },
      }));
      
      setTasks(loadedTasks);

      const service = yield* _(YouTubeService);
      const unlisten = yield* _(service.onJobCompleted((response) => {
        Effect.runSync(
          logInfo('Job completed from backend', { videoId: response.video_id }).pipe(
            Effect.provide(AppLayer)
          )
        );
      }));
      return unlisten;
    });

    const cleanupPromise = Effect.runPromise(Effect.provide(init, AppLayer));
    
    return () => {
      cleanupPromise.then(unlisten => unlisten?.());
    };
  }, [AppLayer]);

  // --- PERSISTENCE HELPERS ---
  const persistTask = async (task: BatchTask, index: number) => {
    if (!batchId) return;
    const program = Effect.gen(function* (_) {
      const pbService = yield* _(PocketBaseService);
      const record = {
        id: task.pbId,
        batch_id: batchId,
        status: task.status,
        title: task.metadata.title,
        description_brotli_b64: task.metadata.description,
        privacyStatus: task.metadata.privacyStatus,
        license: task.metadata.license,
        embeddable: task.metadata.embeddable,
        publicStatsViewable: task.metadata.publicStatsViewable,
        madeForKids: task.metadata.madeForKids,
        tags: task.metadata.tags,
        categoryId: task.metadata.categoryId,
        scheduledStartTime: Option.getOrNull(task.metadata.scheduledStartTime),
        sort_order: index,
      };
      const saved = yield* _(pbService.saveStagedVideo(record));
      return saved.id;
    });
    
    const pbId = await Effect.runPromise(Effect.provide(program, AppLayer));
    if (!task.pbId) {
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, pbId } : t));
    }
  };

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
    const newTasks: BatchTask[] = Array.from(files).map((file, i) => {
      const task: BatchTask = {
        id: uuidv4(),
        metadata: createDefaultMetadata(file.name, startIndex + i + 1),
        file,
        status: 'idle',
      };
      persistTask(task, startIndex + i);
      return task;
    });
    setTasks(prev => [...prev, ...newTasks]);
  };

  const removeTask = (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (task?.pbId) {
      const program = PocketBaseService.pipe(
        Effect.flatMap(pb => pb.deleteStagedVideo(task.pbId!))
      );
      Effect.runSync(Effect.provide(program, AppLayer));
    }
    setTasks(prev => prev.filter(t => t.id !== id));
    if (editingId === id) setEditingId(null);
  };

  // --- REORDERING LOGIC ---

  const moveTask = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= tasks.length) return;
    const newTasks = [...tasks];
    const [movedTask] = newTasks.splice(fromIndex, 1);
    newTasks.splice(toIndex, 0, movedTask);
    setTasks(newTasks);
    // Persist new orders
    newTasks.forEach((t, i) => persistTask(t, i));
  };

  const handleDragStart = (index: number) => {
    if (isProcessing) return;
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    moveTask(draggedIndex, index);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  // --- EDITING LOGIC ---

  const updateTaskMetadata = (id: string, updates: Partial<typeof VideoMetadataSchema.Type>) => {
    setTasks(prev => {
      const newTasks = prev.map(t => t.id === id ? { ...t, metadata: { ...t.metadata, ...updates } } : t);
      const index = newTasks.findIndex(t => t.id === id);
      persistTask(newTasks[index], index);
      return newTasks;
    });
  };

  const handleThumbnailChange = (id: string, file: File | undefined) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, thumbnailFile: file } : t));
  };

  const handleRunBatch = async (taskIds?: string[]) => {
    setIsProcessing(true);
    setEditingId(null); // Close any open editors
    const targetTasks = tasks.filter(t => taskIds ? taskIds.includes(t.id) : (t.status === 'idle' || t.status === 'error'));
    
    setTasks(prev => prev.map(t => targetTasks.find(tt => tt.id === t.id) ? { ...t, status: 'processing', error: undefined } : t));

    for (const task of targetTasks) {
      if (!task.file) {
        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'error', error: 'Video file missing (transient memory lost)' } : t));
        continue;
      }

      const batch = {
        channelId: 'channel-default',
        videos: [task.metadata]
      };
      
      const program = processBatch(batch, [task.file], [task.thumbnailFile], mode);

      try {
        const result = await Effect.runPromise(Effect.provide(program, AppLayer));
        const videoIdArray = Array.from(result as any) as string[];
        const videoId = videoIdArray[0];

        // Fetch details
        const detailsProgram = YouTubeService.pipe(
          Effect.flatMap(service => service.getVideoDetails(videoId))
        );
        const details = await Effect.runPromise(Effect.provide(detailsProgram, AppLayer));

        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'success', youtubeDetails: details } : t));
        
        // Update PB status
        persistTask({ ...task, status: 'success' }, tasks.findIndex(t => t.id === task.id));
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'error', error: msg } : t));
        persistTask({ ...task, status: 'error' }, tasks.findIndex(t => t.id === task.id));
      }
    }
    setIsProcessing(false);
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
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Stage, reorder, and edit your bulk uploads</p>
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

        {/* Drag & Drop Area */}
        <div 
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files) handleFiles(e.dataTransfer.files); }}
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
          <p className="text-slate-500 dark:text-slate-400 text-sm">Videos will be uploaded in the order shown below.</p>
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
                <table className="w-full text-left text-sm min-w-[800px]">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 font-bold uppercase text-[10px] tracking-widest border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-4 py-4 w-10"></th>
                      <th className="px-4 py-4 w-12 text-center">#</th>
                      <th className="px-6 py-4 w-12">Status</th>
                      <th className="px-6 py-4">Title / Metadata</th>
                      <th className="px-6 py-4 w-32">File Size</th>
                      <th className="px-6 py-4 text-right w-40">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {tasks.map((task, index) => (
                      <React.Fragment key={task.id}>
                        <tr 
                          draggable={!isProcessing && editingId !== task.id}
                          onDragStart={() => handleDragStart(index)}
                          onDragOver={(e) => handleDragOver(e, index)}
                          onDragEnd={handleDragEnd}
                          className={`group transition-all ${draggedIndex === index ? 'opacity-30 bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/50'} ${editingId === task.id ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''}`}
                        >
                          <td className="px-4 py-4 cursor-grab active:cursor-grabbing text-slate-300 dark:text-slate-600 hover:text-slate-500">
                            <GripVertical size={18} />
                          </td>
                          <td className="px-4 py-4 text-center font-bold text-slate-400 dark:text-slate-600">
                            {index + 1}
                          </td>
                          <td className="px-6 py-4">
                            {task.status === 'idle' && <div className="w-2 h-2 bg-slate-300 dark:bg-slate-600 rounded-full mx-auto"></div>}
                            {task.status === 'processing' && <Loader2 className="animate-spin text-blue-600 dark:text-blue-400 mx-auto" size={18} />}
                            {task.status === 'success' && <CheckCircle2 className="text-green-600 dark:text-green-400 mx-auto" size={18} />}
                            {task.status === 'error' && <XCircle className="text-red-600 dark:text-red-400 mx-auto" size={18} />}
                          </td>
                          <td className="px-6 py-4">
                            {!task.youtubeDetails ? (
                              <div className="flex items-center gap-3">
                                {task.thumbnailFile ? (
                                  <div className="w-16 h-10 bg-slate-200 dark:bg-slate-700 rounded overflow-hidden shrink-0">
                                    <img src={URL.createObjectURL(task.thumbnailFile)} alt="Preview" className="w-full h-full object-cover" />
                                  </div>
                                ) : (
                                  <FileVideo className="text-slate-300 dark:text-slate-600 shrink-0" size={20} />
                                )}
                                <div>
                                  <p className="font-bold text-slate-900 dark:text-white leading-tight">{task.metadata.title}</p>
                                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                                    {task.metadata.privacyStatus.toUpperCase()} • {Option.getOrNull(task.metadata.scheduledStartTime) ? new Date(Option.getOrNull(task.metadata.scheduledStartTime)!).toLocaleString() : 'Immediate'}
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-start gap-4 p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm transition-all">
                                <div className="w-24 h-14 bg-slate-200 dark:bg-slate-700 rounded overflow-hidden shrink-0 relative">
                                  {task.youtubeDetails.thumbnail_url ? (
                                    <img src={task.youtubeDetails.thumbnail_url} alt="Thumbnail" className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-slate-400">
                                      <FileVideo size={20} />
                                    </div>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-bold text-slate-900 dark:text-white text-xs line-clamp-1 mb-1">
                                    {task.youtubeDetails.title}
                                  </h4>
                                  <a 
                                    href={task.youtubeDetails.url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline"
                                  >
                                    <ExternalLink size={10} />
                                    View on YouTube
                                  </a>
                                </div>
                              </div>
                            )}
                            
                            {task.error && (
                              <div className="mt-2 flex items-start gap-2 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded border border-red-100 dark:border-red-900/30 text-[10px] font-medium">
                                <AlertTriangle size={10} className="shrink-0 mt-0.5" />
                                <span>{task.error}</span>
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap">
                            {(task.file.size / (1024 * 1024)).toFixed(1)} MB
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end items-center gap-1">
                              {!isProcessing && task.status === 'idle' && (
                                <>
                                  <button onClick={() => moveTask(index, index - 1)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 rounded-lg" title="Move Up"><ChevronUp size={16} /></button>
                                  <button onClick={() => moveTask(index, index + 1)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 rounded-lg" title="Move Down"><ChevronDown size={16} /></button>
                                  <button 
                                    onClick={() => setEditingId(editingId === task.id ? null : task.id)}
                                    className={`p-1.5 rounded-lg transition-colors ${editingId === task.id ? 'bg-blue-600 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400'}`}
                                    title="Edit Metadata"
                                  >
                                    {editingId === task.id ? <X size={16} /> : <Edit3 size={16} />}
                                  </button>
                                </>
                              )}
                              {task.status === 'error' && !isProcessing && (
                                <button onClick={() => handleRunBatch([task.id])} className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 rounded-lg" title="Retry"><RotateCcw size={16} /></button>
                              )}
                              <button 
                                disabled={isProcessing}
                                onClick={() => removeTask(task.id)}
                                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-red-600 rounded-lg transition-colors disabled:opacity-30"
                                title="Remove"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                        {/* Inline Editor */}
                        {editingId === task.id && (
                          <tr>
                            <td colSpan={6} className="px-8 py-6 bg-blue-50/50 dark:bg-blue-900/5 border-x-2 border-blue-500/20">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                  <div>
                                    <label htmlFor={`title-${task.id}`} className="block text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1">Video Title</label>
                                    <input 
                                      id={`title-${task.id}`}
                                      type="text" 
                                      value={task.metadata.title}
                                      onChange={(e) => updateTaskMetadata(task.id, { title: e.target.value })}
                                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    />
                                  </div>
                                  <div>
                                    <label htmlFor={`desc-${task.id}`} className="block text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1">Description</label>
                                    <textarea 
                                      id={`desc-${task.id}`}
                                      value={task.metadata.description}
                                      onChange={(e) => updateTaskMetadata(task.id, { description: e.target.value })}
                                      rows={3}
                                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none"
                                    />
                                  </div>
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <label htmlFor={`privacy-${task.id}`} className="block text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1">Privacy</label>
                                      <select 
                                        id={`privacy-${task.id}`}
                                        value={task.metadata.privacyStatus}
                                        onChange={(e) => updateTaskMetadata(task.id, { privacyStatus: e.target.value as any })}
                                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm outline-none"
                                      >
                                        <option value="private">Private</option>
                                        <option value="unlisted">Unlisted</option>
                                        <option value="public">Public</option>
                                      </select>
                                    </div>
                                    <div>
                                      <label htmlFor={`schedule-${task.id}`} className="block text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1">Schedule Date/Time</label>
                                      <input 
                                        id={`schedule-${task.id}`}
                                        type="datetime-local" 
                                        value={Option.getOrNull(task.metadata.scheduledStartTime)?.slice(0, 16) || ''}
                                        onChange={(e) => updateTaskMetadata(task.id, { scheduledStartTime: e.target.value ? Option.some(new Date(e.target.value).toISOString()) : Option.none() })}
                                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm outline-none"
                                      />
                                    </div>
                                  </div>
                                </div>
                                <div className="space-y-4">
                                  <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1">Thumbnail Override</label>
                                    <div className="flex items-start gap-4">
                                      <div className="w-40 aspect-video bg-slate-100 dark:bg-slate-800 rounded-lg border-2 border-dashed border-slate-200 dark:border-slate-700 overflow-hidden flex items-center justify-center relative group">
                                        {task.thumbnailFile ? (
                                          <img src={URL.createObjectURL(task.thumbnailFile)} alt="Thumb" className="w-full h-full object-cover" />
                                        ) : (
                                          <ImageIcon className="text-slate-300 dark:text-slate-600" size={32} />
                                        )}
                                        <label className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer text-white font-bold text-[10px] uppercase tracking-widest">
                                          Change
                                          <input 
                                            type="file" 
                                            accept="image/*" 
                                            className="hidden" 
                                            onChange={(e) => e.target.files && handleThumbnailChange(task.id, e.target.files[0])} 
                                          />
                                        </label>
                                      </div>
                                      <div className="flex-1">
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">Upload a custom thumbnail for this video. Recommended: 1280x720, &lt;2MB.</p>
                                        {task.thumbnailFile && (
                                          <button 
                                            onClick={() => handleThumbnailChange(task.id, undefined)}
                                            className="text-red-600 dark:text-red-400 text-[10px] font-bold uppercase tracking-widest hover:underline"
                                          >
                                            Remove Thumbnail
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="pt-4 flex justify-end gap-3">
                                    <button 
                                      onClick={() => setEditingId(null)}
                                      className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                                    >
                                      Done Editing
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <button 
                disabled={isProcessing || tasks.length === 0 || tasks.every(t => t.status === 'success')}
                onClick={() => handleRunBatch()}
                className="flex-1 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold hover:bg-slate-800 dark:hover:bg-slate-100 disabled:opacity-50 shadow-xl shadow-slate-200 dark:shadow-none flex items-center justify-center gap-2 transition-all"
              >
                {isProcessing ? <Loader2 className="animate-spin" /> : <Play size={18} />}
                {stats.error > 0 ? 'Retry Failed & Run Idle' : `Start Batch (${tasks.length} videos)`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
