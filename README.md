# YouTube Upload Manager

A 12-factor, multi-channel YouTube management application built with **Tauri 2.0**, **Astro.js**, **React**, and **Effect-TS**.

## 🚀 Key Features
- **Multi-Channel Design**: Securely manage multiple YouTube accounts with isolated configurations.
- **Batch Operations**: Bulk upload videos and schedule upcoming live streams with high concurrency.
- **Brotli Optimized Storage**: Transparently compresses large metadata fields using Brotli for high-performance PocketBase persistence.
- **Cross-Platform**: Run as a native Desktop app (macOS, Windows, Linux), Mobile app (Android, iOS), or in the Browser.
- **Functional Programming**: Built with [Effect](https://effect.website/) for robust error handling and type-safe async pipelines.

## 🛠 Prerequisites
- **Nix**: (Recommended) To ensure a consistent build environment.
- **Bun**: For fast JavaScript dependency management.
- **Rust**: For the Tauri backend.

## 🛠 Orchestration & Development

This project uses `just` for task orchestration. If you have `just` installed, you can use these commands:

### Development
- `just dev`: Start the Astro development server (Web mode).
- `just tauri-dev`: Start the Tauri application in development mode (Desktop mode).
- `just gen-bindings`: Regenerate TypeScript bindings from Rust source code.

### Database (PocketBase)
- `just db-up`: Start PocketBase in the background and run all migrations.
- `just migrate`: Run database migrations on an already running PocketBase instance.
- `just db-test-up`: Start a clean, isolated PocketBase instance for testing.

### Quality & Testing
- `just lint`: Run TypeScript type checking.
- `just test`: Run the full Vitest test suite.
- `just test-cov`: Run tests and generate a coverage report.
- `just check-env`: Verify the health of your local development environment.
- `just fix-esbuild`: Clear Astro/Vite caches to resolve common environment issues.

### Build
- `just build`: Build the web frontend.
- `just tauri-build`: Build the production-ready Tauri native application.
- `just clean`: Remove all build artifacts and temporary database data.

## 🚀 Recent Improvements
- **Centralized Navigation**: New `App` component for seamless switching between Dashboard, Channels, and Settings.
- **Channel Management**: Dedicated view for managing authorized YouTube accounts.
- **System Monitoring**: Real-time CPU and Job status integrated into the header (via Rust backend).
- **Automation**: Integrated `just` for better developer experience and environment troubleshooting.

## 💻 Local Setup

## 📜 Documentation
- [AGENTS.md](./AGENTS.md) - Engineering standards and security mandates.
- [CONTRIBUTING.md](./CONTRIBUTING.md) - Guidelines for contributing.
- [CHANGELOG.md](./CHANGELOG.md) - Project history and updates.
- [dibr.md](./dibr.md) - Developer Initial Build & Run reference.
