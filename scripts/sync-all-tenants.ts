import PocketBase from 'pocketbase';
import { spawn } from 'child_process';

const MAIN_PB_URL = process.env.MAIN_POCKETBASE_URL || 'http://127.0.0.1:8080';
const MAIN_PB_ADMIN_EMAIL = process.env.MAIN_PB_ADMIN_EMAIL || 'admin@yt-manager.com';
const MAIN_PB_ADMIN_PASSWORD = process.env.MAIN_PB_ADMIN_PASSWORD || 'admin123456';

const pb = new PocketBase(MAIN_PB_URL);

async function runMigrationForTenant(tenant: any) {
  return new Promise<void>((resolve, reject) => {
    console.log(`\n========================================`);
    console.log(`🚀 Syncing Tenant: ${tenant.client_name} (${tenant.id})`);
    console.log(`🔗 Target URL: ${tenant.client_db_url}`);
    console.log(`========================================`);

    const env = {
      ...process.env,
      POCKETBASE_URL: tenant.client_db_url,
      PB_ADMIN_EMAIL: tenant.admin_email,
      PB_ADMIN_PASSWORD: tenant.admin_password,
      TENANT_ID: tenant.id,
    };

    const child = spawn('bun', ['run', 'scripts/migrate.ts'], {
      env,
      stdio: 'inherit',
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ Successfully synced tenant: ${tenant.client_name}`);
        resolve();
      } else {
        console.error(`❌ Failed to sync tenant: ${tenant.client_name} (Exit code: ${code})`);
        reject(new Error(`Migration failed with code ${code}`));
      }
    });
  });
}

async function run() {
  try {
    console.log(`📡 Connecting to Main DB at ${MAIN_PB_URL}...`);
    // Need to authenticate as superuser to read registry
    await pb.collection('_superusers').authWithPassword(MAIN_PB_ADMIN_EMAIL, MAIN_PB_ADMIN_PASSWORD);
    console.log(`✅ Authenticated on Main DB.`);

    // 1. Get all active tenants
    const activeTenants = await pb.collection('s_tenants').getFullList({
      filter: 'status = "active"',
    });

    if (activeTenants.length === 0) {
      console.log('ℹ️ No active tenants found in the registry to sync.');
      return;
    }

    console.log(`📋 Found ${activeTenants.length} active tenant(s). Starting global schema alignment...`);

    let successCount = 0;
    let failureCount = 0;

    for (const tenant of activeTenants) {
      try {
        // 2. Fetch properties for this tenant to find DB URI and credentials
        const props = await pb.collection('s_tenant_properties').getFullList({
          filter: `tenant_id = "${tenant.id}"`,
        });

        const getProp = (key: string) => props.find(p => p.property_key === key)?.property_value;

        const dbUrl = getProp('TENANT_PROD_BASE_DB_URI');
        const adminEmail = getProp('TENANT_ADMIN_EMAIL');
        const adminPass = getProp('TENANT_ADMIN_PASSWORD');

        if (!dbUrl || !adminEmail || !adminPass) {
          console.error(`⚠️ Missing required configuration for tenant ${tenant.tenant_name}. Skipping.`);
          failureCount++;
          continue;
        }

        await runMigrationForTenant({
          client_name: tenant.tenant_name,
          id: tenant.id,
          client_db_url: dbUrl,
          admin_email: adminEmail,
          admin_password: adminPass,
        });
        
        successCount++;
      } catch (e) {
        failureCount++;
        console.error(`⚠️ Skipping to next tenant after failure.`);
      }
    }

    console.log(`\n🎉 Global Sync Complete.`);
    console.log(`✅ Succeeded: ${successCount}`);
    if (failureCount > 0) {
      console.log(`❌ Failed: ${failureCount}`);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Global sync error:', error);
    process.exit(1);
  }
}

run();
