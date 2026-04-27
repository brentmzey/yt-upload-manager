# yt-upload-manager orchestration
# Senior Architect approved workflow

set shell := ["bash", "-c"]

# Display available commands
default:
    @just --list

# --- Setup & Initialize ---

# Full project initialization (deps + bindings)
setup: install gen-bindings
    @echo "✅ Project initialized and ready for development."

# Install all dependencies (Frontend + Backend)
install:
    bun install
    cd src-tauri && cargo fetch

# Regenerate TypeScript bindings from Rust source
gen-bindings:
    @echo "⚙️  Generating TypeScript bindings..."
    cd src-tauri && cargo test export_bindings -- --quiet
    @echo "✅ Bindings synchronized to src/bindings/youtube_types.ts"

# --- Development ---

# Start Astro development server (Web mode)
dev:
    bun dev

# Start Tauri development environment (Desktop mode)
tauri:
    bun tauri dev

# Start PocketBase and apply migrations automatically
up: db-stop
    @echo "🚀 Starting PocketBase..."
    (pocketbase serve &) && sleep 2 && \
    (pocketbase superuser create {{env_var_or_default("PB_ADMIN_EMAIL", "admin@yt-manager.com")}} {{env_var_or_default("PB_ADMIN_PASSWORD", "admin123456")}} || true) && \
    bun migrate
    @echo "✅ Database is up and migrations applied."

# --- Quality & Validation ---

# Run the full validation suite (Lint + Test + Bindings)
validate: lint test gen-bindings
    @echo "✅ All validations passed."

# Run TypeScript type checking
lint:
    bun x tsc --noEmit

# Run Vitest test suite
test:
    bun run test

# Run tests with coverage reporting
test-cov:
    bun run test:coverage

# Check environment health and tool versions
check-env:
    @echo "--- Tool Versions ---"
    @bun --version | xargs echo "Bun: "
    @node --version | xargs echo "Node:"
    @rustc --version | head -n 1
    @cargo --version
    @pocketbase version || echo "PocketBase: Not found in PATH"

# --- Database Management ---

# Stop any running PocketBase instance
db-stop:
    @-lsof -t -i :8090 | xargs kill -9 2>/dev/null || true
    @echo "🛑 PocketBase stopped."

# Run migrations on a running PocketBase instance
migrate:
    bun migrate

# Wipe all local data and start fresh
reset: db-stop
    rm -rf pb_data pb_data_test
    @echo "🗑️  All local database data cleared."
    just up

# --- Build & Distribution ---

# Build the production web frontend
build-web:
    bun run build

# Build production Tauri binaries for the current platform
build-tauri:
    bun tauri build

# Prepare all production artifacts
dist: build-web build-tauri
    @echo "🎁 Distribution artifacts ready in dist/ and src-tauri/target/release/bundle/"

# --- Utility ---

# Clean all build artifacts
clean:
    rm -rf dist src-tauri/target
    @echo "🧹 Build artifacts cleaned."

# Emergency fix for esbuild/astro cache issues
fix-cache:
    rm -rf node_modules/.vite node_modules/.astro
    bun install
    @echo "🛠️  Caches cleared and dependencies reinstalled."
