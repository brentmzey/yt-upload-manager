# Developer Initial Build & Run (DIBR) - YouTube Upload Manager

This document provides a low-level reference for the initial setup and build process of the YouTube Upload Manager. For daily development, use the `just` commands documented in the [README.md](./README.md).

## 🧱 Environment Bootstrap

### 1. Nix Pinned Environment
The project uses Nix to provide a deterministic environment.
- **Command**: `nix develop`
- **Effect**: Loads Node.js, Bun, Rust, and PocketBase into your shell.

### 2. Dependency Resolution
We use `bun` for the frontend and `cargo` for the backend.
```bash
just install
```

## 🛠 Build & Schema Alignment

### PocketBase Migration
Align your local PocketBase instance with the optimized schema:
```bash
just up
```
This command starts PocketBase in the background, creates a default superuser, and runs the step-wise migration script.

### Type Linkage (Bindings)
Ensure the Rust backend and TypeScript frontend are in sync:
```bash
just gen-bindings
```

## 🚀 Execution Reference

### Development Mode (Desktop)
```bash
just tauri
```

### Web Mode
```bash
just dev
```

### Validation
```bash
just validate
```

## 📋 Common Troubleshooting
- **Command Not Found**: Ensure you are inside the `nix develop` shell.
- **Port 8090 Already in Use**: Run `just db-stop` to clear any stale PocketBase instances.
- **Binding Mismatch**: Run `just gen-bindings` to regenerate the TypeScript types from Rust.
- **Cache Issues**: Run `just fix-cache` to wipe `node_modules/.vite` and `node_modules/.astro`.
