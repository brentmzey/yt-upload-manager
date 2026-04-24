# YT Upload Manager

A 12-factor, multi-tenant YouTube management application built with **Tauri 2.0**, **Astro.js**, **React**, and **Effect-TS**.

## 🚀 Key Features
- **Multi-Tenant Design**: Securely manage multiple YouTube accounts with isolated configurations.
- **Batch Operations**: Bulk upload videos and schedule upcoming live streams with high concurrency.
- **Dynamic Metadata Enrichment**: Template-based metadata (titles, descriptions) that injects tenant-specific variables.
- **Functional Programming**: Built with [Effect](https://effect.website/) for robust error handling and type-safe async pipelines.
- **12-Factor Ready**: Externalized configuration via PocketBase and environment variables.
- **Cross-Platform**: Native desktop experience on Windows, macOS, and Linux via Tauri.

## 🛠 Prerequisites
- **Nix**: (Recommended) To ensure a consistent build environment.
- **Bun**: For fast JavaScript dependency management.
- **Rust**: For the Tauri backend.

## 💻 Local Setup & Development

### 1. Enter the Environment
This project uses Nix to pin specific versions of Node, Rust, and system libraries.
```bash
nix develop
```

### 2. Install Dependencies
```bash
bun install
```

### 3. Setup PocketBase
Ensure you have a PocketBase instance running. By default, the app looks for `http://127.0.0.1:8090`.
Set your environment variables in a `.env` file:
```env
PUBLIC_POCKETBASE_URL=https://your-pockethost-instance.io
```

### 4. Run Development Mode
```bash
bun tauri dev
```

## 🏗 Building for Production
```bash
bun tauri build
```

## 📜 Documentation
- [AGENTS.md](./AGENTS.md) - Engineering standards and security mandates.
- [CONTRIBUTING.md](./CONTRIBUTING.md) - Guidelines for contributing.
- [CHANGELOG.md](./CHANGELOG.md) - Project history and updates.
- [dibr.md](./dibr.md) - Developer Initial Build & Run reference.
