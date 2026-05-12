import PocketBase from 'pocketbase';

const PB_URL = process.env.POCKETBASE_URL || process.env.PUBLIC_POCKETBASE_URL || 'http://127.0.0.1:8090';
const PB_ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL || 'admin@yt-manager.com';
const PB_ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD || 'admin123456';
const TENANT_ID = process.env.TENANT_ID; // Passed from Registry during sync

const pb = new PocketBase(PB_URL);

/**
 * Migration Step Definition
 */
interface MigrationStep {
  id: string;
  description: string;
  run: (pb: PocketBase) => Promise<void>;
}

async function ensureAdmin() {
  try {
    // Try 0.23+ (Superusers collection)
    await pb.collection('_superusers').authWithPassword(PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD);
    console.log('✅ Authenticated as Superuser.');
  } catch (e: any) {
    // If it's a 404, it might be an older PB version (< 0.23.0)
    if (e.status === 404) {
      try {
        // Try legacy admins API
        // @ts-ignore - admins was removed/deprecated in newer SDKs but might still work or need manual fetch
        if (pb.admins) {
          // @ts-ignore
          await pb.admins.authWithPassword(PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD);
        } else {
          // Manual fallback for newer SDK + older PB
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
          
          try {
            const res = await fetch(`${PB_URL}/api/admins/auth-with-password`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: PB_ADMIN_EMAIL, password: PB_ADMIN_PASSWORD }),
              signal: controller.signal
            });
            clearTimeout(timeoutId);
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Legacy auth failed');
            pb.authStore.save(data.token, data.admin);
          } catch (e) {
            clearTimeout(timeoutId);
            throw e;
          }
        }
        console.log('✅ Authenticated as Legacy Admin.');
        return;
      } catch (legacyErr) {
        console.error('❌ Legacy authentication failed.');
      }
    }

    if (e.code === 'ConnectionRefused' || e.message?.includes('ECONNREFUSED')) {
      console.error(`\n❌ ERROR: Could not connect to PocketBase at ${PB_URL}`);
      console.error(`💡 Is the server running? For local testing, run 'just up' in a separate terminal.\n`);
    } else {
      console.error('❌ Authentication failed. Did the "pocketbase superuser/admin create" command succeed?');
    }
    throw e;
  }
}

