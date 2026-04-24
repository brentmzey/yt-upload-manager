# yt-upload-manager orchestration

default:
    just --list

# --- Development ---

# Run the full development environment (Astro + Tauri)
dev:
    bun dev

# Run tauri in dev mode
tauri-dev:
    bun tauri dev

# --- Database (PocketBase) ---

# Start PocketBase and run migrations
db-up:
    (pocketbase serve &) && sleep 2 && bun migrate

# Run migrations on an already running instance
migrate:
    bun migrate

# Start PocketBase in a clean state for testing
db-test-up:
    rm -rf pb_data_test
    pocketbase serve --dir pb_data_test

# --- Build & CI ---

# Build the project (web only)
build:
    bun build

# Build tauri app
tauri-build:
    bun tauri build

# Install dependencies
install:
    bun install

# Clean build artifacts
clean:
    rm -rf dist src-tauri/target pb_data pb_data_test

# --- Quality ---

# Run all tests
test:
    bun run test

# Run tests with coverage
test-cov:
    bun run test:coverage

# Run linting
lint:
    bun x tsc --noEmit

# Check environment health
check-env:
    bun --version
    node --version
    rustc --version
    cargo --version
    pocketbase version

# Attempt to fix esbuild issues in Nix
fix-esbuild:
    rm -rf node_modules/.vite
    rm -rf node_modules/.astro
    bun install

# Generate TS bindings from Rust
gen-bindings:
    cd src-tauri && cargo test export_bindings
