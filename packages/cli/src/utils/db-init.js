import Database from 'better-sqlite3';
import { migrateMetaDb } from './meta-migration.js';

export function initUserDb(dbPath) {
  const db = new Database(dbPath);

  // User's database starts empty
  // They create tables via Studio

  db.close();
}

export function initMetaDb(metaPath) {
  // Just ensure the file exists, then run migration
  const db = new Database(metaPath);
  db.close();

  // Run migration to latest schema
  migrateMetaDb(metaPath);
}