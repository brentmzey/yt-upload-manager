# Architecture: All-Facet YouTube Manager

This application is designed to be highly portable, running as a Desktop app, Mobile app, and Standalone Server.

## Facets

### 1. Desktop (macOS, Windows, Linux)
- **Built with**: Tauri + Rust + React.
- **Runtime**: Local binary with a GUI window.
- **Logic**: Executes YouTube API calls directly from the user's machine.
- **Data**: Connects to a central PocketBase instance or local dev instance.

### 2. Standalone Backend Server (Linux/Headless)
- **Built with**: Rust (Axum).
- **Execution**: Run the binary with `APP_MODE=server` or `--server`.
- **API**: Exposes a REST API on port 3000 (configurable via `PORT`).
  - `GET /api/status`: Returns system and job metrics.
  - `POST /api/jobs`: Queue a YouTube upload/broadcast job.
- **Deployment**: Ideal for Docker or VPS environments where a central logic node is needed.

### 3. Mobile (iOS & Android)
- **Built with**: Tauri Mobile.
- **Deployment**: Produced as `.apk` (Android) and `.app` (iOS) in CI/CD.
- **Connectivity**: Connects to the central PocketBase for state and optionally the Backend Server for heavy lifting.

### 4. Web App
- **Built with**: Astro + React.
- **Deployment**: Static files in `dist/`.
- **Logic**: Can be hosted on Vercel/Netlify. Connects to the **Standalone Backend Server** for YouTube operations.

## Running the Server
To start the standalone backend server:
```bash
# Set environment variables
export APP_MODE=server
export PORT=3000
export YT_DUMMY_MODE=false

# Run the binary
./yt-backend-server-linux
```

## Connecting Clients
The Web App and Mobile apps can be configured to point to the server URL via the `PUBLIC_BACKEND_URL` environment variable at build time.
