# Multi-Tenant Operations Guide

This document outlines how to manage the **YouTube Upload Manager** in a multi-tenant production environment using the **System Registry** architecture.

## Architecture Overview

The application follows a **"Registry + Dedicated Instance"** model:

1.  **System Registry (Central)**: A single PocketBase instance (on PocketHost) that acts as the global directory. It stores which tenants exist and how to connect to their private databases.
2.  **Client Databases (Distributed)**: Each client has their own isolated PocketBase instance. This ensures data sovereignty and prevents performance cross-talk.

---

## 1. The System Registry Schema

The registry uses two core collections:

### `s_tenants` (The Registry)
| Field | Type | Description |
| :--- | :--- | :--- |
| `tenant_name` | Text | Human readable name (e.g., "Acme Media") |
| `tenant_slug` | Text | URL-safe unique identifier (e.g., `acme-prod`) |
| `status` | Select | `active`, `suspended`, `trial`, `onboarding` |
| `metadata_json` | JSON | Flexible blob for audit logs, billing IDs, etc. |

### `s_tenant_properties` (The Configuration)
This is a key-value store linked to a `tenant_id`. It allows the app to be 12-factor and tenant-agnostic.

| Field | Type | Description |
| :--- | :--- | :--- |
| `tenant_id` | Relation | Link to `s_tenants` |
| `property_key` | Text | The unique configuration key (e.g., `TENANT_PROD_BASE_DB_URI`) |
| `property_value` | JSON | The actual value (string, number, or complex object) |
| `category` | Text | `infrastructure`, `auth`, `ui`, `feature_flags` |
| `is_secret` | Bool | If true, the UI should mask this value |

---

## 2. Onboarding a New Tenant

To add a new client to the platform:

### Step 1: Create the Tenant
Create a record in `s_tenants` via the Registry Admin UI or the CLI seeding script.
- **Name**: "New Client Corp"
- **Slug**: `new-client`

### Step 2: Provision Properties
Every tenant **must** have at least these properties to function:

| Key | Value Example | Category |
| :--- | :--- | :--- |
| `TENANT_PROD_BASE_DB_URI` | `"https://new-client.pockethost.io"` | `infrastructure` |
| `TENANT_ADMIN_EMAIL` | `"admin@new-client.com"` | `auth` |
| `TENANT_ADMIN_PASSWORD` | `"super-secret-password"` | `auth` |

### Step 3: Run Global Sync
Once registered, align their schema with the current app version:
```bash
just sync-tenants
```
This will automatically connect to the registry, find the new tenant, and push all `s_channels`, `s_batches`, and `s_staged_videos` collections to their new instance.

---

## 3. "Migrating" Properties (Power User Examples)

Properties are stored as JSON in the database, allowing for rich configuration.

### Example: Feature Flags
You can enable specific UI features for a premium tenant:
- **Key**: `FEATURE_AI_ENRICHMENT`
- **Value**: `true`
- **Category**: `feature_flags`

### Example: Regional Meta-Data
- **Key**: `TENANT_DEFAULTS`
- **Value**:
  ```json
  {
    "region": "us-east-1",
    "timezone": "America/New_York",
    "supported_languages": ["en", "es"]
  }
  ```
- **Category**: `general`

### Example: Metadata Column
In the `s_tenants` table, use the `metadata_json` column for lifecycle tracking:
```json
{
  "onboarded_at": "2026-05-04T12:00:00Z",
  "onboarded_by": "system-admin",
  "plan_type": "enterprise",
  "billing_id": "cust_12345"
}
```

---

## 4. Local Smoke Test Guide (Standard Operating Procedure)

To verify the entire multi-tenant system works end-to-end on your local machine, follow this specific sequence across **three terminal windows**.

### Window 1: The System Registry (Central Node)
This simulates the global directory that the app uses to find client databases.
```bash
just main-up
```
- **Status**: It will sit and serve on `http://127.0.0.1:8080`.
- **Admin**: `admin@yt-manager.com` / `admin123456`.

### Window 2: The Tenant Instance (Client Node)
This is the isolated database for a specific client (e.g., Acme Corp).
```bash
just up
```
- **Status**: It will sit and serve on `http://127.0.0.1:8090`.
- **Admin**: `admin@yt-manager.com` / `admin123456`.

### Window 3: Orchestration & App Launch
Now that both databases are running, synchronize them and launch the app.

**1. Align the fleet:**
```bash
just sync-tenants
```
- *What happens?* It connects to `8080` (Registry), finds the "Local Development Tenant", connects to `8090` (Client Node), and pushes the latest tables and indices.

**2. Launch the Application:**
```bash
just tauri   # For Desktop
# OR
just dev     # For Web
```

### Verification Checklist
- [ ] **Identity**: Look at the Log Console in the app. It should show: `Connecting to local-dev node...`
- [ ] **Data Flow**: Go to "Batch Manager". Create a test batch. It should save successfully to the `:8090` database.
- [ ] **Fleet Sync**: Add a new column to a collection in `scripts/migrate.ts`, run `just sync-tenants`, and verify the column appears in the `:8090` admin UI.

---

## 5. Migration & Identity Integrity

To ensure every dedicated Client DB knows its global identity, our migration system implements **Cross-Registry Mapping**.

### Step-Wise Migration Snippet (TypeScript)
We use a "Step-Wise" approach for 100% idempotency. Each step checks for existence before acting.

```typescript
// Example from scripts/migrate.ts
{
  id: '2026-05-04-001-init-tenant-identity',
  description: 'Ensure tenant identity mapping',
  run: async (pb) => {
    // 1. Create the container
    try {
      await pb.collections.getOne('s_tenant_identity');
    } catch {
      await pb.collections.create({
        name: 's_tenant_identity',
        type: 'base',
        fields: [{ name: 'tenant_id', type: 'text', required: true }],
      });
    }

    // 2. Sync with Registry Context (Passed from Global Orchestrator)
    if (process.env.TENANT_ID) {
      const list = await pb.collection('s_tenant_identity').getFullList();
      const payload = { tenant_id: process.env.TENANT_ID };
      if (list.length > 0) {
        await pb.collection('s_tenant_identity').update(list[0].id, payload);
      } else {
        await pb.collection('s_tenant_identity').create(payload);
      }
      console.log(`🆔 Local DB Identity aligned: ${process.env.TENANT_ID}`);
    }
  }
}
```

### SQL Context Example
While we primarily use the TypeScript SDK for migrations, you can execute logic that targets specific low-level SQLite optimizations if needed:

```typescript
// raw SQL for manual indices or triggers
run: async (pb) => {
   // PocketBase SDK handles indices in JSON, but for manual SQL:
   const sql = "CREATE INDEX IF NOT EXISTS idx_staged_audit ON s_staged_videos (created);";
   // Use pb.send() for raw endpoint access if required by custom PB hooks
}
```

### Idempotent "Sync" Flow
When you run `just sync-tenants`, the following happens:
1.  **Registry Lookup**: Fetches Tenant `acme` (ID: `abc123xyz`) from the Main DB.
2.  **Injected Context**: Spawns migration process with `TENANT_ID=abc123xyz`.
3.  **Local Alignment**: The Client DB updates its `s_tenant_identity` record to `abc123xyz`.
4.  **Schema Enforcement**: All tables are created/updated to the latest professional-grade schema.
