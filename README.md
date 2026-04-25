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

1. **Clone the repository**
2. **Install dependencies**: `bun install`
3. **Configure Environment**: Copy `.env.example` to `.env` and fill in your values.
4. **Start Database**: `just db-up` (Starts PocketBase and runs migrations)
5. **Start App**: `just tauri-dev` (Desktop) or `just dev` (Web)

## 🌐 Deployment & 12-Factor Configuration

This application follows [12-Factor App](https://12factor.net/) principles, particularly regarding configuration and backing services.

### Environment Variables
Configuration is strictly managed via environment variables.

| Variable | Description | Default |
|----------|-------------|---------|
| `PUBLIC_POCKETBASE_URL` | URL of the PocketBase instance | `http://127.0.0.1:8090` |
| `PUBLIC_EDGE_BACKEND_URL` | API URL for Web/Edge mode | `https://api.yt-manager.com` |
| `PB_ADMIN_EMAIL` | Admin email for migrations | `admin@yt-manager.com` |
| `PB_ADMIN_PASSWORD` | Admin password for migrations | `admin123456` |

### Multi-Tenancy Strategies

#### 1. Isolated Tenants (Dedicated DB) - *Recommended for Enterprise*
Each tenant (e.g., a specific agency or creator) receives a dedicated deployment:
- **Dedicated PocketBase Binary**: Run a separate `pocketbase serve` process per tenant.
- **Dedicated App Instance**: Deploy a separate frontend pointing to the tenant's specific `PUBLIC_POCKETBASE_URL`.
- **Full Isolation**: No data overlap; tenant-specific encryption keys and storage buckets.

#### 2. Shared Multi-Tenancy (Single DB) - *SaaS Model*
Multiple tenants share a single PocketBase instance:
- **Tenant ID Mapping**: Add a `tenant_id` field to `channels`, `batches`, and `staged_videos` collections.
- **Row-Level Security (RLS)**: Configure PocketBase API Rules to restrict access:
  - `listRule`: `@request.auth.id != "" && tenant_id = @request.auth.tenant_id`
- **Dynamic Configuration**: The app detects the tenant context based on the authenticated user's profile.

### Backing Services
- **Storage**: Uses S3-compatible storage (via PocketBase) for video staging and thumbnails.
- **Database**: PocketBase (SQLite + WAL) for high-performance metadata management.

## 📜 Documentation
- [AGENTS.md](./AGENTS.md) - Engineering standards and security mandates.
- [CONTRIBUTING.md](./CONTRIBUTING.md) - Guidelines for contributing.
- [CHANGELOG.md](./CHANGELOG.md) - Project history and updates.
- [dibr.md](./dibr.md) - Developer Initial Build & Run reference.
