import PocketBase from 'pocketbase';
import { Effect, Console, Schedule } from 'effect';

const PB_URL = process.env.PUBLIC_POCKETBASE_URL || 'http://127.0.0.1:8090';
const PB_ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL || 'admin@yt-manager.com';
const PB_ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD || 'admin123456';

const pb = new PocketBase(PB_URL);

/**
 * Ensures the Admin account exists.
 * PocketBase doesn't allow creating the first admin via API if it's completely fresh, 
 * but we can try and catch the failure or use the executable's flags.
 * This script assumes the user might have already run `pocketbase serve`.
 */
async function ensureAdmin() {
  try {
    // PocketBase 0.23+ uses the '_superusers' collection for admins
    await pb.collection('_superusers').authWithPassword(PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD);
    console.log('✅ Authenticated as Superuser.');
  } catch (error) {
    console.log('Attempting to create first superuser...');
    try {
      // This only works if no superusers exist
      await pb.collection('_superusers').create({
        email: PB_ADMIN_EMAIL,
        password: PB_ADMIN_PASSWORD,
        passwordConfirm: PB_ADMIN_PASSWORD,
      });
      console.log('✨ Superuser account created.');
      await pb.collection('_superusers').authWithPassword(PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD);
    } catch (e) {
      console.error('❌ Could not authenticate or create superuser. Is PocketBase running?');
      throw e;
    }
  }
}

async function createOrUpdateCollection(config: any) {
  try {
    const existing = await pb.collections.getOne(config.name);
    console.log(`🔄 Updating collection: ${config.name}...`);
    // Merge schema to be additive where possible, or just overwrite for simplicity in this dev script
    await pb.collections.update(existing.id, config);
  } catch (err) {
    console.log(`✨ Creating collection: ${config.name}...`);
    await pb.collections.create(config);
  }
}

async function migrate() {
  try {
    console.log(`🚀 Connecting to PocketBase at ${PB_URL}...`);
    await ensureAdmin();

    // --- 1. Channels Collection ---
    // Optimized with specific handle index and status-based indexing
    await createOrUpdateCollection({
      name: 'channels',
      type: 'base',
      schema: [
        { name: 'name', type: 'text', required: true, options: { min: 1, max: 100 } },
        { name: 'handle', type: 'text', required: true, options: { pattern: '^@.*' } },
        { name: 'status', type: 'select', required: true, options: { values: ['active', 'expired', 'pending'] } },
        { name: 'youtube_config_brotli_b64', type: 'text', required: true }, // Compressed for storage efficiency
        { name: 'subscriber_count', type: 'number', required: false },
        { name: 'last_sync', type: 'date', required: false },
        { name: 'avatar_url', type: 'url', required: false },
      ],
      indexes: [
        'CREATE INDEX idx_channels_name ON channels (name)',
        'CREATE UNIQUE INDEX idx_channels_handle ON channels (handle)',
        'CREATE INDEX idx_channels_status ON channels (status)',
      ],
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: '@request.auth.id != ""',
      updateRule: '@request.auth.id != ""',
      deleteRule: '@request.auth.id != ""',
    });

    // --- 2. Batches Collection ---
    // Orchestration-ready with worker_id for multi-agent support
    await createOrUpdateCollection({
      name: 'batches',
      type: 'base',
      schema: [
        { 
          name: 'channel_id', 
          type: 'relation', 
          required: true,
          options: { collectionId: 'channels', cascadeDelete: true, maxSelect: 1 }
        },
        { 
          name: 'status', 
          type: 'select', 
          required: true,
          options: { values: ['pending', 'processing', 'completed', 'failed', 'paused'] }
        },
        { name: 'scheduled_for', type: 'date', required: false },
        { name: 'priority', type: 'number', required: true, options: { min: 0, max: 10 } },
        { name: 'worker_id', type: 'text', required: false }, // For distributed orchestration
        { name: 'metadata_json', type: 'json', required: false }, // Future-proofing for extra job data
      ],
      indexes: [
        'CREATE INDEX idx_batches_channel ON batches (channel_id)',
        'CREATE INDEX idx_batches_queue ON batches (status, priority, scheduled_for)',
        'CREATE INDEX idx_batches_worker ON batches (worker_id)',
      ],
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: '@request.auth.id != ""',
      updateRule: '@request.auth.id != ""',
      deleteRule: '@request.auth.id != ""',
    });

    // --- 3. Staged Videos Collection ---
    // Highly indexed for efficient status filtering and retrieval
    await createOrUpdateCollection({
      name: 'staged_videos',
      type: 'base',
      schema: [
        { 
          name: 'batch_id', 
          type: 'relation', 
          required: true,
          options: { collectionId: 'batches', cascadeDelete: true, maxSelect: 1 }
        },
        { 
          name: 'status', 
          type: 'select', 
          required: true,
          options: { values: ['idle', 'processing', 'success', 'error', 'retrying'] }
        },
        { name: 'title', type: 'text', required: true, options: { max: 100 } },
        { name: 'description_brotli_b64', type: 'text', required: true },
        { name: 'subDetails_brotli_b64', type: 'text', required: true },
        { name: 'localizations_brotli_b64', type: 'text', required: false },
        { name: 'tags_json', type: 'json', required: false }, // Store tags as array
        { 
          name: 'privacyStatus', 
          type: 'select', 
          required: true,
          options: { values: ['public', 'private', 'unlisted'] }
        },
        { name: 'categoryId', type: 'text', required: true },
        { name: 'scheduledStartTime', type: 'date', required: false },
        { name: 'video_id', type: 'text', required: false }, // YouTube Video ID after success
        { name: 'file_hash', type: 'text', required: false }, // Deduplication
        { name: 'file_size', type: 'number', required: false },
        { name: 'error_log', type: 'text', required: false },
      ],
      indexes: [
        'CREATE INDEX idx_staged_batch ON staged_videos (batch_id)',
        'CREATE INDEX idx_staged_status ON staged_videos (status)',
        'CREATE INDEX idx_staged_schedule ON staged_videos (scheduledStartTime)',
        'CREATE UNIQUE INDEX idx_staged_vid ON staged_videos (video_id) WHERE video_id != ""',
        'CREATE INDEX idx_staged_hash ON staged_videos (file_hash)',
      ],
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: '@request.auth.id != ""',
      updateRule: '@request.auth.id != ""',
      deleteRule: '@request.auth.id != ""',
    });

    // --- 4. Logs Collection ---
    // New: Performance & Audit logging
    await createOrUpdateCollection({
      name: 'system_logs',
      type: 'base',
      schema: [
        { name: 'level', type: 'select', required: true, options: { values: ['info', 'warn', 'error', 'debug'] } },
        { name: 'message', type: 'text', required: true },
        { name: 'context_json', type: 'json', required: false },
        { name: 'source', type: 'text', required: true },
      ],
      indexes: [
        'CREATE INDEX idx_logs_level ON system_logs (level)',
        'CREATE INDEX idx_logs_created ON system_logs (created)',
      ],
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: 'true', // Allow logging from clients
    });

    console.log('✅ All migrations completed successfully.');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrate();
