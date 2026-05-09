# yt-upload-manager orchestration
# Senior Architect approved workflow

set shell := ["bash", "-c"]

# Display available commands
default:
    @just --list

# --- Setup & Initialize ---

# Full project initialization (deps + bindings + database binary)
setup: install gen-bindings get-pb
    @echo "✅ Project initialized and ready for development."

# Install all dependencies (Frontend + Backend)
install:
    bun install
    cd src-tauri && cargo fetch

# Download PocketBase binary if not in PATH
get-pb:
    #!/usr/bin/env bash
    if command -v pocketbase &> /dev/null; then
        echo "✅ PocketBase already in PATH"
    elif [ -f "./pocketbase" ] || [ -f "./pocketbase.exe" ]; then
        echo "✅ PocketBase already exists in project root"
    else
        echo "📥 Downloading PocketBase..."
        VERSION="0.23.1"
        OS_RAW=$(uname -s | tr '[:upper:]' '[:lower:]')
        
        # Map OS
        if [[ "$OS_RAW" == *"linux"* ]]; then
            OS="linux"
        elif [[ "$OS_RAW" == *"darwin"* ]]; then
            OS="darwin"
        elif [[ "$OS_RAW" == *"mingw"* || "$OS_RAW" == *"msys"* || "$OS_RAW" == *"cygwin"* || "$OS_RAW" == *"windows"* ]]; then
            OS="windows"
        else
            OS="linux" # Fallback
        fi
        
        # Map Architecture
        ARCH_RAW=$(uname -m)
        if [[ "$ARCH_RAW" == "x86_64" || "$ARCH_RAW" == "amd64" ]]; then
            ARCH="amd64"
        elif [[ "$ARCH_RAW" == "arm64" || "$ARCH_RAW" == "aarch64" ]]; then
            ARCH="arm64"
        else
            ARCH="amd64" # Fallback
        fi

        URL="https://github.com/pocketbase/pocketbase/releases/download/v${VERSION}/pocketbase_${VERSION}_${OS}_${ARCH}.zip"
        echo "🔗 OS: $OS, ARCH: $ARCH"
        echo "🔗 URL: $URL"
        
        # Use curl with retries
        curl -L --retry 3 --retry-delay 2 "$URL" -o pb.zip
        unzip -o pb.zip
        rm pb.zip
        chmod +x pocketbase || true
        [ -f pocketbase.exe ] && chmod +x pocketbase.exe || true
        echo "✅ PocketBase downloaded."
    fi

# Regenerate TypeScript bindings from Rust source
gen-bindings:
    @echo "⚙️  Generating TypeScript bindings..."
    cd src-tauri && cargo test export_bindings -- --quiet
    @echo "✅ Bindings synchronized to src/bindings/youtube_types.ts"

# Run Continuous Integration suite
ci: test integration build-web
    @echo "✅ CI suite passed."

# Build all target artifacts
build-all: build-web build-tauri
    @echo "📦 All platform artifacts (Web + Desktop) built successfully."

# Automate EVERYTHING: Setup, Test, and Build
full-check: setup ci build-all
    @echo "🚀 COMPLETE AUTOMATION SUCCESSFUL: Project is fully verified and built."

# --- Development ---

# Start Astro development server (Web mode)
dev:
    bun dev

# Start Tauri development environment (Desktop mode)
tauri:
    bun tauri dev

# Start PocketBase and apply migrations automatically (Local/Tenant DB)
up: db-stop get-pb
    #!/usr/bin/env bash
    set -e
    echo "🚀 Preparing Local/Tenant PocketBase..."
    
    # Determine the correct binary
    if [ -f "./pocketbase" ]; then
        PB="./pocketbase"
    elif command -v pocketbase &> /dev/null; then
        PB="pocketbase"
    else
        echo "❌ PocketBase binary not found. Run 'just get-pb' first."
        exit 1
    fi

    # Ensure Admin account exists BEFORE serving
    echo "👤 Ensuring Admin account exists..."
    $PB superuser upsert admin@yt-manager.com admin123456 > /dev/null

    # Start PB in background with auto-migrations DISABLED
    echo "📡 Starting server on http://127.0.0.1:8090..."
    $PB serve --automigrate=false --migrationsDir=pb_migrations_empty &
    PB_PID=$!
    
    # Give it a moment to boot
    sleep 3
    
    echo "⚙️  Running local tenant migrations..."
    PB_ADMIN_EMAIL=admin@yt-manager.com PB_ADMIN_PASSWORD=admin123456 bun run migrate
    
    echo "✅ Local Database is up and migrations applied."
    echo "💡 PocketBase is running in background (PID: $PB_PID). Use 'just db-stop' to kill it."

