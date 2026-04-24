# Developer Initial Build & Run (DIBR) - YT Upload Manager

This document provides a low-level reference for the initial setup and build process of the YT Tenant Manager.

## 🧱 Environment Bootstrap

### 1. Nix Pinned Environment
The project is pinned to a specific Nixpkgs hash to avoid breaking changes in the `nixos-unstable` channel (specifically regarding macOS SDK removals).
- **Hash**: `57da00f35314751433939634e94119da49e0b4d4`
- **Command**: `nix develop`

### 2. Dependency Resolution
We use `bun` for the frontend and `cargo` for the backend.
```bash
bun install
```

## 🛠 Build Pipeline

### Frontend (Astro + React)
The frontend is compiled into a static site in the `dist/` directory.
```bash
bun run build
```

### Backend (Tauri + Rust)
The backend is a Rust binary that embeds the frontend assets.
```bash
cd src-tauri && cargo check
```

### Type Linkage (Bindings)
Generated via a specialized test in the Rust library.
```bash
cd src-tauri && cargo test export_bindings
```

## 🚀 Execution Reference

### Development Mode (Hot Reloading)
Launches the Tauri window and the Astro dev server concurrently.
```bash
bun tauri dev
```

### Production Build
Produces the final native installers (e.g., `.dmg`, `.msi`, `.deb`).
```bash
bun tauri build
```

## 📋 Common Troubleshooting
- **SDK Errors**: If you encounter macOS SDK header errors, ensure you are inside the `nix develop` shell.
- **Lockfile Conflicts**: If `bun install` fails, try deleting `node_modules` and `bun.lockb` and running again.
- **Port 4321**: The Astro dev server defaults to `4321`. Ensure no other service is occupying this port.
