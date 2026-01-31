import Database from 'better-sqlite3';

export function initUserDb(dbPath) {
  const db = new Database(dbPath);
  
  // User's database starts empty
  // They create tables via Studio
  
  db.close();
}

export function initMetaDb(metaPath) {
  const db = new Database(metaPath);
  
  // Timeline events
  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
  
  // Migrations log
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL UNIQUE,
      applied_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
  
  // Snapshots metadata
  db.exec(`
    CREATE TABLE IF NOT EXISTS snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL UNIQUE,
      size INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
  
  db.close();
}