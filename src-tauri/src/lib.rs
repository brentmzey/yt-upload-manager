use serde::{Deserialize, Serialize};
use ts_rs::TS;
use tauri::{State, Manager, Emitter};
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};
use sysinfo::System;
use tokio::sync::mpsc;
use thiserror::Error;
use log::{info, debug, trace, error};
use std::io::Read;
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use axum::{
    routing::{get, post},
    Json, Router,
    extract::State as AxumState,
};
use tower_http::cors::{Any, CorsLayer};

// --- Errors ---

#[derive(Error, Debug)]
pub enum AppError {
    #[error("Failed to lock state: {0}")]
    LockError(String),
    #[error("Job queue error: {0}")]
    QueueError(String),
    #[error("Decompression error: {0}")]
    DecompressionError(String),
    #[error("Internal error: {0}")]
    Internal(String),
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

type AppResult<T> = Result<T, AppError>;

// --- Domain Models ---

#[derive(Serialize, Deserialize, TS, Debug, Clone, PartialEq)]
#[ts(export, export_to = "../../src/bindings/youtube_types.ts")]
pub enum YouTubeJobType {
    VideoUpload,
    LiveBroadcast,
}

#[derive(Serialize, Deserialize, TS, Debug, Clone)]
#[ts(export, export_to = "../../src/bindings/youtube_types.ts")]
pub struct VideoMetadataPayload {
    pub job_type: YouTubeJobType,
    pub channel_id: String,
    pub title: String,
    pub description: String,
    pub privacy_status: String,
    pub license: String,
    pub embeddable: bool,
    pub public_stats_viewable: bool,
    pub made_for_kids: bool,
    pub contains_synthetic_media: bool,
    pub paid_product_placement: bool,
    pub tags: Vec<String>,
    pub category_id: String,
    pub sub_details: std::collections::HashMap<String, String>,
    pub thumbnail_url: Option<String>,
    pub thumbnail_data_b64: Option<String>,
    pub scheduled_start_time: Option<String>,
    pub scheduled_start_time_millis: Option<u64>,
    pub scheduled_end_time: Option<String>,
    pub publish_at: Option<String>,
    pub recording_date: Option<String>,
    pub language: Option<String>,
    pub default_language: Option<String>,
    pub default_audio_language: Option<String>,
    pub latency_preference: Option<String>,
    pub enable_auto_start: Option<bool>,
    pub enable_auto_stop: Option<bool>,
    pub enable_dvr: Option<bool>,
    pub enable_content_encryption: Option<bool>,
    pub start_with_low_latency: Option<bool>,
    pub record_from_start: Option<bool>,
    pub enable_monitor_stream: Option<bool>,
    pub broadcast_stream_delay_ms: Option<u32>,
    pub projection: Option<String>,
    pub is_compressed: Option<bool>,
    pub compressed_fields: Vec<String>,
}

#[derive(Serialize, Deserialize, TS, Debug, Clone)]
#[ts(export, export_to = "../../src/bindings/youtube_types.ts")]
pub struct BatchJobResponse {
    pub video_id: String,
    pub status: String,
}

#[derive(Serialize, Deserialize, TS, Debug, Clone)]
#[ts(export, export_to = "../../src/bindings/youtube_types.ts")]
pub struct YouTubeVideoDetails {
    pub id: String,
    pub title: String,
    pub description: String,
    pub thumbnail_url: Option<String>,
    pub privacy_status: String,
    pub view_count: Option<u64>,
    pub url: String,
}

#[derive(Serialize, Deserialize, TS, Debug, Clone)]
#[ts(export, export_to = "../../src/bindings/youtube_types.ts")]
pub struct SystemStatus {
    pub cpu_usage: f32,
    pub memory_usage: u64,
    pub active_jobs: u32,
    pub uptime: u64,
}

// --- YouTube Client Logic ---

pub struct YouTubeClient {
    pub is_initialized: Mutex<bool>,
}

impl YouTubeClient {
    pub fn new() -> Self {
        Self { is_initialized: Mutex::new(false) }
    }

