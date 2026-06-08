# YT Upload Manager - Developer Guide

Welcome to the ultimate reference manual for developing, running, testing, and understanding the multi-target architecture of the YT Upload Manager.

## 🏗 Architecture Overview

The system is a distributed, multi-tenant application:
- **Registry Database (Port 8080):** The central PocketBase instance that tracks all enterprise tenants.
- **Tenant Database (Port 8090):** The isolated database for a specific tenant (e.g., a specific church).
- **Tauri Native App:** A Rust-powered desktop and mobile application.
- **Edge Backend:** A standalone Rust binary providing backend API access for the web targets.

## 🚀 Local Development Setup

To test the full stack locally (including the database, backend, API, and client targets), you need to initialize the multi-tenant infrastructure.

### 1. Booting the Infrastructure
We use `just` to orchestrate our environments. Run these commands sequentially:

```bash
# 1. Start the Central Registry Database (Port 8080)
just main-up

# 2. In a new terminal, start the local Tenant Database (Port 8090)
just up

# 3. Synchronize the tenant configurations between them
just sync-tenants
```

### 2. Running the Client Applications
Once the backend infrastructure is running, you can launch the specific client you want to develop on:

```bash
# Run the Desktop Application (macOS/Windows/Linux)
just dev

# Run the Web-only App
bun run dev

# Run the iOS Simulator (Requires macOS & Xcode)
bun run tauri ios dev

# Run the Android Emulator (Requires Android Studio)
bun run tauri android dev
```

---

## 🧪 Testing the Stack

Testing is automated via `vitest` and covers everything from logic unit tests to physical E2E integrations.

### Unit & Integration Testing
```bash
# Run all fast unit tests
just test

# Run integration tests against the local database
just integration
```

### True E2E YouTube Testing
The integration suite contains a physical live-stream test that creates and deletes broadcasts on a real YouTube account to verify connectivity.
To run it, supply your OAuth token:

```bash
YT_E2E_ACCESS_TOKEN="ya29.your-google-oauth-token" bun run test src/test/youtube_broadcast_integration.test.ts
```
*Note: If `YT_E2E_ACCESS_TOKEN` is not present, the physical test will safely skip to prevent failing CI pipelines.*

### Full System Check
Before pushing to GitHub, you can run a full validation pass of everything (formatting, linting, tests, environment):
```bash
just full-check
```

---

## 🔍 Inspecting the Stack

### Database Administration
You can visually inspect the databases at any time while they are running:
- **Central Registry Admin:** `http://127.0.0.1:8080/_/`
- **Tenant Database Admin:** `http://127.0.0.1:8090/_/`
*(Default Admin: `test@example.com` / `test123456`)*

### Tauri Application Inspection
When running `just dev`, you can inspect the web layer:
- **macOS:** Right-click anywhere in the app and select `Inspect Element`.
- **Windows:** Right-click and select `Inspect` or press `Ctrl + Shift + I`.
The Rust backend logs will stream directly to the terminal where you ran `just dev`.

---

## ⚙️ CI/CD Pipeline & Releases

The application uses a robust GitHub Actions pipeline (`.github/workflows/ci.yml`) to guarantee enterprise-grade delivery. 

### Triggering the Pipeline
The pipeline triggers automatically on:
- Pushes to `main`, `development`, and `feature/**` branches.
- Pull Requests to these branches.
- Manual triggers via GitHub's `workflow_dispatch` button.

### What the Pipeline Does
1. **Security Scan:** Audits `npm` and Rust dependencies for known vulnerabilities.
2. **Testing:** Installs dependencies and runs the entire `vitest` unit/integration test suite.
3. **Cross-Platform Builds:** Compiles native desktop binaries for `macOS`, `Windows`, and `Linux` (including `.AppImage`, `.deb`, `.rpm`).
4. **Mobile Builds:** Provisions the Android SDK/NDK to compile the `.apk`, and Xcode to compile the iOS simulator `.zip`.
5. **Edge Backend:** Compiles the standalone Rust binary for web-backend proxying.

### Automated Releases
When code is pushed to the `main` branch (or via manual trigger), the pipeline invokes the **`publish-release`** job. This job automatically:
1. Collects all built desktop binaries, mobile files, and server executables.
2. Drafts a GitHub Release tagged as `v0.1.0-build-[RUN_NUMBER]`.
3. Attaches all the physical artifacts so enterprise clients can immediately download and install them.
