# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0] - 2026-04-24
### Added
- **Batch Management**: Implemented `BatchManager` for bulk YouTube video uploads and live stream scheduling.
- **Effect-TS Integration**: Full functional programming pipeline for robust error handling and concurrency.
- **Tightly Linked Types**: End-to-end type safety between Rust backend and TypeScript frontend via `ts-rs`.
- **Enrichment Engine**: Dynamic metadata templating for tenant-specific titles and descriptions.
- **User Feedback**: Real-time `LogConsole` and granular task-level retry logic.
- **Security**: Strict Content Security Policy (CSP) and regex-injection-safe templating.
- **Infrastructure**: Nix flake for reproducible development environments.
- **UI/UX**: Modern, ergonomic dashboard layout using Tailwind CSS and Lucide icons.
- **Backing Services**: PocketBase integration for 12-factor configuration management.

### Technical Details
- Switched to `Effect` as the primary functional library.
- Implemented `Tauri 2.0` IPC bridge with custom command handlers.
- Automated TypeScript binding generation from Rust structs.
