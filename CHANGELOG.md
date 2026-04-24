# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0] - 2026-04-24
### Added
- **Batch Management**: Implemented `BatchManager` for bulk YouTube video uploads and live stream scheduling.
- **Cross-Platform Support**: Added foundational support for Web, Mobile (Android/iOS), and Desktop via Tauri 2.0.
- **Brotli Storage Optimization**: Automated Brotli compression/decompression for large text fields in PocketBase, reducing storage and bandwidth.
- **Optimized DB Schema**: Relational schema (Channels -> Batches -> Staged Videos) with optimized indices and cascade deletes.
- **Effect-TS Integration**: Full functional programming pipeline for robust error handling and concurrency.
- **Tightly Linked Types**: End-to-end type safety between Rust backend and TypeScript frontend via `ts-rs`.
- **User Feedback**: Real-time `LogConsole` and granular task-level retry logic.
- **Security**: Strict Content Security Policy (CSP) and regex-injection-safe templating.
- **Infrastructure**: Nix flake for reproducible development environments and idempotent migration scripts.
- **UI/UX**: Modern, ergonomic dashboard layout using Tailwind CSS and Lucide icons.

### Technical Details
- Switched to `Effect` as the primary functional library.
- Implemented `Tauri 2.0` IPC bridge with custom command handlers.
- Automated TypeScript binding generation from Rust structs.
