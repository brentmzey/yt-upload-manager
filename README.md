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

## 🌐 12-Factor Configuration

Configuration is strictly managed via environment variables. Copy `.env.example` to `.env` to get started.

| Variable | Description | Default |
|----------|-------------|---------|
| `PUBLIC_POCKETBASE_URL` | URL of the PocketBase instance | `http://127.0.0.1:8090` |
| `PB_ADMIN_EMAIL` | Admin email for migrations | `admin@yt-manager.com` |
| `PB_ADMIN_PASSWORD` | Admin password for migrations | `admin123456` |
| `YOUTUBE_CLIENT_ID` | OAuth 2.0 Client ID | (None) |
| `YOUTUBE_CLIENT_SECRET` | OAuth 2.0 Client Secret | (None) |

## 🧪 Testing Strategy

- **Unit Tests**: Located in `src/**/*.test.ts(x)`, powered by Vitest.
- **Binding Tests**: Rust tests that ensure the frontend and backend share identical data structures.
- **Integration**: Handled via Tauri's mock runtime for command testing.

## 📜 Documentation & Standards
- [AGENTS.md](./AGENTS.md) - Engineering standards and security mandates.
- [CONTRIBUTING.md](./CONTRIBUTING.md) - Guidelines for contributing.
- [CHANGELOG.md](./CHANGELOG.md) - Project history and updates.
- [dibr.md](./dibr.md) - Developer Initial Build & Run reference.

## 💻 Local Quickstart

1.  **Enter Env**: `nix develop`
2.  **Initialize**: `just setup`
3.  **Start DB**: `just up`
4.  **Launch App**: `just tauri`
