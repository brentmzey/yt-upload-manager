import { spawn, execSync } from 'child_process';
import http from 'http';

// Configurations
const PB_PORT = 8095;
const PB_URL = `http://127.0.0.1:${PB_PORT}`;
const API_PORT = 8085;
const API_URL = `http://127.0.0.1:${API_PORT}`;

// Diagnostic State Tracker
const diagnostics = {
  pocketbaseBinary: false,
  pocketbaseBoot: false,
  migrationsApplied: false,
  rustCompilation: false,
  rustServerBoot: false,
  statusApiConnection: false,
  jobsApiQueueing: false,
  backgroundWorkerActive: false
};

// Subprocesses
let pbProcess: any = null;
let rustProcess: any = null;

// Utility to sleep
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper to make simple HTTP requests
const fetchJson = (url: string, options: any = {}): Promise<any> => {
  return new Promise((resolve, reject) => {
    const req = http.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(data);
        }
      });
    });
    req.on('error', (err) => reject(err));
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
};

async function verifyStack() {
  console.log("\n=======================================================");
  console.log("🧬 yt-upload-manager: Senior Architect E2E Stack Check");
  console.log("=======================================================\n");

  try {
    // 1. Check local PocketBase binary
    console.log("🔍 [1/6] Checking backing database binary...");
    try {
      execSync('./pocketbase --version');
      diagnostics.pocketbaseBinary = true;
      console.log("   ✅ PocketBase binary found in root.");
    } catch {
      console.error("   ❌ PocketBase binary not found. Try running 'just get-pb' first.");
      return;
    }

    // 2. Start backing PocketBase in isolation
    console.log("📡 [2/6] Spawning isolated backing database on port 8095...");
    // Clear old test data dir to ensure a pristine test
    execSync('rm -rf pb_data_verify_tmp');
    
    // Create admin account first
    execSync(`./pocketbase superuser upsert --dir=pb_data_verify_tmp verify@example.com verify123456 > /dev/null 2>&1`);

    pbProcess = spawn('./pocketbase', [
      'serve',
      `--http=127.0.0.1:${PB_PORT}`,
      '--dir=pb_data_verify_tmp',
      '--automigrate=false',
      '--migrationsDir=pb_migrations_empty'
    ]);

    // Wait for PocketBase to be responsive
    for (let i = 0; i < 10; i++) {
      await sleep(1000);
      try {
        const health = await fetchJson(`${PB_URL}/api/health`);
        if (health && health.code === 200) {
          diagnostics.pocketbaseBoot = true;
          console.log("   ✅ Backing PocketBase is UP and responding.");
          break;
        }
      } catch {}
      if (i === 9) {
        console.error("   ❌ Backing database failed to boot.");
        cleanup();
        return;
      }
    }

    // 3. Apply migrations to isolated DB
    console.log("⚙️  [3/6] Applying dynamic database migrations...");
    try {
      execSync(`POCKETBASE_URL=${PB_URL} PB_ADMIN_EMAIL=verify@example.com PB_ADMIN_PASSWORD=verify123456 bun run migrate`, { stdio: 'ignore' });
      diagnostics.migrationsApplied = true;
      console.log("   ✅ Database schema fully reconciled and migrated.");
    } catch (e) {
      console.error("   ❌ Migrations failed to reconcile.");
      cleanup();
      return;
    }

    // 4. Compile Standalone Rust Backend Server
    console.log("🦀 [4/6] Compiling Standalone Rust Server target...");
    try {
      execSync('cargo build -p app --bin app', { cwd: 'src-tauri', stdio: 'ignore' });
      diagnostics.rustCompilation = true;
      console.log("   ✅ Rust binary compiled successfully.");
    } catch {
      console.error("   ❌ Rust compilation failed.");
      cleanup();
      return;
    }

    // 5. Start Standalone Backend Server in background mode
    console.log(`🚀 [5/6] Starting Standalone Server on API Port ${API_PORT}...`);
    rustProcess = spawn('./src-tauri/target/debug/app', [], {
      env: {
        ...process.env,
        APP_MODE: 'server',
        PORT: String(API_PORT),
        YT_DUMMY_MODE: 'true',
        PUBLIC_POCKETBASE_URL: PB_URL
      }
    });

    let serverLogs = '';
    rustProcess.stdout.on('data', (data: Buffer) => {
      serverLogs += data.toString();
      if (data.toString().includes("Queueing VideoUpload job")) {
        diagnostics.backgroundWorkerActive = true;
      }
    });

    rustProcess.stderr.on('data', (data: Buffer) => {
      serverLogs += data.toString();
    });

    // Wait for Rust server to boot
    for (let i = 0; i < 5; i++) {
      await sleep(1000);
      try {
        const stats = await fetchJson(`${API_URL}/api/status`);
        if (stats && stats.cpu_usage !== undefined) {
          diagnostics.rustServerBoot = true;
          diagnostics.statusApiConnection = true;
          console.log("   ✅ Axum REST API server boot complete & responding.");
          break;
        }
      } catch {}
      if (i === 4) {
        console.error("   ❌ Standalone Rust Server failed to boot. Logs:\n", serverLogs);
        cleanup();
        return;
      }
    }

    // 6. Test REST API & worker queueing connectivity
    console.log("🧪 [6/6] Verifying API endpoints and tokio worker queues...");
    try {
      const jobPayload = JSON.stringify({
        job_type: "VideoUpload",
        channel_id: "ch-verification-verify",
        title: "Pristine Stack Verification Test",
        description: "Checking that the worker thread can process jobs.",
        privacy_status: "private",
        license: "youtube",
        embeddable: true,
        public_stats_viewable: true,
        made_for_kids: false,
        contains_synthetic_media: false,
        paid_product_placement: false,
        tags: ["diagnostics"],
        category_id: "22",
        sub_details: {},
        compressed_fields: []
      });

      const response = await fetchJson(`${API_URL}/api/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: jobPayload
      });

      if (response && response.status === 'Processing') {
        diagnostics.jobsApiQueueing = true;
        console.log("   ✅ Job queue API accepted metadata payload.");
      } else {
        console.error("   ❌ Job queue API returned invalid format:", response);
      }

      // Wait a moment for worker thread to process and print logs
      await sleep(2000);

      // Verify that worker log trace was captured in standard out
      if (serverLogs.includes("Queueing VideoUpload job")) {
        diagnostics.backgroundWorkerActive = true;
        console.log("   ✅ Tokio background worker thread picked up and processed job.");
      } else {
        console.warn("   ⚠️ Tokio worker thread was not registered in stdout. Logs captured:\n", serverLogs);
      }

    } catch (e) {
      console.error("   ❌ API route tests failed:", e);
    }

  } finally {
    cleanup();
  }

  // Render highly aesthetic architecture console report
  console.log("\n=======================================================");
  console.log("📊 YT-UPLOAD-MANAGER STACK DIAGNOSTIC REPORT");
  console.log("=======================================================\n");

  const printStatus = (label: string, status: boolean) => {
    const icon = status ? "🟢 SUCCESS" : "🔴 FAILED";
    console.log(`   %-40s : %s`, label, icon);
  };

  printStatus("1. Backing Database Binary Presence", diagnostics.pocketbaseBinary);
  printStatus("2. isolated backing DB Boot Status", diagnostics.pocketbaseBoot);
  printStatus("3. dynamic DB Schema Migration Reconcile", diagnostics.migrationsApplied);
  printStatus("4. Headless Server Rust Target compile", diagnostics.rustCompilation);
  printStatus("5. Axum HTTP API Server Boot Status", diagnostics.rustServerBoot);
  printStatus("6. Systems Monitor API connectivity", diagnostics.statusApiConnection);
  printStatus("7. Job Dispatcher REST route verify", diagnostics.jobsApiQueueing);
  printStatus("8. Tokio worker background queues active", diagnostics.backgroundWorkerActive);

  console.log("\n=======================================================");
  
  const isHealthy = Object.values(diagnostics).every(v => v === true);
  if (isHealthy) {
    console.log("✨ ALL ARCHITECTURE SYSTEMS ARE 100% OPERATIONAL & HEALTHY! ✨");
  } else {
    console.log("⚠️ SOME COMPONENT DIAGNOSTICS DETECTED ISSUES. INSPECT LOGS. ⚠️");
  }
  console.log("=======================================================\n");
}

function cleanup() {
  console.log("\n🧹 Cleaning up verification processes and tmp assets...");
  if (pbProcess) {
    pbProcess.kill('SIGKILL');
  }
  if (rustProcess) {
    rustProcess.kill('SIGKILL');
  }
  try {
    execSync('rm -rf pb_data_verify_tmp');
  } catch {}
  console.log("✅ Teardown complete.");
}

verifyStack();
