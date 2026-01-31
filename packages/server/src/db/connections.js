import Database from 'better-sqlite3';
import { join } from 'path';

const connections = new Map();

export function getUserDb(projectPath) {
  const key = `user-${projectPath}`;
  
  if (!connections.has(key)) {
    const dbPath = join(projectPath, 'db.sqlite');
    const db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    connections.set(key, db);
  }
  
  return connections.get(key);
}

export function getMetaDb(projectPath) {
  const key = `meta-${projectPath}`;
  
  if (!connections.has(key)) {
    const dbPath = join(projectPath, '.studio', 'meta.db');
    const db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    connections.set(key, db);
  }
  
  return connections.get(key);
}