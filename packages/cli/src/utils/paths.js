import { homedir } from 'os';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

export const LOCALDB_HOME = join(homedir(), '.localdb');
export const RUNTIME_DIR = join(LOCALDB_HOME, 'runtime');
export const STUDIO_DIR = join(LOCALDB_HOME, 'studio');
export const LOGS_DIR = join(LOCALDB_HOME, 'logs');

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

export function ensureLocalDbDirs() {
  [LOCALDB_HOME, RUNTIME_DIR, STUDIO_DIR, LOGS_DIR].forEach(dir => {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  });
}

export function projectExists(name) {
  return existsSync(getProjectPath(name));
}