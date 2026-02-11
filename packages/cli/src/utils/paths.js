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