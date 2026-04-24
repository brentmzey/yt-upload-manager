# Developer Initial Build & Run (DIBR) - YouTube Upload Manager

This document provides a low-level reference for the initial setup and build process of the YouTube Upload Manager.

## 🧱 Environment Bootstrap

### 1. Nix Pinned Environment
The project uses Nix to provide a deterministic environment.
- **Command**: `nix develop`

### 2. Dependency Resolution
We use `bun` for the frontend and `cargo` for the backend.
```bash
bun install
```

## 🛠 Build & Schema Alignment

### PocketBase Migration
Align your local PocketBase instance with the optimized schema:
```bash
bun run migrate
```
This idempotent script sets up `channels`, `batches`, and `staged_videos` with optimized indices and Brotli compression hints.

### Frontend (Astro + React)
```bash
bun run build
```

### Type Linkage (Bindings)
Generated automatically during `tauri dev` or manually:
```bash
cd src-tauri && cargo test export_bindings
```

## 🚀 Execution Reference

### Development Mode (Desktop)
```bash
bun tauri dev
```

### Web Mode
```bash
bun dev
```

### Mobile Mode
```bash
bun tauri android dev
bun tauri ios dev
```

## 📋 Common Troubleshooting
- **SDK Errors**: Ensure you are inside the `nix develop` shell.
- **Stale Target**: If you see path errors (e.g., `yt-tenant-manager`), run `rm -rf src-tauri/target`.
