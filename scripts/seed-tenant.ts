import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8080');

async function seed() {
  await pb.collection('_superusers').authWithPassword('admin@yt-manager.com', 'admin123456');
  
  // 1. Create Tenant
  const tenant = await pb.collection('s_tenants').create({
    tenant_name: 'Local Development Tenant',
    tenant_slug: 'local-dev',
    status: 'active',
  });

  // 2. Create Properties
  const props = [
    { key: 'TENANT_PROD_BASE_DB_URI', value: 'http://127.0.0.1:8090', category: 'infrastructure' },
    { key: 'TENANT_ADMIN_EMAIL', value: 'admin@yt-manager.com', category: 'auth', is_secret: true },
    { key: 'TENANT_ADMIN_PASSWORD', value: 'admin123456', category: 'auth', is_secret: true },
    { key: 'TENANT_REGION', value: 'us-east-1', category: 'general' },
  ];

  for (const p of props) {
    await pb.collection('s_tenant_properties').create({
      tenant_id: tenant.id,
      property_key: p.key,
      property_value: p.value,
      category: p.category,
      is_secret: p.is_secret || false,
    });
  }

  console.log('✅ Local tenant and properties registered in robust Registry.');
}

seed().catch(console.error);
