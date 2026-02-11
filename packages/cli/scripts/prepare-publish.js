#!/usr/bin/env node

/**
 * prepare-publish.js
 * 
 * Runs before `npm publish` (via prepublishOnly).
 * Copies the server source and pre-built Studio UI into the CLI package
 * so they're included in the npm tarball.
 * 
 * Published layout:
 *   sql-kite/
 *   ├── bin/           (CLI entry point)
 *   ├── src/           (CLI source)
 *   ├── server/        (server source - flattened from packages/server/src/)
 *   ├── studio-out/    (pre-built Studio UI from packages/studio/out/)
 *   └── package.json
 */

import { cpSync, existsSync, rmSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cliRoot = join(__dirname, '..');
const packagesRoot = join(cliRoot, '..');

const serverSrc = join(packagesRoot, 'server', 'src');
const studioOut = join(packagesRoot, 'studio', 'out');

const serverDest = join(cliRoot, 'server');
const studioDest = join(cliRoot, 'studio-out');

console.log('Preparing sql-kite for publish...\n');

// 1. Copy server source
if (!existsSync(serverSrc)) {
  console.error('ERROR: Server source not found at:', serverSrc);
  console.error('Make sure you are running this from the monorepo.');
  process.exit(1);
}

// Clean previous copies
if (existsSync(serverDest)) rmSync(serverDest, { recursive: true });
if (existsSync(studioDest)) rmSync(studioDest, { recursive: true });

console.log('Copying server source...');
cpSync(serverSrc, serverDest, { recursive: true });
console.log('  ✓ server/ ready');

// 2. Copy studio build
if (!existsSync(studioOut)) {
  console.error('ERROR: Studio build not found at:', studioOut);
  console.error('Run: cd packages/studio && npm run build');
  process.exit(1);
}

console.log('Copying Studio build output...');
cpSync(studioOut, studioDest, { recursive: true });
console.log('  ✓ studio-out/ ready');

console.log('\n✓ Package ready for publish!');
