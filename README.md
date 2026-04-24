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

## 💻 Local Setup & Development

### 1. Enter the Environment
```bash
nix develop
```

### 2. Install Dependencies
```bash
bun install
```

### 3. Setup PocketBase
Ensure you have a PocketBase instance running.
Run the migration to set up the optimized schema:
```bash
bun run migrate
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