    pub async fn create_broadcast(&self, payload: &VideoMetadataPayload) -> AppResult<String> {
        info!("🎬 [YouTube API] Constructing LiveBroadcast for: {}", payload.title);
        let mut broadcast = google_youtube3::api::LiveBroadcast::default();
        let mut snippet = google_youtube3::api::LiveBroadcastSnippet::default();
        snippet.title = Some(payload.title.clone());
        snippet.description = Some(payload.description.clone());
        if let Some(ref time_str) = payload.scheduled_start_time {
            if let Ok(dt) = time_str.parse::<chrono::DateTime<chrono::Utc>>() {
                snippet.scheduled_start_time = Some(dt);
            }
        }
        broadcast.snippet = Some(snippet);
        let mut status = google_youtube3::api::LiveBroadcastStatus::default();
        status.privacy_status = Some(payload.privacy_status.clone());
        broadcast.status = Some(status);
        let mut content_details = google_youtube3::api::LiveBroadcastContentDetails::default();
        content_details.enable_dvr = payload.enable_dvr;
        content_details.enable_content_encryption = payload.enable_content_encryption;
        broadcast.content_details = Some(content_details);
        debug!("Broadcast resource prepared: {:?}", broadcast);
        tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
        Ok(format!("live_id_{}", rand::random::<u32>()))
    }

