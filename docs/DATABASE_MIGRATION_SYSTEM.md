# Database Migration System - Fixing Existing Projects

## Problem

When launching the branch system, existing LocalDB projects failed to start because:
- Their `meta.db` file had the old schema (no branch tables)
- Server tried to query branch tables that didn't exist
- No migration path from old → new schema

## Solution

Created a robust meta database migration system:

### 1. Migration Module (`meta-migration.js`)

Automatic migration that handles:
- **Version tracking** via `schema_version` in settings table
- **Table detection** using `PRAGMA table_info()`
- **Column detection** to check if migration needed
- **Data preservation** when migrating tables
- **Error handling** with try/catch for missing tables

### 2. Migration Strategy

```
Old Schema (v0):
  events (id, type, data, created_at)
  migrations (id, filename, applied_at)
  snapshots (id, filename, size, created_at)

New Schema (v1):
  settings (key, value)                           # NEW
  branches (id, name, db_file, ...)              # NEW
  events (id, branch, type, data, created_at)    # UPDATED
  migrations (id, branch, filename, applied_at)   # UPDATED
  snapshots (id, branch, filename, name, ...)    # UPDATED
```

### 3. Migration Process

For each table:
1. Check if table exists
2. If exists, check if has new columns
3. If missing columns:
   - Rename old table to `table_old`
   - Create new table with correct schema
   - Copy data with defaults for new columns
   - Drop old table
4. If doesn't exist, create with new schema

### 4. Integration Points

**Server Startup:**
```javascript
// packages/server/src/index.js

// Before starting Fastify:
migrateMetaDb(metaDbPath);
```

**Project Creation:**
```javascript
// packages/cli/src/utils/db-init.js

export function initMetaDb(metaPath) {
  const db = new Database(metaPath);
  db.close();

  // Run migration to latest schema
  migrateMetaDb(metaPath);
}
```

### 5. Features

✅ **Backward Compatible** - Old projects upgraded automatically
✅ **Data Preserving** - Migrates existing events/migrations/snapshots
✅ **Idempotent** - Safe to run multiple times
✅ **Version Tracked** - Knows what version it's at
✅ **Error Tolerant** - Handles missing tables gracefully
✅ **Logging** - Clear console output showing migration steps

### 6. How It Works

Example migration flow:

```
Server starts with existing project "blog"

1. Load meta.db
2. Check schema_version → 0 (not set)
3. Migrate to v1:
   a. Create settings table
   b. Create branches table
   c. Detect events table exists but missing 'branch' column
   d. Rename events → events_old
   e. Create new events table with branch column
   f. Copy: INSERT INTO events SELECT id, 'main', type, data, created_at FROM events_old
   g. Drop events_old
   h. Repeat for migrations and snapshots
   i. Create default 'main' branch pointing to db.sqlite
   j. Set current_branch = 'main'
   k. Set schema_version = 1
4. Continue server startup

Result: Old project now has full branch support, all data preserved
```

### 7. Testing

**Test Cases:**
1. ✅ New project (v0 → v1)
2. ✅ Existing project without data
3. ✅ Existing project with migrations applied
4. ✅ Existing project with snapshots
5. ✅ Existing project with timeline events
6. ✅ Already migrated project (v1 → v1, should skip)

**Manual Test:**
```bash
# Start existing project
localdb start blog

# Should see:
# Meta DB current version: 0
# Migrating meta DB to v1 (branch support)...
#   Migrating events table...
#   Migrating migrations table...
#   Creating default main branch...
# ✓ Meta DB migrated to v1
# Server started...
```

### 8. Future Migrations

To add v2 later:

```javascript
// In meta-migration.js

if (version < 2) {
  console.log('Migrating meta DB to v2...');

  // Add new feature
  db.exec(`
    ALTER TABLE branches ADD COLUMN created_by TEXT;
  `);

  db.prepare(`
    INSERT OR REPLACE INTO settings (key, value)
    VALUES ('schema_version', '2')
  `).run();

  console.log('✓ Meta DB migrated to v2');
}
```

Migrations are:
- **Ordered** (v0→v1→v2→v3...)
- **Incremental** (each runs only once)
- **Tracked** (schema_version prevents re-running)

## Files Created/Modified

**Created:**
- `packages/cli/src/utils/meta-migration.js` (234 lines)

**Modified:**
- `packages/cli/src/utils/db-init.js` - Now calls migration
- `packages/server/src/index.js` - Runs migration on startup
- `packages/server/src/db/connections.js` - Better error handling

## Migration Guarantees

1. **No Data Loss** - All existing data preserved
2. **Atomic** - Each table migration is transactional
3. **Logged** - Clear output of what's happening
4. **Safe** - Can run multiple times without issues
5. **Fast** - Only runs when needed (version check)

## Result

✅ Existing projects can now upgrade to branch system
✅ Server starts successfully after migration
✅ All old data accessible in 'main' branch
✅ New projects get v1 schema from the start
✅ Zero manual intervention required

The migration system makes the branch feature **production-ready** for existing users!
