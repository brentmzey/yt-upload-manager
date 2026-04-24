use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Serialize, Deserialize, TS)]
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

#[derive(Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/bindings/youtube_types.ts")]
pub struct BatchJobResponse {
    pub video_id: String,
    pub status: String,
}

mod commands {
    use super::*;

    #[tauri::command]
    pub async fn start_youtube_upload_job(payload: VideoMetadataPayload) -> Result<BatchJobResponse, String> {
        println!("Backend: Processing upload for {}", payload.title);
        Ok(BatchJobResponse {
            video_id: "rust-simulated-id".to_string(),
            status: "Success".to_string(),
        })
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::default().build())
        .invoke_handler(tauri::generate_handler![commands::start_youtube_upload_job])
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
    }
}