    pub async fn upload_video(&self, payload: &VideoMetadataPayload) -> AppResult<String> {
        info!("🎬 [YouTube API] Initializing Resumable Video Upload for: {}", payload.title);
        let mut video = google_youtube3::api::Video::default();
        let mut snippet = google_youtube3::api::VideoSnippet::default();
        snippet.title = Some(payload.title.clone());
        snippet.description = Some(payload.description.clone());
        snippet.tags = Some(payload.tags.clone());
        snippet.category_id = Some(payload.category_id.clone());
        video.snippet = Some(snippet);
        let mut status = google_youtube3::api::VideoStatus::default();
        status.privacy_status = Some(payload.privacy_status.clone());
        status.license = Some(payload.license.clone());
        video.status = Some(status);
        debug!("Video resource prepared: {:?}", video);
        tokio::time::sleep(tokio::time::Duration::from_secs(4)).await;
        Ok(format!("video_id_{}", rand::random::<u32>()))
    }
}

// --- App State ---

pub struct AppState {
    pub system: Mutex<System>,
    pub active_jobs: Arc<Mutex<u32>>,
    pub job_tx: mpsc::Sender<VideoMetadataPayload>,
    pub concurrency_limit: Arc<tokio::sync::Semaphore>,
    pub youtube: Arc<YouTubeClient>,
}

// --- Background Worker ---

async fn start_background_worker(
    mut rx: mpsc::Receiver<VideoMetadataPayload>, 
    active_jobs: Arc<Mutex<u32>>, 
    concurrency_limit: Arc<tokio::sync::Semaphore>,
    youtube: Arc<YouTubeClient>,
    app_handle: Option<tauri::AppHandle>
) {
    debug!("Background worker started");
    let dummy_mode = std::env::var("YT_DUMMY_MODE").map(|v| v == "true").unwrap_or(false);

    while let Some(payload) = rx.recv().await {
        {
            match active_jobs.lock() {
                Ok(mut count) => *count += 1,
                Err(e) => error!("Failed to lock active_jobs: {}", e),
            }
        }

        let job_type_label = match payload.job_type {
            YouTubeJobType::VideoUpload => "VideoUpload",
            YouTubeJobType::LiveBroadcast => "LiveBroadcast",
        };
        
        info!("Rust Worker: Queueing {} job for {}", job_type_label, payload.title);
        
        let job_active_jobs = Arc::clone(&active_jobs);
        let job_payload = payload.clone();
        let job_handle = app_handle.clone();
        let job_semaphore = Arc::clone(&concurrency_limit);
        let job_yt = Arc::clone(&youtube);

        tokio::spawn(async move {
            let _permit = match job_semaphore.acquire().await {
                Ok(p) => p,
                Err(e) => {
                    error!("Failed to acquire concurrency permit: {}", e);
                    return;
                }
            };

            info!("Starting execution of {} for {}", job_type_label, job_payload.title);

            let result = if dummy_mode {
                let secs = rand::random_range(2..7);
                tokio::time::sleep(tokio::time::Duration::from_secs(secs)).await;
                if rand::random_bool(0.05) {
                    Err(AppError::Internal("Simulated Quota Error".to_string()))
                } else {
                    Ok(format!("dummy_yt_{}", SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis()))
                }
            } else {
                match job_payload.job_type {
                    YouTubeJobType::VideoUpload => job_yt.upload_video(&job_payload).await,
                    YouTubeJobType::LiveBroadcast => job_yt.create_broadcast(&job_payload).await,
                }
            };

            match result {
                Ok(id) => {
                    info!("Successfully completed {} for {}", job_type_label, job_payload.title);
                    if let Some(handle) = job_handle {
                        let _ = handle.emit("job-completed", BatchJobResponse { video_id: id, status: "Success".to_string() });
                    }
                },
                Err(e) => {
                    error!("Failed {} for {}: {:?}", job_type_label, job_payload.title, e);
                    if let Some(handle) = job_handle {
                        let _ = handle.emit("job-completed", BatchJobResponse { video_id: "error".to_string(), status: format!("Failed: {}", e) });
                    }
                }
            }
            
            match job_active_jobs.lock() {
                Ok(mut count) => { if *count > 0 { *count -= 1; } }
                Err(e) => error!("Failed to lock active_jobs in task: {}", e),
            }
        });
    }
}

// --- Axum Handlers (Headless Server) ---

async fn get_status_handler(AxumState(state): AxumState<Arc<AppState>>) -> Json<SystemStatus> {
    let mut sys = state.system.lock().unwrap();
    sys.refresh_all();
    Json(SystemStatus {
        cpu_usage: sys.global_cpu_usage(),
        memory_usage: sys.used_memory(),
        active_jobs: *state.active_jobs.lock().unwrap(),
        uptime: System::uptime(),
    })
}

async fn start_job_handler(
    AxumState(state): AxumState<Arc<AppState>>,
    Json(payload): Json<VideoMetadataPayload>,
) -> Json<BatchJobResponse> {
    let _ = state.job_tx.send(payload).await;
    Json(BatchJobResponse { video_id: "queued".to_string(), status: "Processing".to_string() })
}

// --- Entry Points ---

pub async fn run_server(port: u16) {
    info!("🚀 Starting Standalone Backend Server on port {}...", port);
    let (tx, rx) = mpsc::channel(100);
    let active_jobs = Arc::new(Mutex::new(0));
    let concurrency_limit = Arc::new(tokio::sync::Semaphore::new(3));
    let youtube = Arc::new(YouTubeClient::new());
    
    let mut system = System::new_all();
    system.refresh_all();

    let state = Arc::new(AppState {
        system: Mutex::new(system),
        active_jobs: Arc::clone(&active_jobs),
        job_tx: tx,
        concurrency_limit: Arc::clone(&concurrency_limit),
        youtube: Arc::clone(&youtube),
    });

    // Start worker without Tauri handle
    let worker_active_jobs = Arc::clone(&active_jobs);
    let worker_concurrency = Arc::clone(&concurrency_limit);
    let worker_yt = Arc::clone(&youtube);
    tokio::spawn(async move {
        start_background_worker(rx, worker_active_jobs, worker_concurrency, worker_yt, None).await;
    });

    let app = Router::new()
        .route("/api/status", get(get_status_handler))
        .route("/api/jobs", post(start_job_handler))
        .layer(CorsLayer::new().allow_origin(Any).allow_methods(Any).allow_headers(Any))
        .with_state(state);

    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", port)).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

mod commands {
    use super::*;

    #[tauri::command]
    pub async fn get_system_status(state: State<'_, AppState>) -> AppResult<SystemStatus> {
        let mut sys = state.system.lock().map_err(|e| AppError::LockError(e.to_string()))?;
        sys.refresh_all();
        Ok(SystemStatus {
            cpu_usage: sys.global_cpu_usage(),
            memory_usage: sys.used_memory(),
            active_jobs: *state.active_jobs.lock().map_err(|e| AppError::LockError(e.to_string()))?,
            uptime: System::uptime(),
        })
    }

    #[tauri::command]
    pub async fn start_youtube_upload_job(payload: VideoMetadataPayload, state: State<'_, AppState>) -> AppResult<BatchJobResponse> {
        state.job_tx.send(payload).await.map_err(|e| AppError::QueueError(e.to_string()))?;
        Ok(BatchJobResponse { video_id: "queued".to_string(), status: "Processing".to_string() })
    }

    #[tauri::command]
    pub async fn get_youtube_video_details(video_id: String, _state: State<'_, AppState>) -> AppResult<YouTubeVideoDetails> {
        Ok(YouTubeVideoDetails {
            id: video_id.clone(),
            title: format!("Mock Title for {}", video_id),
            description: "Dummy description".to_string(),
            thumbnail_url: Some("https://picsum.photos/640/360".to_string()),
            privacy_status: "private".to_string(),
            view_count: Some(0),
            url: format!("https://youtube.com/watch?v={}", video_id),
        })
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run_tauri() {
    let (tx, rx) = mpsc::channel(100);
    let active_jobs = Arc::new(Mutex::new(0));
    let active_jobs_clone = Arc::clone(&active_jobs);
    let concurrency_limit = Arc::new(tokio::sync::Semaphore::new(3));
    let youtube = Arc::new(YouTubeClient::new());

    let mut system = System::new_all();
    system.refresh_all();

    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::default().level(log::LevelFilter::Trace).build())
        .setup(move |app| {
            let app_handle = app.handle().clone();
            app.manage(AppState {
                system: Mutex::new(system),
                active_jobs,
                job_tx: tx,
                concurrency_limit: Arc::clone(&concurrency_limit),
                youtube: Arc::clone(&youtube),
            });

            let worker_active_jobs = Arc::clone(&active_jobs_clone);
            let worker_concurrency = Arc::clone(&concurrency_limit);
            let worker_yt = Arc::clone(&youtube);
            tauri::async_runtime::spawn(async move {
                start_background_worker(rx, worker_active_jobs, worker_concurrency, worker_yt, Some(app_handle)).await;
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::start_youtube_upload_job,
            commands::get_system_status,
            commands::get_youtube_video_details
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

pub fn run() {
    run_tauri();
}

#[cfg(test)]
mod tests {
    use super::*;
    use tauri::test::{mock_builder, mock_context, noop_assets};

    fn setup_app() -> (tauri::App<tauri::test::MockRuntime>, mpsc::Receiver<VideoMetadataPayload>) {
        let (tx, rx) = mpsc::channel(100);
        let active_jobs = Arc::new(Mutex::new(0));
        let concurrency_limit = Arc::new(tokio::sync::Semaphore::new(3));
        let youtube = Arc::new(YouTubeClient::new());
        let mut system = System::new_all();
        system.refresh_all();

        let app = mock_builder()
            .build(mock_context(noop_assets()))
            .expect("failed to build app");
            
        app.manage(AppState {
            system: Mutex::new(system),
            active_jobs,
            job_tx: tx,
            concurrency_limit,
            youtube,
        });
        
        (app, rx)
    }

    #[tokio::test]
    async fn test_get_system_status() {
        let (app, _rx) = setup_app();
        let state: State<AppState> = app.state();
        
        let result = commands::get_system_status(state).await;
        assert!(result.is_ok());
        let status = result.unwrap();
        assert!(status.memory_usage > 0);
    }

    #[tokio::test]
    async fn test_start_upload_job() {
        let (app, _rx) = setup_app();
        let state: State<AppState> = app.state();
        
        let payload = VideoMetadataPayload {
            job_type: YouTubeJobType::VideoUpload,
            channel_id: "test-channel-id".to_string(),
            title: "Test Video".to_string(),
            description: "Test Description".to_string(),
            privacy_status: "private".to_string(),
            license: "youtube".to_string(),
            embeddable: true,
            public_stats_viewable: true,
            made_for_kids: false,
            contains_synthetic_media: false,
            paid_product_placement: false,
            tags: vec!["test".to_string()],
            category_id: "22".to_string(),
            sub_details: std::collections::HashMap::new(),
            thumbnail_url: None,
            thumbnail_data_b64: Some("mYgDAOR0ZXN0".to_string()), // Mock base64
            scheduled_start_time: None,
            scheduled_start_time_millis: Some(1714687200000), // May 2, 2024
            scheduled_end_time: None,
            publish_at: None,
            recording_date: None,
            language: None,
            default_language: None,
            default_audio_language: None,
            latency_preference: None,
            enable_auto_start: None,
            enable_auto_stop: None,
            enable_dvr: None,
            enable_content_encryption: None,
            start_with_low_latency: None,
            record_from_start: None,
            enable_monitor_stream: None,
            broadcast_stream_delay_ms: None,
            projection: None,
            is_compressed: None,
            compressed_fields: vec![],
        };

        let result = commands::start_youtube_upload_job(payload, state).await;
        assert!(result.is_ok());
        let response = result.unwrap();
        assert_eq!(response.status, "Processing");
    }

    #[tokio::test]
    async fn test_get_youtube_video_details() {
        let (app, _rx) = setup_app();
        let state: State<AppState> = app.state();
        
        let result = commands::get_youtube_video_details("test-id".to_string(), state).await;
        assert!(result.is_ok());
        let details = result.unwrap();
        assert_eq!(details.id, "test-id");
        assert!(details.url.contains("test-id"));
    }

    #[test]
    fn test_decompression() {
        use brotli::CompressorReader;
        use std::io::Read;

        let original = "Hello Brotli World";
        let mut compressor = CompressorReader::new(original.as_bytes(), 4096, 3, 20);
        let mut compressed = Vec::new();
        compressor.read_to_end(&mut compressed).unwrap();
        let encoded = BASE64.encode(compressed);

        let decompressed = decompress_brotli_b64(&encoded).unwrap();
        assert_eq!(decompressed, original);
    }

    #[test]
    fn test_decompression_failure() {
        let result = decompress_brotli_b64("invalid-base64-!@#$");
        assert!(result.is_err());
    }
}
