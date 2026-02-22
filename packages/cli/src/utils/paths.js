import { homedir } from 'os';
import { join, dirname } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';

export const SQL_KITE_HOME = join(homedir(), '.sql-kite');
export const RUNTIME_DIR = join(SQL_KITE_HOME, 'runtime');
export const STUDIO_DIR = join(SQL_KITE_HOME, 'studio');
export const LOGS_DIR = join(SQL_KITE_HOME, 'logs');

/**
 * Resolve paths that work in both layouts:
 * 
 * Development (monorepo):
 *   packages/cli/src/utils/paths.js  (this file)
 *   packages/server/src/index.js
 *   packages/studio/out/
 * 
 * Published (npm install -g):
 *   node_modules/sql-kite/src/utils/paths.js  (this file)
 *   node_modules/sql-kite/server/index.js
 *   node_modules/sql-kite/studio-out/
 */
const __paths_dirname = dirname(fileURLToPath(import.meta.url));
// CLI package root: src/utils -> src -> cli root
const CLI_PACKAGE_ROOT = join(__paths_dirname, '..', '..');

/**
 * Get the path to the Studio static build output.
 * Checks npm-published layout first, then monorepo layout.
 */
export function getStudioOutPath() {
  // npm layout: <pkg>/studio-out/
  const npmPath = join(CLI_PACKAGE_ROOT, 'studio-out');
  if (existsSync(npmPath)) return npmPath;

  // monorepo layout: packages/cli/../../studio/out
  const monoPath = join(CLI_PACKAGE_ROOT, '..', 'studio', 'out');
  if (existsSync(monoPath)) return monoPath;

  // Return npm path as default (will trigger "not built" error with correct message)
  return npmPath;
}

/**
 * Get the path to the server entry point.
 * Checks npm-published layout first, then monorepo layout.
 */
export function getServerEntryPath() {
  // npm layout: <pkg>/server/index.js
  const npmPath = join(CLI_PACKAGE_ROOT, 'server', 'index.js');
  if (existsSync(npmPath)) return npmPath;

  // monorepo layout: packages/cli/../../server/src/index.js
  const monoPath = join(CLI_PACKAGE_ROOT, '..', 'server', 'src', 'index.js');
  if (existsSync(monoPath)) return monoPath;

  // Return npm path as default
  return npmPath;
}

/**
 * Get the path to the CLI utils directory.
 * Used by the server to import shared utilities.
 */
export function getCliUtilsDir() {
  return __paths_dirname;
}

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