async function ensureMigrationsCollection() {
  try {
    await pb.collections.getOne('s_internal_migrations');
  } catch {
    console.log('✨ Creating s_internal_migrations collection...');
    await pb.collections.create({
      name: 's_internal_migrations',
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
    await pb.collection('s_internal_migrations').getFirstListItem(`migration_id="${id}"`);
    return true;
  } catch {
    return false;
  }
}

async function markApplied(id: string, description: string) {
  await pb.collection('s_internal_migrations').create({
    migration_id: id,
    description: description,
  });
}

/**
 * STEP-WISE MIGRATIONS
 */
const migrations: MigrationStep[] = [
  {
    id: '2026-05-04-001-init-tenant-identity',
    description: 'Ensure tenant identity and cross-registry mapping',
    run: async (pb) => {
      try {
        await pb.collections.getOne('s_tenant_identity');
      } catch {
        await pb.collections.create({
          name: 's_tenant_identity',
          type: 'base',
          fields: [
            { name: 'tenant_id', type: 'text', required: true, system: false },
            { name: 'registered_name', type: 'text' },
          ],
        });
      }

      if (TENANT_ID) {
        try {
          const list = await pb.collection('s_tenant_identity').getFullList();
          if (list.length > 0) {
            await pb.collection('s_tenant_identity').update(list[0].id, { tenant_id: TENANT_ID });
          } else {
            await pb.collection('s_tenant_identity').create({ tenant_id: TENANT_ID });
          }
          console.log(`🆔 Identity aligned with Registry ID: ${TENANT_ID}`);
        } catch (e) {
          console.error(`⚠️ Failed to set tenant identity: ${e}`);
        }
      }
    }
  },
  {
    id: '2026-05-03-001-init-system-channels',
    description: 'Create system channels collection (s_channels)',
    run: async (pb) => {
      try {
        const existing = await pb.collections.getOne('s_channels');
        existing.listRule = "";
        existing.viewRule = "";
        existing.createRule = "";
        existing.updateRule = "";
        existing.deleteRule = "";
        await pb.collections.update(existing.id, existing);
        return;
      } catch {}

      await pb.collections.create({
        name: 's_channels',
        type: 'base',
        system: false,
        listRule: "",
        viewRule: "",
        createRule: "",
        updateRule: "",
        deleteRule: "",
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
          { id: 'text1579384326', name: 'name', type: 'text', required: true, system: false },
          { id: 'text2441093337', name: 'handle', type: 'text', required: true, system: false },
          { id: 'select2063623452', name: 'status', type: 'select', system: false, values: ['active', 'expired', 'pending'] },
          { id: 'text2793693633', name: 'youtube_config_brotli_b64', type: 'text', required: true, system: false },
          { id: 'text3018210257', name: 'last_error', type: 'text', system: false },
          { id: 'date3018210258', name: 'last_sync_at', type: 'date', system: false },
          { id: 'bool3018210261', name: 'is_archived', type: 'bool', system: false },
          { id: 'text3018210262', name: 'notes', type: 'text', system: false },
          { id: 'json3018210263', name: 'metadata_json', type: 'json', system: false },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_s_channels_handle ON s_channels (handle)',
          'CREATE INDEX idx_s_channels_archived ON s_channels (is_archived)',
        ],
      });
    }
  },
  {
    id: '2026-05-03-002-init-system-batches',
    description: 'Create system batches collection (s_batches)',
    run: async (pb) => {
      try {
        const existing = await pb.collections.getOne('s_batches');
        existing.listRule = "";
        existing.viewRule = "";
        existing.createRule = "";
        existing.updateRule = "";
        existing.deleteRule = "";
        await pb.collections.update(existing.id, existing);
        return;
      } catch {}
      const channels = await pb.collections.getOne('s_channels');
      await pb.collections.create({
        name: 's_batches',
        type: 'base',
        system: false,
        listRule: "",
        viewRule: "",
        createRule: "",
        updateRule: "",
        deleteRule: "",
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
            name: 'channel_id', 
            type: 'relation', 
            required: true,
            system: false,
            collectionId: channels.id,
            cascadeDelete: true,
            maxSelect: 1,
          },
          { id: 'select2063623452', name: 'status', type: 'select', required: true, system: false, values: ['pending', 'processing', 'completed', 'failed'] },
          { id: 'date2063623453', name: 'scheduled_for', type: 'date', system: false },
          { id: 'bool3018210264', name: 'is_archived', type: 'bool', system: false },
          { id: 'text3018210265', name: 'notes', type: 'text', system: false },
          { id: 'json3018210266', name: 'metadata_json', type: 'json', system: false },
        ],
        indexes: [
          'CREATE INDEX idx_s_batches_archived ON s_batches (is_archived)',
        ],
      });
    }
  },
  {
    id: '2026-05-03-003-init-system-staged-videos',
    description: 'Create system staged_videos collection (s_staged_videos)',
    run: async (pb) => {
      try {
        const existing = await pb.collections.getOne('s_staged_videos');
        existing.listRule = "";
        existing.viewRule = "";
        existing.createRule = "";
        existing.updateRule = "";
        existing.deleteRule = "";
        await pb.collections.update(existing.id, existing);
        return;
      } catch {}
      const batches = await pb.collections.getOne('s_batches');
      await pb.collections.create({
        name: 's_staged_videos',
        type: 'base',
        system: false,
        listRule: "",
        viewRule: "",
        createRule: "",
        updateRule: "",
        deleteRule: "",
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
            name: 'batch_id', 
            type: 'relation', 
            required: true,
            system: false,
            collectionId: batches.id,
            cascadeDelete: true,
            maxSelect: 1,
          },
          { 
            id: 'select2063623452',
            name: 'status', 
            type: 'select', 
            required: true,
            system: false,
            values: ['idle', 'processing', 'success', 'error']
          },
          { id: 'text1579384326', name: 'title', type: 'text', required: true, system: false },
          { id: 'text1579384327', name: 'description_brotli_b64', type: 'text', system: false },
          { 
            id: 'select2063623454',
            name: 'privacyStatus', 
            type: 'select', 
            required: true,
            system: false,
            values: ['public', 'private', 'unlisted']
          },
          { id: 'text1579384328', name: 'license', type: 'text', system: false },
          { id: 'bool1579384329', name: 'embeddable', type: 'bool', system: false },
          { id: 'bool1579384330', name: 'publicStatsViewable', type: 'bool', system: false },
          { id: 'bool1579384331', name: 'madeForKids', type: 'bool', system: false },
          { id: 'json1579384332', name: 'tags', type: 'json', system: false },
          { id: 'text1579384333', name: 'categoryId', type: 'text', system: false },
          { id: 'text1579384334', name: 'thumbnailUrl', type: 'text', system: false },
          { id: 'date1579384335', name: 'scheduledStartTime', type: 'date', system: false },
          { id: 'date1579384336', name: 'publishAt', type: 'date', system: false },
          { id: 'date1579384337', name: 'recordingDate', type: 'date', system: false },
          { id: 'text1579384338', name: 'language', type: 'text', system: false },
          { id: 'number1579384339', name: 'sort_order', type: 'number', system: false },
          { id: 'text3018210259', name: 'error_message', type: 'text', system: false },
          { id: 'date3018210260', name: 'finished_at', type: 'date', system: false },
          { id: 'select3018210267', name: 'latencyPreference', type: 'select', system: false, values: ['normal', 'low', 'ultraLow'] },
          { id: 'bool3018210268', name: 'enableAutoStart', type: 'bool', system: false },
          { id: 'bool3018210269', name: 'enableAutoStop', type: 'bool', system: false },
          { id: 'bool3018210270', name: 'enableDvr', type: 'bool', system: false },
          { id: 'bool3018210274', name: 'enableContentEncryption', type: 'bool', system: false },
          { id: 'bool3018210275', name: 'startWithLowLatency', type: 'bool', system: false },
          { id: 'bool3018210276', name: 'recordFromStart', type: 'bool', system: false },
          { id: 'bool3018210277', name: 'enableMonitorStream', type: 'bool', system: false },
          { id: 'number3018210278', name: 'broadcastStreamDelayMs', type: 'number', system: false },
          { id: 'select3018210279', name: 'projection', type: 'select', system: false, values: ['rectangular', '360'] },
          { id: 'date3018210280', name: 'scheduledEndTime', type: 'date', system: false },
          { id: 'text3018210281', name: 'defaultLanguage', type: 'text', system: false },
          { id: 'text3018210282', name: 'defaultAudioLanguage', type: 'text', system: false },
          { id: 'bool3018210271', name: 'is_archived', type: 'bool', system: false },
          { id: 'text3018210272', name: 'notes', type: 'text', system: false },
          { id: 'json3018210273', name: 'metadata_json', type: 'json', system: false },
        ],
        indexes: [
          'CREATE INDEX idx_s_staged_status ON s_staged_videos (status)',
          'CREATE INDEX idx_s_staged_batch ON s_staged_videos (batch_id)',
          'CREATE INDEX idx_s_staged_scheduled ON s_staged_videos (scheduledStartTime)',
          'CREATE INDEX idx_s_staged_archived ON s_staged_videos (is_archived)',
        ],
      });
    }
  },
  {
    id: '2026-05-03-004-init-tenant-settings',
    description: 'Create tenant settings collection (t_app_settings) for KV config',
    run: async (pb) => {
      try {
        const existing = await pb.collections.getOne('t_app_settings');
        existing.listRule = "";
        existing.viewRule = "";
        existing.createRule = "";
        existing.updateRule = "";
        existing.deleteRule = "";
        await pb.collections.update(existing.id, existing);
        return;
      } catch {}
      await pb.collections.create({
        name: 't_app_settings',
        type: 'base',
        system: false,
        listRule: "",
        viewRule: "",
        createRule: "",
        updateRule: "",
        deleteRule: "",
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
          { id: 'text1579384326', name: 'key', type: 'text', required: true, system: false },
          { id: 'json1579384327', name: 'value', type: 'json', required: true, system: false },
          { id: 'text1579384328', name: 'category', type: 'text', system: false },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_t_settings_key ON t_app_settings (key)',
        ],
      });
    }
  },
  {
    id: '2026-05-12-001-add-job-type-to-staged-videos',
    description: 'Add job_type field to s_staged_videos for smart multi-upload tracking',
    run: async (pb) => {
      try {
        const collection = await pb.collections.getOne('s_staged_videos');
        const hasJobType = collection.fields.some(f => f.name === 'job_type');
        if (!hasJobType) {
          collection.fields.push({
            id: 'select3018210283',
            name: 'job_type',
            type: 'select',
            required: true,
            system: false,
            values: ['VideoUpload', 'LiveBroadcast']
          });
          await pb.collections.update(collection.id, collection);
          console.log('✅ Added job_type field to s_staged_videos');
        }
      } catch (e) {
        console.error('❌ Failed to update s_staged_videos:', e);
      }
    }
  }
];

async function run() {
  try {
    console.log(`🚀 Starting step-wise migrations at ${PB_URL}...`);
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

    console.log('✨ All migrations reconciled.');
  } catch (error) {
    console.error('❌ Migration error:', error);
    process.exit(1);
  }
}

run();
