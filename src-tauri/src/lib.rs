use serde::{Deserialize, Serialize};
use ts_rs::TS;
use tauri::{State, Manager, Emitter};
use std::sync::{Arc, Mutex};
use sysinfo::System;
use tokio::sync::mpsc;

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
    pub scheduled_start_time: Option<String>,
    pub publish_at: Option<String>,
    pub recording_date: Option<String>,
    pub language: Option<String>,
}

#[derive(Serialize, Deserialize, TS, Debug, Clone)]
#[ts(export, export_to = "../../src/bindings/youtube_types.ts")]
pub struct BatchJobResponse {
    pub video_id: String,
    pub status: String,
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
    while let Some(payload) = rx.recv().await {
        {
            let mut count = active_jobs.lock().unwrap();
            *count += 1;
        }

        println!("Rust Worker: Starting job for {}", payload.title);
        
        // Simulate long-running upload task
        let job_active_jobs = Arc::clone(&active_jobs);
        let job_payload = payload.clone();
        let job_handle = app_handle.clone();

        tokio::spawn(async move {
            // In a real app, this is where reqwest calls YouTube API
            tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
            
            println!("Rust Worker: Completed job for {}", job_payload.title);
            
            let mut count = job_active_jobs.lock().unwrap();
            if *count > 0 {
                *count -= 1;
            }

            // We could emit an event back to the UI here
            let _ = job_handle.emit("job-completed", BatchJobResponse {
                video_id: "yt-simulated-id".to_string(),
                status: "Success".to_string(),
            });
        });
    }
}

// --- Commands ---

mod commands {
    use super::*;

    #[tauri::command]
    pub async fn get_system_status(state: State<'_, AppState>) -> Result<SystemStatus, String> {
        let mut sys = state.system.lock().unwrap();
        
        // Refresh specific metrics
        sys.refresh_cpu_all();
        sys.refresh_memory();

        let cpu_usage = sys.global_cpu_usage();
        let memory_usage = sys.used_memory();
        let uptime = System::uptime();
        let active_jobs = *state.active_jobs.lock().unwrap();

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
    ) -> Result<BatchJobResponse, String> {
        println!("Backend: Queueing upload for {}", payload.title);
        
        if let Err(e) = state.job_tx.send(payload).await {
            return Err(format!("Failed to queue job: {}", e));
        }

        Ok(BatchJobResponse {
            video_id: "queued".to_string(),
            status: "Processing".to_string(),
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
        .plugin(tauri_plugin_log::Builder::default().build())
        .setup(move |app| {
            let app_handle = app.handle().clone();
            
            // Start background worker
            tokio::spawn(async move {
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
            commands::get_system_status
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn export_bindings() {
        VideoMetadataPayload::export().expect("Failed to export VideoMetadataPayload");
        BatchJobResponse::export().expect("Failed to export BatchJobResponse");
        SystemStatus::export().expect("Failed to export SystemStatus");
    }
}
