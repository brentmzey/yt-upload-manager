# YouTube Upload Manager

A 12-factor, multi-channel YouTube management application built with **Tauri 2.0**, **Astro.js**, **React**, and **Effect-TS**.

## 🚀 Key Features
- **Multi-Channel Design**: Securely manage multiple YouTube accounts with isolated configurations.
- **Batch Operations**: Bulk upload videos and schedule upcoming live streams with high concurrency.
- **Brotli Optimized Storage**: Transparently compresses large metadata fields using Brotli for high-performance PocketBase persistence.
- **Cross-Platform**: Run as a native Desktop app (macOS, Windows, Linux), Mobile app (Android, iOS), or in the Browser.
- **Functional Programming**: Built with [Effect](https://effect.website/) for robust error handling and type-safe async pipelines.

## 🛠 Prerequisites
- **Nix**: (Highly Recommended) To ensure a consistent build environment with all dependencies.
- **Bun**: Fast JavaScript runtime and package manager.
- **Rust**: For the Tauri backend and native services.
- **PocketBase**: The backend database and auth service.

## 🛠 Orchestration (The `just` Workflow)

This project uses `just` to automate all common development tasks.

### 1. Initial Setup
```bash
nix develop      # Enter the development shell (if using Nix)
just setup       # Install dependencies and sync Rust-to-TS bindings
```

### 2. Database Management
```bash
just up          # Start PocketBase and apply migrations
just db-stop     # Stop the background PocketBase process
just reset       # WIPE all local data and start fresh
```

### 3. Development
```bash
just tauri       # Start the Desktop application in dev mode
just dev         # Start the Astro web server (Web mode)
```

### 4. Quality Control
```bash
just validate    # Run linting, unit tests, and binding checks
just lint        # Run TypeScript type checking
just test        # Run the full Vitest test suite
just check-env   # Verify tool versions and environment health
```

### 5. Build & Deployment
```bash
just build-web   # Create a production build of the web frontend
just build-tauri # Build production native binaries (Desktop)
just dist        # Build everything for distribution
```

## 🌐 12-Factor Configuration & Setup

The application supports multiple deployment and runtime targets (Desktop, Web, Mobile). It uses a hybrid configuration approach: environment variables for deployment topology and database records for runtime settings.

### 1. Environment Variables (`.env`)
Copy `.env.example` to `.env`. These values determine *how* the app spins up.

| Variable | Description |
|----------|-------------|
| `PUBLIC_POCKETBASE_URL` | URL of your PocketBase instance (e.g., `http://127.0.0.1:8090`). |
| `PUBLIC_EDGE_BACKEND_URL`| (Web Mode Only) URL for the Node/Edge backend handling requests. |
| `YT_DUMMY_MODE` / `PUBLIC_YT_DUMMY_MODE` | Set to `true` to enable local simulation without hitting real YouTube APIs. |
| `PB_ADMIN_EMAIL` / `PASSWORD`| Credentials used by `scripts/migrate.ts` to apply database schemas. |

### 2. Database Configuration (`t_app_settings`)
Application-specific runtime configurations live inside the PocketBase `t_app_settings` collection (Key-Value store). 
- `default_category_id`: The default YouTube category ID for uploads (e.g., "22" for People & Blogs).
- `max_concurrent_uploads`: Controls how many videos the batch processor attempts simultaneously.

*Note: These can be edited directly in the PocketBase Admin UI (`/_/`) and are hot-reloaded by the client via the `PocketBaseService`.*

### 3. YouTube API Configuration
To use the application securely across platforms, you must provision Google Cloud credentials. 

Please see the comprehensive [YouTube OAuth Setup Guide](./YOUTUBE_OAUTH_SETUP.md) for step-by-step instructions on configuring your Google Cloud Project, enabling the YouTube Data API v3, and generating the necessary Client ID and Client Secret.

*Where do they go?*
In the UI, navigate to "Channel Management" -> "Add New Channel". Enter your Client ID and Secret. This configuration is then **Brotli-compressed** and securely stored in the `s_channels` collection under the `youtube_config_brotli_b64` field. The backend decompresses it only at the boundaries when making the OAuth requests.

## 🏗 CI/CD & Cross-Platform Builds

This repository is fully configured for automated testing and releases via **GitHub Actions** (`.github/workflows/ci.yml`).

### Supported Platforms:
- **Desktop (Windows, macOS, Linux):** Tauri compiles native binaries automatically in the CI pipeline using `@tauri-apps/tauri-action`. The outputs (.msi, .app, .dmg, .deb) are attached to GitHub Draft Releases automatically on push.
- **Web:** Astro compiles a static site/SSR bundle via `npm run build`, which can be easily deployed to Vercel, Netlify, or Cloudflare Pages.
- **Mobile (iOS/Android):** Code is architected to support Tauri Mobile primitives. You can initialize mobile targets locally using `npx tauri android init` and `npx tauri ios init` and build natively via Android Studio/Xcode or specialized mobile CI runners.

### CI/CD Flow (On Push/PR):
1. **Setup:** Initializes Node (Bun) and Rust toolchains across `ubuntu-latest`, `macos-latest`, and `windows-latest`.
2. **Quality Control:** Runs formatting, type-checking, and `vitest` suites ensuring cross-layer integrity.
3. **Backend Validation:** Runs `cargo test` to validate Tauri command inputs and output payloads.
4. **Native Build:** Compiles the application down to small, fast native desktop binaries.

## 🏗 System Architecture

The project uses a **Dynamic Multi-Tenant Bootstrap** architecture:
- **Main Registry**: A central PocketBase that maps tenants to their infrastructure.
- **Dynamic Context**: The frontend bootstraps by hitting the registry and reconfiguring its services to point to the client's dedicated PocketHost instance.
- **Isomorphic Services**: All logic (YouTube, Compression, Storage) is tenant-agnostic and relies on dynamic Effect-TS Layers.

## 🧪 Testing Strategy & Execution Guide

The project maintains a rigorous, multi-layered quality assurance matrix designed to validate the stability of client databases, the Rust decompression pipeline, and parallel Effect-TS bulk stream processors.

### 1. Backend Decompression Verification (Rust)
The Rust native backend employs base64-decoded Brotli decompression to unpack compressed payloads (such as large descriptions and channel configurations) seamlessly before executing uploads.
- **Run Rust Unit & Decompression Tests**:
  ```bash
  cd src-tauri && cargo test
  ```
  *This compiles and runs the backend tests, validating the Brotli decompression engine (`test_decompression`), baseline decoding integrity, and structured payload decompression (`test_payload_decompression`).*

### 2. Full Integration & Staging Verification (TypeScript/JS)
Our integration suite boots a real, localized test database instance on port `8091`, provisions database channels, stages stream placeholders in bulk, and asserts end-to-end schema, sort order, and Brotli compression roundtrips.
- **Run Integration Tests**:
  ```bash
  just integration
  ```
  *This automatically starts an isolated test PocketBase instance, applies idempotent database migrations, runs our TypeScript integration test suite (`bulk_staging_integration.test.ts`), and shuts down the test database cleanly on completion.*

### 3. Complete Dev & Unit Suite
- **Run All TypeScript/JS Unit Tests**:
  ```bash
  just test
  ```
- **Run Full Validation Suite (CI Simulation)**:
  ```bash
  just validate
  ```
  *This executes the complete lint check, TypeScript compiler validations, unit test suites, and mock environment checks.*

---

## 🚀 Running the Multi-Tenant Stack

To test and run the full stack locally with simulated tenant routing, use this sequential three-terminal workflow:

### Step 1: Boot the Central Registry (Terminal 1)
Simulates the global lookup registry containing connection coordinates for all tenants:
```bash
just main-up
```
*Served on `http://127.0.0.1:8080`. Admin console: `admin@yt-manager.com` / `admin123456`.*

### Step 2: Boot the Client Tenant Database (Terminal 2)
Simulates a dedicated, isolated client tenant database instance:
```bash
just up
```
*Served on `http://127.0.0.1:8090`. Admin console: `admin@yt-manager.com` / `admin123456`.*

### Step 3: Run Sync & Launch Application (Terminal 3)
1. **Synchronize Schema**: Align the schema and register the local development tenant:
   ```bash
   just sync-tenants
   ```
2. **Launch Frontend (Web Mode)**:
   ```bash
   just dev
   ```
   *Connects automatically to the client tenant database. Browse the app in your browser.*
3. **Launch Native Desktop (Tauri Mode)**:
   ```bash
   just tauri
   ```

---

## 📜 Documentation & Standards
- [YOUTUBE_OAUTH_SETUP.md](./YOUTUBE_OAUTH_SETUP.md) - Step-by-step YouTube API provisioning.
- [MULTI_TENANT_OPS.md](./MULTI_TENANT_OPS.md) - Guide for managing tenants, registry properties, and global sync.
- [AGENTS.md](./AGENTS.md) - Engineering standards and security mandates.
- [CONTRIBUTING.md](./CONTRIBUTING.md) - Guidelines for contributing.
- [CHANGELOG.md](./CHANGELOG.md) - Project history and updates.
- [dibr.md](./dibr.md) - Developer Initial Build & Run reference.

