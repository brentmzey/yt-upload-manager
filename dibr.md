# Developer Initial Build & Run (DIBR) - YouTube Upload Manager

This document provides a comprehensive, step-by-step guide on how to configure, build, run, and test the YouTube Upload Manager from scratch. It covers database initialization, Google Cloud API configurations, and testing strategies across all targets.

## 🏗 Phase 1: Environment & Initialization

### 1. Configure the Environment
The application operates on a 12-factor architecture, relying on a central `.env` file.
1. Copy the example configuration:
   ```bash
   cp .env.example .env
   ```
2. **(Optional)** Adjust `PUBLIC_POCKETBASE_URL` if hosting your database externally.
3. Keep `PUBLIC_YT_DUMMY_MODE=true` and `YT_DUMMY_MODE=true` during initial development to safely test the UI/Backend bridging without using real Google Cloud quota.

### 2. Install Dependencies
This project utilizes Bun for the web/node layer and Cargo for the Rust native backend.
```bash
bun install
```

### 3. Initialize PocketBase (Database & Schema)
The app uses PocketBase for metadata storage and runtime config. The UI expects specific collections (e.g., `s_channels`, `t_app_settings`) to be present.
1. **Start the database:**
   ```bash
   pocketbase serve
   # If you don't have the pocketbase binary globally, download it from pocketbase.io
   ```
2. **Apply Migrations (In a new terminal):**
   ```bash
   bun run migrate
   ```
   *This script authenticates using the default admin credentials in `.env`, applies all Hungarian-notated collections (`s_`, `t_`), and initializes the system.*
3. **Generate Types:**
   ```bash
   bun run typegen
   ```
   *This keeps the TypeScript frontend perfectly in sync with your local PocketBase schema.*

---

## 🔑 Phase 2: Runtime Configuration (Google Cloud & App Settings)

The app is designed to read configuration dynamically from the database (`t_app_settings`) and store secure payloads in `s_channels`. 

### 1. YouTube Data API Configuration
To execute real uploads (disabling Dummy Mode), you must provision Google Cloud OAuth 2.0 Credentials:
1. Navigate to the [Google Cloud Console](https://console.cloud.google.com/).
2. Enable the **YouTube Data API v3**.
3. Configure the **OAuth Consent Screen** (Scope: `https://www.googleapis.com/auth/youtube.upload`).
4. Generate **OAuth 2.0 Client IDs**:
   * **Native/Desktop App:** Create a "Desktop app" client. (Tauri handles the localhost redirect securely).
   * **Web App:** Create a "Web application" client. Allow authorized redirect URIs (e.g., `http://localhost:1420`).
5. **In the App UI:** Go to **Channel Management -> Add New Channel** and enter the `Client ID` and `Client Secret`. 
   * *Architecture Note:* The app applies **Brotli compression** to this configuration, stores it in `s_channels`, and the Rust backend seamlessly decompresses it at execution time.

### 2. Dynamic Settings
Navigate to the PocketBase Admin UI (`http://127.0.0.1:8090/_/`) -> `t_app_settings` to modify live parameters (e.g., `max_concurrent_uploads`, `default_category_id`). The UI fetches these automatically via the `PocketBaseService`.

---

## 🚀 Phase 3: Building, Running & Inspecting

The application is structured to compile natively to Desktop (macOS/Windows/Linux), Mobile, and Web.

### 1. Native Desktop (Tauri)
To run the fully integrated, native application with Rust processing:
```bash
bun run tauri dev
```
* **Inspection:** Right-click the app window to open the Web Inspector (Chrome/Safari DevTools depending on OS). Rust backend logs print directly to your terminal.

### 2. Web / Server-Side Rendering (Astro/React)
To run just the web frontend (which will attempt to communicate with an Edge Backend defined by `PUBLIC_EDGE_BACKEND_URL`):
```bash
bun run dev
```

### 3. Build & Package (Local Artifacts)
To locally simulate what the CI/CD pipeline executes to generate installable artifacts (`.dmg`, `.app`, `.msi`, `.deb`):
```bash
bun run tauri build
```
*Outputs are placed in `src-tauri/target/release/bundle/`.*

---

## 🧪 Phase 4: Testing & CI/CD Strategy

### 1. Unit & Integration Testing (Local)
Test the compression pipeline, staging flow, and PocketBase integration in a simulated environment:
```bash
bun run test
```

### 2. Rust Backend Validation
Validate the Tauri Command inputs, data structures, and Brotli decompression logic natively:
```bash
cd src-tauri && cargo test
```

### 3. CI/CD (GitHub Actions)
The repository includes a comprehensive `.github/workflows/ci.yml` pipeline that triggers on push/PR:
* **Validation:** Concurrently executes `bun run test` and `cargo test` on Ubuntu, macOS, and Windows.
* **Dummy Mode Injection:** The CI environment automatically enforces `YT_DUMMY_MODE=true` to prevent credential/quota exhaustion during automated tests.
* **Artifact Release:** Upon successful compilation, the pipeline utilizes `tauri-apps/tauri-action` to build native installers and attaches them automatically to GitHub Draft Releases, enabling version-by-version distribution.