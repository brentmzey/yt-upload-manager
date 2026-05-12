import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Effect, Layer } from 'effect';
import { YouTubeService, YouTubeServiceLive, processBatch } from '../lib/youtube/service';
import { LoggerService, LoggerServiceLive, logInfo, logError } from '../lib/logger';
import { VideoMetadataSchema } from '../lib/channel/config';
import { PocketBaseService, PocketBaseServiceLive } from '../lib/pocketbase';
import { Option } from 'effect';
import { 
  RefreshCw, CheckCircle2, XCircle, Loader2, AlertTriangle, 
  Play, RotateCcw, Upload, FileVideo, Trash2, ExternalLink,
  GripVertical, ChevronUp, ChevronDown, Edit3, Save, X, Image as ImageIcon
} from 'lucide-react';
import { decompressFromBrotliB64, compressToBrotliB64 } from '../lib/compression';
import type { YouTubeVideoDetails } from '../bindings/youtube_types';
import { v4 as uuidv4 } from 'uuid';
import { useTenant } from '../lib/tenant_context';

type BatchTask = {
  id: string; // Internal UUID
  pbId?: string; // PocketBase Record ID
  metadata: typeof VideoMetadataSchema.Type;
  file?: File; // Optional if reloaded from DB (though we won't have the blob)
  thumbnailFile?: File;
  status: 'idle' | 'processing' | 'success' | 'error' | 'queued';
  error?: string;
  youtubeDetails?: YouTubeVideoDetails;
  created?: string;
  finishedAt?: string;
};

