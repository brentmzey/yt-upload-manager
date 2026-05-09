import PocketBase from 'pocketbase';

const MAIN_PB_URL = process.env.MAIN_POCKETBASE_URL || 'http://127.0.0.1:8080';
const MAIN_PB_ADMIN_EMAIL = process.env.MAIN_PB_ADMIN_EMAIL || 'admin@yt-manager.com';
const MAIN_PB_ADMIN_PASSWORD = process.env.MAIN_PB_ADMIN_PASSWORD || 'admin123456';

const pb = new PocketBase(MAIN_PB_URL);

/**
 * Migration Step Definition for the MAIN Multi-Tenant Registry DB
 */
interface MigrationStep {
  id: string;
  description: string;
  run: (pb: PocketBase) => Promise<void>;
}

async function ensureAdmin() {
  try {
    // Try 0.23+ (Superusers collection)
    await pb.collection('_superusers').authWithPassword(MAIN_PB_ADMIN_EMAIL, MAIN_PB_ADMIN_PASSWORD);
    console.log('✅ Authenticated as Superuser on Main DB.');
  } catch (e: any) {
    console.error('❌ Authentication failed on Main DB. Did the "pocketbase superuser upsert" command succeed for the Main DB?');
    throw e;
  }
}

async function ensureMigrationsCollection() {
  try {
    await pb.collections.getOne('m_internal_migrations');
  } catch {
    console.log('✨ Creating m_internal_migrations collection...');
    await pb.collections.create({
      name: 'm_internal_migrations',
      type: 'base',
      fields: [
        { name: 'migration_id', type: 'text', required: true, nullable: false },
        { name: 'description', type: 'text' },
      ],
    });
  }
}

async function isApplied(id: string): Promise<boolean> {
  try {
    await pb.collection('m_internal_migrations').getFirstListItem(`migration_id="${id}"`);
    return true;
  } catch {
    return false;
  }
}

async function markApplied(id: string, description: string) {
  await pb.collection('m_internal_migrations').create({
    migration_id: id,
    description: description,
  });
}

const migrations: MigrationStep[] = [
  {
    id: '2026-05-04-001-init-main-tenants-registry',
    description: 'Create robust tenant registry (s_tenants)',
    run: async (pb) => {
      try {
        const existing = await pb.collections.getOne('s_tenants');
        return;
      } catch {}

      await pb.collections.create({
        name: 's_tenants',
        type: 'base',
        system: false,
        fields: [
          { 
            id: 'text3208210256', 
            name: 'id', 
            type: 'text', 
            system: true, 
            primaryKey: true, 
            required: true, 
            pattern: '^[a-z0-9]+$',
            autogeneratePattern: '[a-z0-9]{15}' 
          },
          { id: 'text1579384326', name: 'tenant_name', type: 'text', required: true, system: false },
          { id: 'text2441093337', name: 'tenant_slug', type: 'text', required: true, system: false }, // For subdomain/URL identification
          { id: 'select2063623452', name: 'status', type: 'select', required: true, system: false, values: ['active', 'suspended', 'trial', 'onboarding'] },
          { id: 'json3018210263', name: 'metadata_json', type: 'json', system: false },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_s_tenants_slug ON s_tenants (tenant_slug)',
        ],
      });
    }
  },
  {
    id: '2026-05-04-002-init-main-tenant-properties',
    description: 'Create extensible tenant properties (s_tenant_properties) for key-value config',
    run: async (pb) => {
      try {
        const existing = await pb.collections.getOne('s_tenant_properties');
        return;
      } catch {}

      const tenants = await pb.collections.getOne('s_tenants');
      await pb.collections.create({
        name: 's_tenant_properties',
        type: 'base',
        system: false,
        fields: [
          { 
            id: 'text3208210256', 
            name: 'id', 
            type: 'text', 
            system: true, 
            primaryKey: true, 
            required: true, 
            pattern: '^[a-z0-9]+$',
            autogeneratePattern: '[a-z0-9]{15}' 
          },
          { 
            id: 'relation310459523',
            name: 'tenant_id', 
            type: 'relation', 
            required: true,
            system: false,
            collectionId: tenants.id,
            cascadeDelete: true,
            maxSelect: 1,
          },
          { id: 'text1579384326', name: 'property_key', type: 'text', required: true, system: false },
          { id: 'json1579384327', name: 'property_value', type: 'json', required: true, system: false },
          { id: 'text1579384328', name: 'category', type: 'text', system: false },
          { id: 'bool3018210261', name: 'is_secret', type: 'bool', system: false }, // UI should mask these
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_s_tenant_prop_unique ON s_tenant_properties (tenant_id, property_key)',
          'CREATE INDEX idx_s_tenant_prop_key ON s_tenant_properties (property_key)',
        ],
      });
    }
  },
];

async function run() {
  try {
    console.log(`🚀 Starting step-wise migrations on MAIN DB at ${MAIN_PB_URL}...`);
    await ensureAdmin();
    await ensureMigrationsCollection();

    for (const m of migrations) {
      const alreadyApplied = await isApplied(m.id);
      if (alreadyApplied) {
        console.log(`🔄 Re-verifying applied migration: ${m.id} (${m.description})...`);
      } else {
        console.log(`⚙️  Applying migration: ${m.id} (${m.description})...`);
      }
      
      try {
        await m.run(pb);
        if (!alreadyApplied) {
           await markApplied(m.id, m.description);
           console.log(`✅ Applied: ${m.id}`);
        } else {
           console.log(`✅ Verified/Updated: ${m.id}`);
        }
      } catch (e: any) {
        if (e.response && e.response.data) {
          console.error(`❌ Validation Error details:`, JSON.stringify(e.response.data, null, 2));
        }
        throw e;
      }
    }

    console.log('✨ All Main DB migrations reconciled.');
  } catch (error) {
    console.error('❌ Migration error:', error);
    process.exit(1);
  }
}

run();