# --- Multi-Tenant Architecture ---

# Start the Main Registry Database (simulating the central node)
main-up: get-pb
    #!/usr/bin/env bash
    set -e
    echo "🚀 Preparing MAIN Registry PocketBase..."
    # Ensure superuser exists
    ./pocketbase superuser upsert --dir=pb_data_main admin@yt-manager.com admin123456 > /dev/null
    
    echo "📡 Starting MAIN server on http://127.0.0.1:8080..."
    ./pocketbase serve --http=127.0.0.1:8080 --dir=pb_data_main --automigrate=false --migrationsDir=pb_migrations_empty &
    PB_MAIN_PID=$!
    sleep 3
    
    echo "⚙️  Running Main DB migrations..."
    MAIN_POCKETBASE_URL=http://127.0.0.1:8080 bun run scripts/migrate-main.ts
    
    echo "✅ Main Database is up."
    echo $PB_MAIN_PID > .main_pb_pid
    echo "💡 Run 'just main-stop' to kill it."

main-stop:
    @[ -f .main_pb_pid ] && kill $(cat .main_pb_pid) && rm .main_pb_pid && echo "🛑 Main PB stopped." || true

# Programmatically align schemas across ALL registered tenant databases
sync-tenants:
    bun run scripts/sync-all-tenants.ts

# Add or update a property for a tenant in the registry
# Usage: just set-tenant-prop <slug> <key> <value> [category] [is_secret]
set-tenant-prop slug key value category='general' is_secret='false':
    bun run scripts/add-tenant-property.ts {{slug}} {{key}} {{value}} {{category}} {{is_secret}}



# --- Quality & Validation ---

# Run full integration tests with a real PocketBase instance
integration: stop-test-pb test-pb
    #!/usr/bin/env bash
    set -e
    echo "🧪 Running Integration Tests..."
    # Apply migrations to test DB
    POCKETBASE_URL=http://127.0.0.1:8091 PB_ADMIN_EMAIL=test@example.com PB_ADMIN_PASSWORD=test123456 bun run migrate
    
    # Run vitest targeting the integration test file
    RUN_INTEGRATION_TESTS=1 VITE_TEST_PB_URL=http://127.0.0.1:8091 bun run test src/test/integration_pocketbase.test.ts
    
    just stop-test-pb
    echo "✅ Integration tests passed."

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

# Start an isolated PocketBase for integration testing
test-pb: get-pb
    #!/usr/bin/env bash
    set -e
    echo "🧪 Preparing Test PocketBase..."
    # Kill any existing test PB
    lsof -t -i :8091 | xargs kill -9 2>/dev/null || true
    rm -rf pb_data_test
    
    # Create superuser BEFORE serving
    ./pocketbase superuser upsert --dir=pb_data_test test@example.com test123456 > /dev/null
    
    echo "📡 Starting Test server on http://127.0.0.1:8091..."
    ./pocketbase serve --http=127.0.0.1:8091 --dir=pb_data_test --automigrate=false --migrationsDir=pb_migrations_empty &
    PB_PID=$!
    sleep 2
    
    echo "✅ Test Database is ready on port 8091."
    echo $PB_PID > .test_pb_pid

stop-test-pb:
    @[ -f .test_pb_pid ] && kill $(cat .test_pb_pid) && rm .test_pb_pid && echo "🛑 Test PB stopped." || true

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
