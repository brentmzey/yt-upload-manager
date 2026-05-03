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

/**
 * Utility to decompress Brotli data encoded in Base64.
 * Ensures the Backend can read "last-moment" compressed data from the UI or DB.
 */
fn decompress_brotli_b64(encoded: &str) -> Result<String, AppError> {
    let compressed_data = BASE64.decode(encoded)
        .map_err(|e| AppError::DecompressionError(format!("Base64 decode failed: {}", e)))?;
    
    let mut reader = brotli::Decompressor::new(&compressed_data[..], 4096);
    let mut decompressed = String::new();
    reader.read_to_string(&mut decompressed)
        .map_err(|e| AppError::DecompressionError(format!("Brotli decompress failed: {}", e)))?;
    
    Ok(decompressed)
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

#[derive(Serialize, Deserialize, TS, Debug, Clone)]
#[ts(export, export_to = "../../src/bindings/youtube_types.ts")]
pub struct VideoMetadataPayload {
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
    pub publish_at: Option<String>,
    pub recording_date: Option<String>,
    pub language: Option<String>,
    pub is_compressed: Option<bool>,
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

// --- App State ---

pub struct AppState {
    pub system: Mutex<System>,
    pub active_jobs: Arc<Mutex<u32>>,
    pub job_tx: mpsc::Sender<VideoMetadataPayload>,
}

// --- Background Worker ---

async fn start_background_worker(mut rx: mpsc::Receiver<VideoMetadataPayload>, active_jobs: Arc<Mutex<u32>>, app_handle: tauri::AppHandle) {
    debug!("Background worker started");
    
    // Check for dummy mode via environment variable
    let dummy_mode = std::env::var("YT_DUMMY_MODE").map(|v| v == "true").unwrap_or(false);
    if dummy_mode {
        info!("Rust Worker: RUNNING IN DUMMY MODE (Simulated latency & failures enabled)");
    }

    while let Some(payload) = rx.recv().await {
        {
            match active_jobs.lock() {
                Ok(mut count) => *count += 1,
                Err(e) => error!("Failed to lock active_jobs: {}", e),
            }
        }

        let is_scheduling = payload.scheduled_start_time.is_some() || payload.scheduled_start_time_millis.is_some();
        let job_type = if is_scheduling { "Scheduling" } else { "Upload" };
        
        // --- HUMAN READABLE LOGGING REGARDLESS OF COMPRESSION ---
        let _display_desc = if payload.is_compressed.unwrap_or(false) {
            decompress_brotli_b64(&payload.description).unwrap_or_else(|e| format!("[Decompression Failed: {:?}]", e))
        } else {
            payload.description.clone()
        };

        info!("Rust Worker: Starting {} job for {}", job_type, payload.title);
        
        // Simulate long-running task
        let job_active_jobs = Arc::clone(&active_jobs);
        let job_payload = payload.clone();
        let job_handle = app_handle.clone();
        let job_type_label = job_type.to_string();

        tauri::async_runtime::spawn(async move {
            debug!("Task spawned for {}: {}", job_type_label, job_payload.title);
            
            if dummy_mode {
                // Generate latency before any RNG is held across awaits
                let secs = rand::random_range(2..7);
                tokio::time::sleep(tokio::time::Duration::from_secs(secs)).await;

                // Generate failure boolean without holding RNG across awaits
                if rand::random_bool(0.05) {
                    error!("DUMMY MODE: Simulated random failure for {}", job_payload.title);
                    job_handle.emit("job-completed", BatchJobResponse {
                        video_id: "error".to_string(),
                        status: "Failed: Simulated Quota Error".to_string(),
                    }).unwrap_or_default();
                } else {
                    let fake_id = format!("dummy_yt_{}", SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis());
                    info!("DUMMY MODE: Completed {} for {} -> ID: {}", job_type_label, job_payload.title, fake_id);
                    job_handle.emit("job-completed", BatchJobResponse {
                        video_id: fake_id,
                        status: "Success".to_string(),
                    }).unwrap_or_default();
                }
            } else {
                // Real implementation (mocked for now)
                tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
                info!("Rust Worker: Completed {} for {}", job_type_label, job_payload.title);
                job_handle.emit("job-completed", BatchJobResponse {
                    video_id: "yt-simulated-id".to_string(),
                    status: "Success".to_string(),
                }).unwrap_or_default();
            }
            
            match job_active_jobs.lock() {
                Ok(mut count) => {
                    if *count > 0 {
                        *count -= 1;
                    }
                }
                Err(e) => error!("Failed to lock active_jobs in task: {}", e),
            }
        });
    }
    info!("Background worker shutting down");
}

// --- Commands ---

mod commands {
    use super::*;

    #[tauri::command]
    pub async fn get_system_status(state: State<'_, AppState>) -> AppResult<SystemStatus> {
        trace!("Handling get_system_status command");
        let mut sys = state.system.lock().map_err(|e| AppError::LockError(e.to_string()))?;
        
        // Refresh specific metrics
        sys.refresh_cpu_all();
        sys.refresh_memory();

        let cpu_usage = sys.global_cpu_usage();
        let memory_usage = sys.used_memory();
        let uptime = System::uptime();
        let active_jobs = *state.active_jobs.lock().map_err(|e| AppError::LockError(e.to_string()))?;

        debug!("System status: CPU {}%, MEM {}KB, Jobs {}, Uptime {}s", cpu_usage, memory_usage, active_jobs, uptime);

        Ok(SystemStatus {
            cpu_usage,
            memory_usage,
            active_jobs,
            uptime,
        })
    }

    #[tauri::command]
    pub async fn start_youtube_upload_job(
        payload: VideoMetadataPayload,
        state: State<'_, AppState>
    ) -> AppResult<BatchJobResponse> {
        info!("Backend: Queueing upload for {}", payload.title);
        debug!("Payload: {:?}", payload);
        
        state.job_tx.send(payload).await.map_err(|e| AppError::QueueError(e.to_string()))?;

        Ok(BatchJobResponse {
            video_id: "queued".to_string(),
            status: "Processing".to_string(),
        })
    }

    #[tauri::command]
    pub async fn get_youtube_video_details(
        video_id: String,
        _state: State<'_, AppState>
    ) -> AppResult<YouTubeVideoDetails> {
        info!("Backend: Fetching details for video ID {}", video_id);
        
        // Mocking YouTube Data API response for now
        Ok(YouTubeVideoDetails {
            id: video_id.clone(),
            title: format!("Mock YouTube Title for {}", video_id),
            description: "This is a dummy description fetched from the mock YouTube API.".to_string(),
            thumbnail_url: Some("https://picsum.photos/640/360".to_string()),
            privacy_status: "private".to_string(),
            view_count: Some(0),
            url: format!("https://youtube.com/watch?v={}", video_id),
        })
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let (tx, rx) = mpsc::channel(100);
    let active_jobs = Arc::new(Mutex::new(0));
    let active_jobs_clone = Arc::clone(&active_jobs);

    let mut system = System::new_all();
    system.refresh_all();

    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Trace)
            .build())
        .setup(move |app| {
            let app_handle = app.handle().clone();
            
            // Start background worker using Tauri's async runtime
            tauri::async_runtime::spawn(async move {
                start_background_worker(rx, active_jobs_clone, app_handle).await;
            });

            // Manage State
            app.manage(AppState {
                system: Mutex::new(system),
                active_jobs,
                job_tx: tx,
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

#[cfg(test)]
mod tests {
    use super::*;
    use tauri::test::{mock_builder, mock_context, noop_assets};

    fn setup_app() -> (tauri::App<tauri::test::MockRuntime>, mpsc::Receiver<VideoMetadataPayload>) {
        let (tx, rx) = mpsc::channel(100);
        let active_jobs = Arc::new(Mutex::new(0));
        let mut system = System::new_all();
        system.refresh_all();

        let app = mock_builder()
            .build(mock_context(noop_assets()))
            .expect("failed to build app");
            
        app.manage(AppState {
            system: Mutex::new(system),
            active_jobs,
            job_tx: tx,
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
            publish_at: None,
            recording_date: None,
            language: None,
            is_compressed: None,
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
