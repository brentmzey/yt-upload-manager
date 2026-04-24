import PocketBase from 'pocketbase';

const PB_URL = process.env.PUBLIC_POCKETBASE_URL || 'http://127.0.0.1:8090';
const PB_ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL || 'admin@yt-manager.com';
const PB_ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD || 'admin123456';

async function migrate() {
  const pb = new PocketBase(PB_URL);

  try {
    console.log(`🚀 Connecting to PocketBase at ${PB_URL}...`);
    await pb.admins.authWithPassword(PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD);
    console.log('✅ Authenticated as Admin.');

    // --- 1. Channels Collection ---
    await createOrUpdateCollection(pb, {
      name: 'channels',
      type: 'base',
      schema: [
        { name: 'name', type: 'text', required: true },
        { name: 'youtube_config_brotli_b64', type: 'text', required: true },
      ],
      indexes: ['CREATE INDEX idx_channels_name ON channels (name)'],
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: '@request.auth.id != ""',
      updateRule: '@request.auth.id != ""',
      deleteRule: '@request.auth.id != ""',
    });

    // --- 2. Batches Collection ---
    await createOrUpdateCollection(pb, {
      name: 'batches',
      type: 'base',
      schema: [
        { 
          name: 'channel_id', 
          type: 'relation', 
          required: true,
          options: {
            collectionId: 'channels',
            cascadeDelete: true,
            maxSelect: 1,
          }
        },
        { 
          name: 'status', 
          type: 'select', 
          required: true,
          options: {
            values: ['pending', 'processing', 'completed', 'failed']
          }
        },
        { name: 'scheduled_for', type: 'date', required: false },
      ],
      indexes: [
        'CREATE INDEX idx_batches_channel ON batches (channel_id)',
        'CREATE INDEX idx_batches_queue ON batches (status, scheduled_for)',
      ],
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: '@request.auth.id != ""',
      updateRule: '@request.auth.id != ""',
      deleteRule: '@request.auth.id != ""',
    });

    // --- 3. Staged Videos Collection ---
    await createOrUpdateCollection(pb, {
      name: 'staged_videos',
      type: 'base',
      schema: [
        { 
          name: 'batch_id', 
          type: 'relation', 
          required: true,
          options: {
            collectionId: 'batches',
            cascadeDelete: true,
            maxSelect: 1,
          }
        },
        { 
          name: 'status', 
          type: 'select', 
          required: true,
          options: {
            values: ['idle', 'processing', 'success', 'error']
          }
        },
        { name: 'title', type: 'text', required: true, options: { max: 100 } },
        { name: 'description_brotli_b64', type: 'text', required: true },
        { name: 'subDetails_brotli_b64', type: 'text', required: true },
        { name: 'localizations_brotli_b64', type: 'text', required: false },
        { 
          name: 'privacyStatus', 
          type: 'select', 
          required: true,
          options: {
            values: ['public', 'private', 'unlisted']
          }
        },
        { name: 'categoryId', type: 'text', required: true },
        { name: 'scheduledStartTime', type: 'date', required: false },
        { name: 'thumbnailUrl', type: 'text', required: false },
        { name: 'publishAt', type: 'date', required: false },
        { name: 'recordingDate', type: 'date', required: false },
        { name: 'language', type: 'text', required: false },
        { name: 'error_log', type: 'text', required: false },
      ],
      indexes: [
        'CREATE INDEX idx_staged_batch ON staged_videos (batch_id)',
        'CREATE INDEX idx_staged_status ON staged_videos (status)',
        'CREATE INDEX idx_staged_schedule ON staged_videos (scheduledStartTime)',
      ],
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: '@request.auth.id != ""',
      updateRule: '@request.auth.id != ""',
      deleteRule: '@request.auth.id != ""',
    });

    console.log('✅ All migrations completed successfully.');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

async function createOrUpdateCollection(pb: any, config: any) {
  try {
    const existing = await pb.collections.getOne(config.name);
    console.log(`🔄 Updating collection: ${config.name}...`);
    await pb.collections.update(existing.id, config);
  } catch (err) {
    console.log(`✨ Creating collection: ${config.name}...`);
    await pb.collections.create(config);
  }
}

migrate();
