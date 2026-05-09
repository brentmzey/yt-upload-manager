# Changelog

All notable changes to this project will be documented in this file.
## [0.2.0] - 2026-05-09
### Added
- **Multi-Tenant Architecture**: Implemented a "Registry + Distributed Node" model, allowing a single frontend to serve multiple clients with dedicated database isolation.
- **System Registry**: Central management database to orchestrate client identities, infrastructure URIs, and configuration properties.
- **Fleet Synchronization**: Automated `just sync-tenants` command to push schema updates and identity mappings to all registered client instances simultaneously.
- **Tenant-Agnostic Frontend**: Automated tenant identification via hostname (Web) or environment overrides (Desktop).
- **Professional Stability Suite**: Finalized `just full-check` automation encompassing setup, cross-platform testing, and full binary compilation.
- **Enhanced Documentation**: Added `MULTI_TENANT_OPS.md` and `STABILITY_REPORT.md` for professional handover.

### Changed
- Refactored Service Layer to use dynamic Effect-TS Layers injected via `TenantProvider`.
- Updated `.gitignore` to reflect professional-grade repository standards.
- Optimized CI/CD pipeline for cross-platform binary notarization readiness.

## [0.1.1] - 2026-05-04
### Added
- **Advanced Stream Scheduling UX**: Ability to bulk-create stream placeholders without uploading video files.
- **Rich Stream Configuration**: Exposed latency preference, auto-start, auto-stop, and DVR options in the staging editor.
- **Database Schema Enrichment**: Added `is_archived`, `notes`, and `metadata_json` columns across core entities for future-proofing and auditing.
- **Performance Indices**: Added database indices on scheduled dates and archiving status.
- **Automated PocketBase Setup**: Scripts now handle `superuser upsert` and port-mapping automatically across all environments to eliminate manual "installer" flows.
- **Documentation**: Added comprehensive `YOUTUBE_OAUTH_SETUP.md` guide for power users.
- **Chronological Staging**: Batch uploads now automatically calculate sequential scheduled start times.
- **YouTube Post-Upload Card**: Fetches real YouTube Video Details and displays them as a rich media card upon successful upload.
- **Order Disclaimer**: Added prominent UI warnings about upload order dependencies.

### Changed
- Switched UUID generation to `uuid` v4 package instead of Web Crypto API.


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
