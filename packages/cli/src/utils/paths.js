import { homedir } from 'os';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

export const SQL_KITE_HOME = join(homedir(), '.sql-kite');
export const RUNTIME_DIR = join(SQL_KITE_HOME, 'runtime');
export const STUDIO_DIR = join(SQL_KITE_HOME, 'studio');
export const LOGS_DIR = join(SQL_KITE_HOME, 'logs');

export function getProjectPath(name) {
  return join(RUNTIME_DIR, name);
}

export function getProjectDbPath(name) {
  return join(getProjectPath(name), 'db.sqlite');
}

export function getProjectMetaPath(name) {
  return join(getProjectPath(name), '.studio', 'meta.db');
}

export function getProjectServerInfoPath(name) {
  return join(getProjectPath(name), '.studio', 'server.json');
}

export function ensureSqlKiteDirs() {
  [SQL_KITE_HOME, RUNTIME_DIR, STUDIO_DIR, LOGS_DIR].forEach(dir => {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  });
}

export function projectExists(name) {
  return existsSync(getProjectPath(name));
}

/**
 * Validate project name to prevent path traversal attacks
 * Only allows alphanumeric, hyphens, underscores
 * @param {string} name - Project name to validate
 * @returns {{ valid: boolean, error?: string, sanitized?: string }}
 */
export function validateProjectName(name) {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Project name is required' };
  }

  const trimmed = name.trim();
  
  if (trimmed.length === 0) {
    return { valid: false, error: 'Project name cannot be empty' };
  }

  if (trimmed.length > 50) {
    return { valid: false, error: 'Project name too long (max 50 characters)' };
  }

  // Block path traversal attempts
  if (trimmed.includes('..') || trimmed.includes('/') || trimmed.includes('\\')) {
    return { valid: false, error: 'Project name contains invalid characters (no paths allowed)' };
  }

  // Only allow alphanumeric, hyphens, underscores
  const validPattern = /^[a-zA-Z0-9_-]+$/;
  if (!validPattern.test(trimmed)) {
    return { valid: false, error: 'Project name can only contain letters, numbers, hyphens, and underscores' };
  }

  return { valid: true, sanitized: trimmed };
}