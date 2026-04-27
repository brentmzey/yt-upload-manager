import PocketBase from 'pocketbase';

const PB_URL = process.env.PUBLIC_POCKETBASE_URL || 'http://127.0.0.1:8090';
const PB_ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL || 'admin@yt-manager.com';
const PB_ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD || 'admin123456';

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
          const res = await fetch(`${PB_URL}/api/admins/auth-with-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: PB_ADMIN_EMAIL, password: PB_ADMIN_PASSWORD })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.message || 'Legacy auth failed');
          pb.authStore.save(data.token, data.admin);
        }
        console.log('✅ Authenticated as Legacy Admin.');
        return;
      } catch (legacyErr) {
        console.error('❌ Legacy authentication failed.');
      }
    }
    console.error('❌ Authentication failed. Did the "pocketbase superuser/admin create" command succeed?');
    throw e;
  }
}

async function ensureMigrationsCollection() {
  try {
    await pb.collections.getOne('internal_migrations');
  } catch {
    console.log('✨ Creating internal_migrations collection...');
    await pb.collections.create({
      name: 'internal_migrations',
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
    await pb.collection('internal_migrations').getFirstListItem(`migration_id="${id}"`);
    return true;
  } catch {
    return false;
  }
}

async function markApplied(id: string, description: string) {
  await pb.collection('internal_migrations').create({
    migration_id: id,
    description: description,
  });
}

/**
 * STEP-WISE MIGRATIONS
 */
const migrations: MigrationStep[] = [
  {
    id: '2026-04-24-001-init-channels',
    description: 'Create initial channels collection',
    run: async (pb) => {
      await pb.collections.create({
        name: 'channels',
        type: 'base',
        fields: [
          { name: 'name', type: 'text', required: true },
          { name: 'handle', type: 'text', required: true },
          { name: 'status', type: 'select', values: ['active', 'expired', 'pending'] },
          { name: 'youtube_config_brotli_b64', type: 'text', required: true },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_channels_handle ON channels (handle)',
        ],
      });
    }
  },
  {
    id: '2026-04-24-002-init-batches',
    description: 'Create initial batches collection',
    run: async (pb) => {
      await pb.collections.create({
        name: 'batches',
        type: 'base',
        fields: [
          { name: 'channel_id', type: 'relation', collectionId: 'channels', cascadeDelete: true },
          { name: 'status', type: 'select', values: ['pending', 'processing', 'completed', 'failed'] },
          { name: 'priority', type: 'number', required: true },
        ],
      });
    }
  },
  {
    id: '2026-04-24-003-init-staged-videos',
    description: 'Create staged_videos with Brotli fields',
    run: async (pb) => {
      await pb.collections.create({
        name: 'staged_videos',
        type: 'base',
        fields: [
          { name: 'batch_id', type: 'relation', collectionId: 'batches', cascadeDelete: true },
          { name: 'status', type: 'select', values: ['idle', 'processing', 'success', 'error'] },
          { name: 'title', type: 'text', required: true },
          { name: 'description_brotli_b64', type: 'text', required: true },
          { name: 'subDetails_brotli_b64', type: 'text', required: true },
          { name: 'privacyStatus', type: 'select', values: ['public', 'private', 'unlisted'] },
          { name: 'categoryId', type: 'text', required: true },
        ],
      });
    }
  },
  {
    id: '2026-04-24-004-add-staged-indices',
    description: 'Add performance indices to staged_videos',
    run: async (pb) => {
      const coll = await pb.collections.getOne('staged_videos');
      coll.indexes = [
        ...(coll.indexes || []),
        'CREATE INDEX idx_staged_status ON staged_videos (status)',
        'CREATE INDEX idx_staged_batch ON staged_videos (batch_id)',
      ];
      await pb.collections.update(coll.id, coll);
    }
  },
  {
    id: '2026-04-24-005-add-compression-hints',
    description: 'Add is_compressed flag to metadata collections',
    run: async (pb) => {
      // Update staged_videos
      const staged = await pb.collections.getOne('staged_videos');
      const stagedFields = (staged as any).fields || (staged as any).schema || [];
      stagedFields.push({ name: 'is_compressed', type: 'bool', required: false });
      await pb.collections.update(staged.id, { fields: stagedFields });

      // Update channels
      const channels = await pb.collections.getOne('channels');
      const channelFields = (channels as any).fields || (channels as any).schema || [];
      channelFields.push({ name: 'is_compressed', type: 'bool', required: false });
      await pb.collections.update(channels.id, { fields: channelFields });
    }
  }
];

async function run() {
  try {
    console.log(`🚀 Starting step-wise migrations at ${PB_URL}...`);
    await ensureAdmin();
    await ensureMigrationsCollection();

    for (const m of migrations) {
      if (await isApplied(m.id)) {
        console.log(`⏭️  Skipping applied migration: ${m.id}`);
        continue;
      }
      console.log(`⚙️  Applying migration: ${m.id} (${m.description})...`);
      await m.run(pb);
      await markApplied(m.id, m.description);
      console.log(`✅ Applied: ${m.id}`);
    }

    console.log('✨ All migrations reconciled.');
  } catch (error) {
    console.error('❌ Migration error:', error);
    process.exit(1);
  }
}

run();
