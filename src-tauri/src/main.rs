// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[tokio::main]
async fn main() {
  // Check if we should run in server mode
  let is_server = std::env::var("APP_MODE").map(|v| v == "server").unwrap_or(false) 
               || std::env::args().any(|arg| arg == "--server");

  if is_server {
    let port = std::env::var("PORT")
      .ok()
      .and_then(|p| p.parse().ok())
      .unwrap_or(3000);
    app_lib::run_server(port).await;
  } else {
    app_lib::run_tauri();
  }
}