export const BatchManager: React.FC = () => {
  const [mode, setMode] = useState<'upload' | 'schedule'>('schedule');
  const [channels, setChannels] = useState<any[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<string>('');
  const [tasks, setTasks] = useState<BatchTask[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { appLayer } = useTenant();

  // --- FETCH CHANNELS ---
  useEffect(() => {
    if (!appLayer) return;
    const fetchChannels = Effect.gen(function* (_) {
      const pbService = yield* _(PocketBaseService);
      const list = yield* _(pbService.getChannels());
      const activeChannels = list.filter(c => c.status === 'active');
      setChannels(activeChannels);
      if (activeChannels.length > 0 && !selectedChannelId) {
        setSelectedChannelId(activeChannels[0].id);
      }
    });
    Effect.runPromise(Effect.provide(fetchChannels, appLayer));
  }, [appLayer]);

  // --- INITIALIZATION (Load from PocketBase) ---
  useEffect(() => {
    if (!selectedChannelId || !appLayer) return;
    
    const init = Effect.gen(function* (_) {
      const pbService = yield* _(PocketBaseService);
      
      let currentBatch;
      try {
        currentBatch = yield* _(pbService.getPendingBatch(selectedChannelId));
      } catch (e) {
        currentBatch = yield* _(pbService.createBatch(selectedChannelId));
      }
      
      setBatchId(currentBatch.id);
      
      const stagedVideos = yield* _(pbService.getStagedVideos(currentBatch.id));
      const loadedTasks: BatchTask[] = [];

      for (const sv of stagedVideos) {
        let description = sv.description_brotli_b64 || '';
        if (description) {
          try {
            description = yield* _(decompressFromBrotliB64(description));
          } catch (e) {
            const logger = yield* _(LoggerService);
            yield* _(logger.error(`Failed to decompress description for ${sv.title}`, {}, e));
          }
        }

        loadedTasks.push({
          id: uuidv4(),
          pbId: sv.id,
          status: sv.status,
          created: sv.created,
          finishedAt: sv.finished_at,
          error: sv.error_message,
          metadata: {
            job_type: (sv as any).job_type || (sv.scheduledStartTime ? 'LiveBroadcast' : 'VideoUpload'),
            title: sv.title,
            description,
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
            scheduledEndTime: sv.scheduledEndTime ? Option.some(sv.scheduledEndTime) : Option.none(),
            publishAt: Option.none(),
            recordingDate: Option.none(),
            language: sv.language ? Option.some(sv.language) : Option.some('en'),
            defaultLanguage: sv.defaultLanguage ? Option.some(sv.defaultLanguage) : Option.none(),
            defaultAudioLanguage: sv.defaultAudioLanguage ? Option.some(sv.defaultAudioLanguage) : Option.none(),
            latencyPreference: sv.latencyPreference ? Option.some(sv.latencyPreference) : Option.some('normal'),
            enableAutoStart: sv.enableAutoStart ? Option.some(sv.enableAutoStart) : Option.some(false),
            enableAutoStop: sv.enableAutoStop ? Option.some(sv.enableAutoStop) : Option.some(false),
            enableDvr: sv.enableDvr ? Option.some(sv.enableDvr) : Option.some(true),
            enableContentEncryption: sv.enableContentEncryption ? Option.some(sv.enableContentEncryption) : Option.some(false),
            startWithLowLatency: sv.startWithLowLatency ? Option.some(sv.startWithLowLatency) : Option.some(false),
            recordFromStart: sv.recordFromStart ? Option.some(sv.recordFromStart) : Option.some(true),
            enableMonitorStream: sv.enableMonitorStream ? Option.some(sv.enableMonitorStream) : Option.some(true),
            broadcastStreamDelayMs: sv.broadcastStreamDelayMs ? Option.some(sv.broadcastStreamDelayMs) : Option.some(0),
            projection: sv.projection ? Option.some(sv.projection) : Option.some('rectangular'),
            localizations: Option.none(),
          },
        });
      }
      
      setTasks(loadedTasks);

      const service = yield* _(YouTubeService);
      const unlisten = yield* _(service.onJobCompleted((response) => {
        Effect.runSync(
          logInfo('Job completed from backend', { videoId: response.video_id }).pipe(
            Effect.provide(appLayer)
          )
        );
      }));
      return unlisten;
    });

    const cleanupPromise = Effect.runPromise(Effect.provide(init, appLayer));
    
    return () => {
      cleanupPromise.then(unlisten => unlisten?.());
    };
  }, [appLayer, selectedChannelId]);

  // --- PERSISTENCE HELPERS ---
  const persistTask = async (task: BatchTask, index: number) => {
    if (!batchId) return;
    const program = Effect.gen(function* (_) {
      const pbService = yield* _(PocketBaseService);
      const logger = yield* _(LoggerService);

      let compressedDesc = task.metadata.description;
      try {
        compressedDesc = yield* _(compressToBrotliB64(compressedDesc));
      } catch (e) {
        yield* _(logger.error("Compression failed in persistTask", {}, e));
      }

      const record = {
        id: task.pbId,
        batch_id: batchId,
        status: task.status,
        job_type: task.metadata.job_type,
        title: task.metadata.title,
        description_brotli_b64: compressedDesc,
        privacyStatus: task.metadata.privacyStatus,
        license: task.metadata.license,
        embeddable: task.metadata.embeddable,
        publicStatsViewable: task.metadata.publicStatsViewable,
        madeForKids: task.metadata.madeForKids,
        tags: task.metadata.tags,
        categoryId: task.metadata.categoryId,
        scheduledStartTime: Option.getOrNull(task.metadata.scheduledStartTime),
        scheduledEndTime: Option.getOrNull(task.metadata.scheduledEndTime),
        publishAt: Option.getOrNull(task.metadata.publishAt),
        recordingDate: Option.getOrNull(task.metadata.recordingDate),
        language: Option.getOrNull(task.metadata.language),
        defaultLanguage: Option.getOrNull(task.metadata.defaultLanguage),
        defaultAudioLanguage: Option.getOrNull(task.metadata.defaultAudioLanguage),
        latencyPreference: Option.getOrNull(task.metadata.latencyPreference),
        enableAutoStart: Option.getOrNull(task.metadata.enableAutoStart),
        enableAutoStop: Option.getOrNull(task.metadata.enableAutoStop),
        enableDvr: Option.getOrNull(task.metadata.enableDvr),
        enableContentEncryption: Option.getOrNull(task.metadata.enableContentEncryption),
        startWithLowLatency: Option.getOrNull(task.metadata.startWithLowLatency),
        recordFromStart: Option.getOrNull(task.metadata.recordFromStart),
        enableMonitorStream: Option.getOrNull(task.metadata.enableMonitorStream),
        broadcastStreamDelayMs: Option.getOrNull(task.metadata.broadcastStreamDelayMs),
        projection: Option.getOrNull(task.metadata.projection),
        sort_order: index,
        error_message: task.error,
        finished_at: task.finishedAt,
      };
      const saved = yield* _(pbService.saveStagedVideo(record));
      return saved.id;
    });
    
    const pbId = await Effect.runPromise(Effect.provide(program, appLayer));
    if (!task.pbId) {
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, pbId } : t));
    }
  };

  const createDefaultMetadata = (title: string, scheduleOffsetDays: number): typeof VideoMetadataSchema.Type => ({
    job_type: mode === 'schedule' ? 'LiveBroadcast' : 'VideoUpload',
    title,
    description: 'Bulk staged via YouTube Manager',
    privacyStatus: 'private',
    license: 'youtube',
    embeddable: true,
    publicStatsViewable: true,
    madeForKids: false,
    containsSyntheticMedia: false,
    paidProductPlacement: false,
    tags: ['bulk-staged'],
    categoryId: '22',
    subDetails: {},
    thumbnailUrl: Option.none(),
    scheduledStartTime: mode === 'schedule' ? Option.some(new Date(Date.now() + 86400000 * scheduleOffsetDays).toISOString()) : Option.none(),
    scheduledEndTime: Option.none(),
    publishAt: Option.none(),
    recordingDate: Option.none(),
    language: Option.some('en'),
    defaultLanguage: Option.none(),
    defaultAudioLanguage: Option.none(),
    latencyPreference: Option.some('normal'),
    enableAutoStart: Option.some(false),
    enableAutoStop: Option.some(false),
    enableDvr: Option.some(true),
    enableContentEncryption: Option.some(false),
    startWithLowLatency: Option.some(false),
    recordFromStart: Option.some(true),
    enableMonitorStream: Option.some(true),
    broadcastStreamDelayMs: Option.some(0),
    projection: Option.some('rectangular'),
    localizations: Option.none(),
  });

  const handleAddStreamPlaceholders = () => {
    const count = parseInt(prompt("How many stream placeholders do you want to create?", "1") || "0", 10);
    if (isNaN(count) || count <= 0) return;

    const baseTitle = prompt("Base title for these streams?", "Live Broadcast") || "Live Broadcast";
    const intervalMinutes = parseInt(prompt("Interval between streams (minutes)?", "60") || "60", 10);

    const startIndex = tasks.length;
    const baseDate = new Date();
    baseDate.setMinutes(baseDate.getMinutes() + 30); // Start 30 mins from now

    const newTasks: BatchTask[] = Array.from({ length: count }).map((_, i) => {
      const scheduledStartTime = new Date(baseDate.getTime() + (i * intervalMinutes * 60000)).toISOString();
      const task: BatchTask = {
        id: uuidv4(),
        metadata: {
          ...createDefaultMetadata(`${baseTitle} #${startIndex + i + 1}`, 0),
          scheduledStartTime: Option.some(scheduledStartTime),
        },
        status: 'idle',
      };
      persistTask(task, startIndex + i);
      return task;
    });
    setTasks(prev => [...prev, ...newTasks]);
  };

  const handleFiles = (files: FileList) => {
    const startIndex = tasks.length;
    const newTasks: BatchTask[] = Array.from(files).map((file, i) => {
      const task: BatchTask = {
        id: uuidv4(),
        metadata: createDefaultMetadata(file.name.split('.')[0], startIndex + i + 1),
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
    if (!selectedChannelId || !appLayer) {
      alert("Please select an active channel first.");
      return;
    }

    setIsProcessing(true);
    setEditingId(null); // Close any open editors
    
    // 1. Identify tasks to process
    let targetTasks = tasks.filter(t => taskIds ? taskIds.includes(t.id) : (t.status === 'idle' || t.status === 'error'));
    
    // 2. Sort if in schedule mode (Order matters for stream setup)
    if (mode === 'schedule') {
      targetTasks = [...targetTasks].sort((a, b) => {
        const timeA = Option.getOrNull(a.metadata.scheduledStartTime);
        const timeB = Option.getOrNull(b.metadata.scheduledStartTime);
        if (!timeA) return 1;
        if (!timeB) return -1;
        return new Date(timeA).getTime() - new Date(timeB).getTime();
      });
    }

    setTasks(prev => prev.map(t => targetTasks.find(tt => tt.id === t.id) ? { ...t, status: 'processing', error: undefined } : t));

    for (const task of targetTasks) {
      if (!task.file && mode === 'upload') {
        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'error', error: 'Video file missing (transient memory lost)' } : t));
        continue;
      }

      const batch = {
        channelId: selectedChannelId,
        videos: [task.metadata]
      };
      
      const program = processBatch(batch, task.file ? [task.file] : [], [task.thumbnailFile], mode);

      try {
        const result = await Effect.runPromise(Effect.provide(program, appLayer));
        const videoIdArray = Array.from(result as any) as string[];
        const videoId = videoIdArray[0];

        // Fetch details
        const detailsProgram = YouTubeService.pipe(
          Effect.flatMap(service => service.getVideoDetails(videoId))
        );
        const details = await Effect.runPromise(Effect.provide(detailsProgram, appLayer));

        const finishedAt = new Date().toISOString();
        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'success', youtubeDetails: details, finishedAt } : t));
        
        // Update PB status
        persistTask({ ...task, status: 'success', finishedAt }, tasks.findIndex(t => t.id === task.id));
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'error', error: msg } : t));
        persistTask({ ...task, status: 'error', error: msg }, tasks.findIndex(t => t.id === task.id));
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
            <div className="flex items-center gap-4 mt-2">
              <p className="text-slate-500 dark:text-slate-400 text-sm">Target Channel:</p>
              <select 
                value={selectedChannelId} 
                onChange={(e) => setSelectedChannelId(e.target.value)}
                disabled={isProcessing}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-blue-500"
              >
                {channels.length === 0 && <option value="">No Active Channels</option>}
                {channels.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.handle})</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl w-full md:w-auto shadow-inner">
            <button 
              disabled={isProcessing}
              onClick={() => setMode('upload')}
              className={`flex-1 md:flex-none px-8 py-2.5 rounded-xl text-sm font-black tracking-tight transition-all duration-300 ${mode === 'upload' ? 'bg-white dark:bg-slate-700 shadow-xl text-blue-600 dark:text-blue-400 scale-[1.02]' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 disabled:opacity-50'}`}
            >
              General Uploads
            </button>
            <button 
              disabled={isProcessing}
              onClick={() => setMode('schedule')}
              className={`flex-1 md:flex-none px-8 py-2.5 rounded-xl text-sm font-black tracking-tight transition-all duration-300 ${mode === 'schedule' ? 'bg-white dark:bg-slate-700 shadow-xl text-indigo-600 dark:text-indigo-400 scale-[1.02]' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 disabled:opacity-50'}`}
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
          {mode === 'schedule' && (
            <button 
              onClick={(e) => { e.stopPropagation(); handleAddStreamPlaceholders(); }}
              className="mt-6 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-bold text-sm transition-all"
            >
              Or Bulk Create Stream Placeholders
            </button>
          )}
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
                                    {task.created && ` • Staged ${new Date(task.created).toLocaleDateString()}`}
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
                            {task.file ? `${(task.file.size / (1024 * 1024)).toFixed(1)} MB` : '--'}
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
                            <td colSpan={6} className="px-8 py-8 bg-slate-50/50 dark:bg-slate-900/50 border-x-2 border-indigo-500/20">
                              <div className="max-w-5xl mx-auto space-y-10">
                                {/* SECTION 1: Snippet & Identity */}
                                <div>
                                  <div className="flex items-center gap-3 mb-6">
                                    <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                      <Edit3 size={16} />
                                    </div>
                                    <h4 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">Content Snippet</h4>
                                  </div>
                                  
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-6">
                                      <div>
                                        <label htmlFor={`title-${task.id}`} className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Video Title</label>
                                        <input 
                                          id={`title-${task.id}`}
                                          type="text" 
                                          value={task.metadata.title}
                                          onChange={(e) => updateTaskMetadata(task.id, { title: e.target.value })}
                                          className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm"
                                        />
                                      </div>
                                      <div>
                                        <label htmlFor={`desc-${task.id}`} className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Description</label>
                                        <textarea 
                                          id={`desc-${task.id}`}
                                          value={task.metadata.description}
                                          onChange={(e) => updateTaskMetadata(task.id, { description: e.target.value })}
                                          rows={5}
                                          className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none shadow-sm"
                                        />
                                      </div>
                                    </div>

                                    <div className="space-y-6">
                                      <div className="grid grid-cols-2 gap-4">
                                        <div>
                                          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Privacy Status</label>
                                          <select 
                                            value={task.metadata.privacyStatus}
                                            onChange={(e) => updateTaskMetadata(task.id, { privacyStatus: e.target.value as any })}
                                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm outline-none shadow-sm"
                                          >
                                            <option value="private">Private</option>
                                            <option value="unlisted">Unlisted</option>
                                            <option value="public">Public</option>
                                          </select>
                                        </div>
                                        <div>
                                          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Category ID</label>
                                          <input 
                                            type="text" 
                                            value={task.metadata.categoryId}
                                            onChange={(e) => updateTaskMetadata(task.id, { categoryId: e.target.value })}
                                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm outline-none shadow-sm"
                                            placeholder="22 (Blogs)"
                                          />
                                        </div>
                                      </div>
                                      <div className="grid grid-cols-2 gap-4">
                                        <div>
                                          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Schedule Start</label>
                                          <input 
                                            type="datetime-local" 
                                            value={Option.getOrNull(task.metadata.scheduledStartTime)?.slice(0, 16) || ''}
                                            onChange={(e) => updateTaskMetadata(task.id, { scheduledStartTime: e.target.value ? Option.some(new Date(e.target.value).toISOString()) : Option.none() })}
                                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm outline-none shadow-sm"
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Schedule End</label>
                                          <input 
                                            type="datetime-local" 
                                            value={Option.getOrNull(task.metadata.scheduledEndTime)?.slice(0, 16) || ''}
                                            onChange={(e) => updateTaskMetadata(task.id, { scheduledEndTime: e.target.value ? Option.some(new Date(e.target.value).toISOString()) : Option.none() })}
                                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm outline-none shadow-sm"
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* SECTION 2: Media & Metadata */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                                  <div>
                                    <div className="flex items-center gap-3 mb-6">
                                      <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                                        <ImageIcon size={16} />
                                      </div>
                                      <h4 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">Media Assets</h4>
                                    </div>
                                    <div className="flex items-start gap-6">
                                      <div className="w-48 aspect-video bg-white dark:bg-slate-800 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 overflow-hidden flex items-center justify-center relative group shadow-sm">
                                        {task.thumbnailFile ? (
                                          <img src={URL.createObjectURL(task.thumbnailFile)} alt="Thumb" className="w-full h-full object-cover" />
                                        ) : (
                                          <div className="flex flex-col items-center gap-2">
                                            <ImageIcon className="text-slate-300" size={32} />
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">No Thumbnail</span>
                                          </div>
                                        )}
                                        <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer text-white font-black text-[10px] uppercase tracking-widest">
                                          Update Asset
                                          <input 
                                            type="file" 
                                            accept="image/*" 
                                            className="hidden" 
                                            onChange={(e) => e.target.files && handleThumbnailChange(task.id, e.target.files[0])} 
                                          />
                                        </label>
                                      </div>
                                      <div className="flex-1 space-y-4">
                                        <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">Custom thumbnails improve click-through by 40%. Recommended: 1280x720 (16:9), &lt;2MB.</p>
                                        <div className="flex flex-wrap gap-2">
                                          <button className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400 hover:bg-slate-200 transition-all">Clear</button>
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  <div>
                                    <div className="flex items-center gap-3 mb-6">
                                      <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                                        <RefreshCw size={16} />
                                      </div>
                                      <h4 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">Localization & Lang</h4>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                      <div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Default Language</label>
                                        <select 
                                          value={Option.getOrNull(task.metadata.language) || 'en'}
                                          onChange={(e) => updateTaskMetadata(task.id, { language: Option.some(e.target.value) })}
                                          className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm outline-none shadow-sm"
                                        >
                                          <option value="en">English (US)</option>
                                          <option value="es">Spanish</option>
                                          <option value="fr">French</option>
                                          <option value="de">German</option>
                                          <option value="ja">Japanese</option>
                                        </select>
                                      </div>
                                      <div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Audio Language</label>
                                        <select 
                                          value={Option.getOrNull(task.metadata.defaultAudioLanguage) || 'en'}
                                          onChange={(e) => updateTaskMetadata(task.id, { defaultAudioLanguage: Option.some(e.target.value) })}
                                          className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm outline-none shadow-sm"
                                        >
                                          <option value="en">English (US)</option>
                                          <option value="es">Spanish</option>
                                        </select>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* SECTION 3: Stream/Broadcast Infrastructure */}
                                {mode === 'schedule' && (
                                  <div>
                                    <div className="flex items-center gap-3 mb-6">
                                      <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600 dark:text-orange-400">
                                        <Play size={16} />
                                      </div>
                                      <h4 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">Broadcast Infrastructure</h4>
                                    </div>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                                      <div className="col-span-2 space-y-6">
                                        <div className="grid grid-cols-2 gap-4">
                                          <div>
                                            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Latency Preference</label>
                                            <select 
                                              value={Option.getOrNull(task.metadata.latencyPreference) || 'normal'}
                                              onChange={(e) => updateTaskMetadata(task.id, { latencyPreference: Option.some(e.target.value as any) })}
                                              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm outline-none shadow-sm"
                                            >
                                              <option value="normal">Normal (Best Quality)</option>
                                              <option value="low">Low Latency</option>
                                              <option value="ultraLow">Ultra Low (Real-time)</option>
                                            </select>
                                          </div>
                                          <div>
                                            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Projection</label>
                                            <select 
                                              value={Option.getOrNull(task.metadata.projection) || 'rectangular'}
                                              onChange={(e) => updateTaskMetadata(task.id, { projection: Option.some(e.target.value as any) })}
                                              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm outline-none shadow-sm"
                                            >
                                              <option value="rectangular">Rectangular (Std)</option>
                                              <option value="360">360° Spherical</option>
                                            </select>
                                          </div>
                                        </div>
                                        <div>
                                          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Monitor Stream Delay (ms)</label>
                                          <input 
                                            type="number" 
                                            value={Option.getOrElse(task.metadata.broadcastStreamDelayMs, () => 0)}
                                            onChange={(e) => updateTaskMetadata(task.id, { broadcastStreamDelayMs: Option.some(parseInt(e.target.value, 10)) })}
                                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm outline-none shadow-sm"
                                          />
                                        </div>
                                      </div>

                                      <div className="space-y-2">
                                        {[
                                          { key: 'enableDvr', label: 'Enable DVR', desc: 'Rewind live' },
                                          { key: 'enableAutoStart', label: 'Auto-Start', desc: 'Immediate live' },
                                          { key: 'enableAutoStop', label: 'Auto-Stop', desc: 'Sync end' },
                                        ].map(opt => (
                                          <label key={opt.key} className="flex items-center gap-3 p-3 rounded-xl hover:bg-white dark:hover:bg-slate-800 transition-all cursor-pointer group border border-transparent hover:border-slate-100 dark:hover:border-slate-700">
                                            <input 
                                              type="checkbox" 
                                              className="w-5 h-5 rounded-lg border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                              checked={Option.getOrElse((task.metadata as any)[opt.key], () => false)} 
                                              onChange={(e) => updateTaskMetadata(task.id, { [opt.key]: Option.some(e.target.checked) })}
                                            />
                                            <div className="flex flex-col">
                                              <span className="text-[11px] font-black uppercase tracking-tight text-slate-700 dark:text-slate-300 group-hover:text-indigo-600 transition-colors">{opt.label}</span>
                                              <span className="text-[9px] text-slate-400 dark:text-slate-500">{opt.desc}</span>
                                            </div>
                                          </label>
                                        ))}
                                      </div>

                                      <div className="space-y-2">
                                        {[
                                          { key: 'recordFromStart', label: 'Record', desc: 'Archive stream' },
                                          { key: 'enableMonitorStream', label: 'Monitor', desc: 'Private preview' },
                                          { key: 'enableContentEncryption', label: 'Encrypt', desc: 'Secure flow' },
                                        ].map(opt => (
                                          <label key={opt.key} className="flex items-center gap-3 p-3 rounded-xl hover:bg-white dark:hover:bg-slate-800 transition-all cursor-pointer group border border-transparent hover:border-slate-100 dark:hover:border-slate-700">
                                            <input 
                                              type="checkbox" 
                                              className="w-5 h-5 rounded-lg border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                              checked={Option.getOrElse((task.metadata as any)[opt.key], () => false)} 
                                              onChange={(e) => updateTaskMetadata(task.id, { [opt.key]: Option.some(e.target.checked) })}
                                            />
                                            <div className="flex flex-col">
                                              <span className="text-[11px] font-black uppercase tracking-tight text-slate-700 dark:text-slate-300 group-hover:text-indigo-600 transition-colors">{opt.label}</span>
                                              <span className="text-[9px] text-slate-400 dark:text-slate-500">{opt.desc}</span>
                                            </div>
                                          </label>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* ACTION FOOTER */}
                                <div className="pt-8 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
                                  <div className="flex items-center gap-2 text-slate-400 text-xs italic">
                                    <AlertTriangle size={12} />
                                    Changes are auto-saved to local staging
                                  </div>
                                  <button 
                                    onClick={() => setEditingId(null)}
                                    className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl shadow-slate-200 dark:shadow-none"
                                  >
                                    Commit Configuration
                                  </button>
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
