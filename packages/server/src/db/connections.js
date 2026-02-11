import Database from 'better-sqlite3';
import { join } from 'path';

const connections = new Map();

/**
 * Get the current active branch for a project
 */
export function getCurrentBranch(projectPath) {
  try {
    const metaDb = getMetaDb(projectPath);
    const result = metaDb.prepare(`
      SELECT value FROM settings WHERE key = 'current_branch'
    `).get();

    return result ? result.value : 'main';
  } catch (error) {
    console.error('Error getting current branch:', error.message);
    return 'main'; // Fallback to main
  }
}

/**
 * Get user database for current branch
 */
export function getUserDb(projectPath, branchName = null) {
  const branch = branchName || getCurrentBranch(projectPath);
  const key = `user-${projectPath}-${branch}`;

  if (!connections.has(key)) {
    const metaDb = getMetaDb(projectPath);

    // Get the DB file for this branch
    const branchInfo = metaDb.prepare(`
      SELECT db_file FROM branches WHERE name = ?
    `).get(branch);

    if (!branchInfo) {
      throw new Error(`Branch "${branch}" does not exist`);
    }

    const dbPath = join(projectPath, branchInfo.db_file);
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

/**
 * Close and remove connection for a specific branch
 * Used when switching branches
 */
export function closeBranchConnection(projectPath, branchName) {
  const key = `user-${projectPath}-${branchName}`;

  if (connections.has(key)) {
    const db = connections.get(key);
    db.close();
    connections.delete(key);
  }
}

/**
 * Get a read-only user database connection for compare mode
 */
export function getReadOnlyUserDb(projectPath, branchName) {
  const branch = branchName || getCurrentBranch(projectPath);
  const key = `readonly-${projectPath}-${branch}`;

  if (!connections.has(key)) {
    const metaDb = getMetaDb(projectPath);

    const branchInfo = metaDb.prepare(`
      SELECT db_file FROM branches WHERE name = ?
    `).get(branch);

    if (!branchInfo) {
      throw new Error(`Branch "${branch}" does not exist`);
    }

    const dbPath = join(projectPath, branchInfo.db_file);
    const db = new Database(dbPath, { readonly: true, fileMustExist: true });
    db.pragma('query_only = ON');
    db.pragma('busy_timeout = 2000');
    connections.set(key, db);
  }

  return connections.get(key);
}

export function closeReadOnlyBranchConnection(projectPath, branchName) {
  const key = `readonly-${projectPath}-${branchName}`;

  if (connections.has(key)) {
    const db = connections.get(key);
    db.close();
    connections.delete(key);
  }
}