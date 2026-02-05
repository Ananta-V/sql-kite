import Database from 'better-sqlite3';

/**
 * Migrate meta database to latest schema
 * Handles upgrading existing projects to support branches
 */
export function migrateMetaDb(metaPath) {
  const db = new Database(metaPath);

  // Create settings table first if it doesn't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Get current schema version
  let version = 0;
  try {
    const result = db.prepare(`
      SELECT value FROM settings WHERE key = 'schema_version'
    `).get();
    version = result ? parseInt(result.value) : 0;
  } catch (e) {
    version = 0;
  }

  console.log(`Meta DB current version: ${version}`);

  // Migration v0 -> v1: Add branch support
  if (version < 1) {
    console.log('Migrating meta DB to v1 (branch support)...');

    // Create branches table
    db.exec(`
      CREATE TABLE IF NOT EXISTS branches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        db_file TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        created_from TEXT,
        description TEXT
      );
    `);

    // Migrate events table
    try {
      const eventsInfo = db.pragma('table_info(events)');
      if (eventsInfo.length > 0) {
        const hasBranchColumn = eventsInfo.some(col => col.name === 'branch');

        if (!hasBranchColumn) {
          console.log('  Migrating events table...');
          db.exec(`ALTER TABLE events RENAME TO events_old;`);

          db.exec(`
            CREATE TABLE events (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              branch TEXT NOT NULL DEFAULT 'main',
              type TEXT NOT NULL,
              data TEXT NOT NULL,
              created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );
          `);

          db.exec(`
            INSERT INTO events (id, branch, type, data, created_at)
            SELECT id, 'main', type, data, created_at FROM events_old;
          `);

          db.exec(`DROP TABLE events_old;`);
        }
      } else {
        // No events table yet, create it
        db.exec(`
          CREATE TABLE events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            branch TEXT NOT NULL DEFAULT 'main',
            type TEXT NOT NULL,
            data TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
          );
        `);
      }
    } catch (e) {
      // Events table doesn't exist, create it
      db.exec(`
        CREATE TABLE IF NOT EXISTS events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          branch TEXT NOT NULL DEFAULT 'main',
          type TEXT NOT NULL,
          data TEXT NOT NULL,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
      `);
    }

    // Migrate migrations table
    try {
      const migrationsInfo = db.pragma('table_info(migrations)');
      if (migrationsInfo.length > 0) {
        const hasBranchColumn = migrationsInfo.some(col => col.name === 'branch');

        if (!hasBranchColumn) {
          console.log('  Migrating migrations table...');
          db.exec(`ALTER TABLE migrations RENAME TO migrations_old;`);

          db.exec(`
            CREATE TABLE migrations (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              branch TEXT NOT NULL DEFAULT 'main',
              filename TEXT NOT NULL,
              applied_at TEXT DEFAULT CURRENT_TIMESTAMP,
              UNIQUE(branch, filename)
            );
          `);

          db.exec(`
            INSERT INTO migrations (id, branch, filename, applied_at)
            SELECT id, 'main', filename, applied_at FROM migrations_old;
          `);

          db.exec(`DROP TABLE migrations_old;`);
        }
      } else {
        // No migrations table yet, create it
        db.exec(`
          CREATE TABLE migrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            branch TEXT NOT NULL DEFAULT 'main',
            filename TEXT NOT NULL,
            applied_at TEXT DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(branch, filename)
          );
        `);
      }
    } catch (e) {
      // Migrations table doesn't exist, create it
      db.exec(`
        CREATE TABLE IF NOT EXISTS migrations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          branch TEXT NOT NULL DEFAULT 'main',
          filename TEXT NOT NULL,
          applied_at TEXT DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(branch, filename)
        );
      `);
    }

    // Migrate snapshots table
    try {
      const snapshotsInfo = db.pragma('table_info(snapshots)');
      if (snapshotsInfo.length > 0) {
        const hasBranchColumn = snapshotsInfo.some(col => col.name === 'branch');
        const hasNameColumn = snapshotsInfo.some(col => col.name === 'name');

        if (!hasBranchColumn || !hasNameColumn) {
          console.log('  Migrating snapshots table...');
          db.exec(`ALTER TABLE snapshots RENAME TO snapshots_old;`);

          db.exec(`
            CREATE TABLE snapshots (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              branch TEXT NOT NULL DEFAULT 'main',
              filename TEXT NOT NULL UNIQUE,
              name TEXT NOT NULL DEFAULT '',
              size INTEGER,
              created_at TEXT DEFAULT CURRENT_TIMESTAMP,
              description TEXT
            );
          `);

          db.exec(`
            INSERT INTO snapshots (id, branch, filename, name, size, created_at)
            SELECT id, 'main', filename, filename, size, created_at FROM snapshots_old;
          `);

          db.exec(`DROP TABLE snapshots_old;`);
        }
      } else {
        // No snapshots table yet, create it
        db.exec(`
          CREATE TABLE snapshots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            branch TEXT NOT NULL DEFAULT 'main',
            filename TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL DEFAULT '',
            size INTEGER,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            description TEXT
          );
        `);
      }
    } catch (e) {
      // Snapshots table doesn't exist, create it
      db.exec(`
        CREATE TABLE IF NOT EXISTS snapshots (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          branch TEXT NOT NULL DEFAULT 'main',
          filename TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL DEFAULT '',
          size INTEGER,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          description TEXT
        );
      `);
    }

    // Create default 'main' branch if not exists
    const hasBranches = db.prepare('SELECT COUNT(*) as count FROM branches').get();
    if (hasBranches.count === 0) {
      console.log('  Creating default main branch...');
      db.prepare(`
        INSERT INTO branches (name, db_file, created_from, description)
        VALUES ('main', 'db.sqlite', NULL, 'Default branch')
      `).run();
    }

    // Set main as current branch
    db.prepare(`
      INSERT OR REPLACE INTO settings (key, value) VALUES ('current_branch', 'main')
    `).run();

    // Update schema version
    db.prepare(`
      INSERT OR REPLACE INTO settings (key, value) VALUES ('schema_version', '1')
    `).run();

    console.log('✓ Meta DB migrated to v1');
  }

  db.close();
}
