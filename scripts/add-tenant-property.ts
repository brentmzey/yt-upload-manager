import PocketBase from 'pocketbase';

/**
 * UTILITY: Add or Update a Tenant Property in the System Registry
 * 
 * Usage:
 * MAIN_PB_ADMIN_EMAIL=... MAIN_PB_ADMIN_PASSWORD=... bun run scripts/add-tenant-property.ts <tenant_slug> <key> <value> [category] [is_secret]
 */

const MAIN_PB_URL = process.env.MAIN_POCKETBASE_URL || 'https://yt-upload-manager-system-registry.pockethost.io/';
const MAIN_PB_ADMIN_EMAIL = process.env.MAIN_PB_ADMIN_EMAIL;
const MAIN_PB_ADMIN_PASSWORD = process.env.MAIN_PB_ADMIN_PASSWORD;

const pb = new PocketBase(MAIN_POCKETBASE_URL);

async function run() {
  const [slug, key, valueRaw, category = 'general', isSecretStr = 'false'] = process.argv.slice(2);

  if (!slug || !key || !valueRaw) {
    console.log('Usage: bun run add-tenant-property.ts <tenant_slug> <key> <value> [category] [is_secret]');
    process.exit(1);
  }

  if (!MAIN_PB_ADMIN_EMAIL || !MAIN_PB_ADMIN_PASSWORD) {
    console.error('❌ Error: MAIN_PB_ADMIN_EMAIL and MAIN_PB_ADMIN_PASSWORD environment variables are required.');
    process.exit(1);
  }

  try {
    await pb.collection('_superusers').authWithPassword(MAIN_PB_ADMIN_EMAIL, MAIN_PB_ADMIN_PASSWORD);
    
    // 1. Resolve Tenant
    const tenant = await pb.collection('s_tenants').getFirstListItem(`tenant_slug="${slug}"`);
    
    // 2. Parse Value (try JSON, fallback to string)
    let value = valueRaw;
    try {
      value = JSON.parse(valueRaw);
    } catch {
      // Keep as string
    }

    const isSecret = isSecretStr === 'true';

    // 3. Upsert Property
    try {
      const existing = await pb.collection('s_tenant_properties').getFirstListItem(`tenant_id="${tenant.id}" && property_key="${key}"`);
      await pb.collection('s_tenant_properties').update(existing.id, {
        property_value: value,
        category,
        is_secret: isSecret,
      });
      console.log(`✅ Updated property "${key}" for tenant "${slug}"`);
    } catch {
      await pb.collection('s_tenant_properties').create({
        tenant_id: tenant.id,
        property_key: key,
        property_value: value,
        category,
        is_secret: isSecret,
      });
      console.log(`✅ Created property "${key}" for tenant "${slug}"`);
    }

  } catch (error: any) {
    console.error('❌ Operation failed:', error.message);
    process.exit(1);
  }
}

run();
